/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Parses XML-style tool calls from model text output.
 *
 * Some models (especially Qwen) occasionally emit tool calls as XML text
 * instead of using the proper tool_calls API. This parser extracts those
 * calls and converts them to structured FunctionCall objects.
 *
 * Supported formats:
 *   <function=tool_name>
 *   <parameter=param_name>value</parameter>
 *   </function>
 *
 * Also handles incomplete XML where closing tags may be missing.
 */

export interface XmlFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Parse XML function calls from text content.
 * Returns an array of parsed function calls and the remaining text
 * with the XML blocks removed.
 */
export function parseXmlToolCalls(text: string): {
  calls: XmlFunctionCall[];
  remainingText: string;
} {
  const calls: XmlFunctionCall[] = [];
  let remainingText = text;

  // Pattern 1: Complete <function>...</function> blocks
  const completePattern =
    /<function=([a-zA-Z_][a-zA-Z0-9_-]*)>([\s\S]*?)<\/function>/g;

  let match;
  const processedRanges: Array<{ start: number; end: number }> = [];

  while ((match = completePattern.exec(text)) !== null) {
    const functionName = match[1];
    const body = match[2];
    const args = parseParameters(body);

    if (Object.keys(args).length > 0 || functionName) {
      calls.push({ name: functionName, args });
      processedRanges.push({
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // Pattern 2: Incomplete <function> blocks (no closing </function>)
  // This handles cases where the model truncated the output
  if (calls.length === 0) {
    const incompletePattern = /<function=([a-zA-Z_][a-zA-Z0-9_-]*)>([\s\S]*?)$/;
    const incMatch = incompletePattern.exec(text);
    if (incMatch) {
      const functionName = incMatch[1];
      const body = incMatch[2];
      const args = parseParameters(body);

      if (Object.keys(args).length > 0) {
        calls.push({ name: functionName, args });
        processedRanges.push({
          start: incMatch.index,
          end: incMatch.index + incMatch[0].length,
        });
      }
    }
  }

  // Pattern 3: Handle " Cue" prefix that Qwen sometimes uses
  if (calls.length === 0) {
    const cuePattern =
      /\n?(?:本|草|តា|Lê)\n?<function=([a-zA-Z_][a-zA-Z0-9_-]*)>([\s\S]*?)<\/function>/g;
    while ((match = cuePattern.exec(text)) !== null) {
      const functionName = match[1];
      const body = match[2];
      const args = parseParameters(body);

      if (Object.keys(args).length > 0 || functionName) {
        calls.push({ name: functionName, args });
        processedRanges.push({
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
  }

  // Build remaining text by removing processed XML blocks
  if (processedRanges.length > 0) {
    remainingText = removeRanges(text, processedRanges);
  }

  return { calls, remainingText };
}

/**
 * Parse <parameter=name>value</parameter> blocks from function body.
 */
function parseParameters(body: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};

  // Complete parameter blocks
  const paramPattern =
    /<parameter=([a-zA-Z_][a-zA-Z0-9_]*)>([\s\S]*?)<\/parameter>/g;
  let match;
  while ((match = paramPattern.exec(body)) !== null) {
    const paramName = match[1];
    const rawValue = match[2].trim();
    args[paramName] = tryParseValue(rawValue);
  }

  // If no complete parameters found, try incomplete (no closing tag)
  if (Object.keys(args).length === 0) {
    const incompleteParamPattern =
      /<parameter=([a-zA-Z_][a-zA-Z0-9_]*)>([\s\S]*?)$/;
    const incMatch = incompleteParamPattern.exec(body);
    if (incMatch) {
      const paramName = incMatch[1];
      const rawValue = incMatch[2].trim();
      // Only accept if there's actual content
      if (rawValue.length > 0) {
        args[paramName] = tryParseValue(rawValue);
      }
    }
  }

  return args;
}

/**
 * Try to parse a string value into a typed value.
 * Attempts JSON parse first, then falls back to string.
 */
function tryParseValue(value: string): unknown {
  // Try JSON parse for arrays, objects, numbers, booleans
  if (
    value.startsWith('[') ||
    value.startsWith('{') ||
    value === 'true' ||
    value === 'false' ||
    value === 'null'
  ) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  // Try number
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    const num = Number(value);
    if (!isNaN(num)) return num;
  }

  // Try JSON array (multi-line)
  if (value.includes('\n') && value.trim().startsWith('[')) {
    try {
      return JSON.parse(value);
    } catch {
      // Return as string
    }
  }

  return value;
}

/**
 * Remove character ranges from a string, joining the gaps.
 */
function removeRanges(
  text: string,
  ranges: Array<{ start: number; end: number }>,
): string {
  // Sort ranges by start position
  const sorted = [...ranges].sort((a, b) => a.start - b.start);

  // Merge overlapping ranges
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of sorted) {
    if (merged.length > 0 && range.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(
        merged[merged.length - 1].end,
        range.end,
      );
    } else {
      merged.push({ ...range });
    }
  }

  // Build result
  let result = '';
  let lastEnd = 0;
  for (const range of merged) {
    result += text.slice(lastEnd, range.start);
    lastEnd = range.end;
  }
  result += text.slice(lastEnd);

  // Clean up: remove standalone  markers and extra whitespace
  result = result
    .replace(/^(?:本|草|តា|Lê)$\n?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return result;
}

/**
 * Check if text contains XML function call patterns.
 * Used as a quick pre-check before full parsing.
 */
export function containsXmlToolCall(text: string): boolean {
  return /<function=[a-zA-Z_][a-zA-Z0-9_-]*>/.test(text);
}
