/**
 * @license
 * Copyright 2025 Moli team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Utilities for managing the LLM output language rule file.
 * This file handles the creation and maintenance of ~/.moli/output-language.md
 * which instructs the LLM to respond in the user's preferred language.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Storage } from '@dobby/moli-code-core';
import {
  detectSystemLanguage,
  getLanguageNameFromLocale,
} from '../i18n/index.js';

const LLM_OUTPUT_LANGUAGE_RULE_FILENAME = 'output-language.md';
const LLM_OUTPUT_LANGUAGE_MARKER_PREFIX = 'moli-code:llm-output-language:';

/** Special value meaning "detect from system settings" */
export const OUTPUT_LANGUAGE_AUTO = 'auto';

/**
 * Checks if a value represents the "auto" setting.
 */
export function isAutoLanguage(value: string | undefined | null): boolean {
  return !value || value.toLowerCase() === OUTPUT_LANGUAGE_AUTO;
}

/**
 * Normalizes a language input to its canonical form.
 * Converts known locale codes (e.g., "zh", "ru") to full names (e.g., "Chinese", "Russian").
 * Unknown inputs are returned as-is to support any language name.
 */
export function normalizeOutputLanguage(language: string): string {
  const lowered = language.toLowerCase();
  const fullName = getLanguageNameFromLocale(lowered);
  // getLanguageNameFromLocale returns 'English' as default for unknown codes.
  // Only use the result if it's a known code or explicitly 'en'.
  if (fullName !== 'English' || lowered === 'en') {
    return fullName;
  }
  return language;
}

/**
 * Resolves the output language, converting 'auto' to the detected system language.
 */
export function resolveOutputLanguage(
  value: string | undefined | null,
): string {
  if (isAutoLanguage(value)) {
    const detectedLocale = detectSystemLanguage();
    return getLanguageNameFromLocale(detectedLocale);
  }
  return normalizeOutputLanguage(value!);
}

/**
 * Returns the path to the LLM output language rule file (~/.moli/output-language.md).
 */
function getOutputLanguageFilePath(): string {
  return path.join(
    Storage.getGlobalMoliDir(),
    LLM_OUTPUT_LANGUAGE_RULE_FILENAME,
  );
}

/**
 * Sanitizes a language string for use in an HTML comment marker.
 * Removes characters that could break HTML comment syntax.
 */
function sanitizeForMarker(language: string): string {
  return language
    .replace(/[\r\n]/g, ' ')
    .replace(/--!?>/g, '')
    .replace(/--/g, '');
}

/**
 * Generates the content for the LLM output language rule file.
 */
function generateOutputLanguageFileContent(language: string): string {
  const safeLanguage = sanitizeForMarker(language);
  return `# CRITICAL — Mandatory Output Language: ${language}
<!-- ${LLM_OUTPUT_LANGUAGE_MARKER_PREFIX} ${safeLanguage} -->

## Rule (HIGHEST PRIORITY)
You MUST write ALL natural-language text in **${language}**.
This is a non-negotiable, top-priority instruction that overrides any other language tendency.
Every sentence, explanation, comment, summary, question, and heading you produce MUST be in **${language}**.
If you catch yourself writing in another language, stop immediately and rewrite in **${language}**.

## Verification
Before sending each response, re-read your output and confirm that every natural-language portion is in **${language}**. If any part is not, fix it.

## Exception
Only switch languages if the user **explicitly** requests it (e.g., "please reply in English", "用中文回答").

## Keep technical artifacts unchanged
Do **not** translate or rewrite:
- Code blocks, CLI commands, file paths, stack traces, logs, JSON keys, identifiers
- Exact quoted text from the user (keep quotes verbatim)

## Tool / system outputs
Raw tool/system outputs may contain fixed-format English. Preserve them verbatim, and add a short **${language}** explanation below when helpful.
`;
}

/**
 * Extracts the language from the content of an output language rule file.
 * Supports both the new marker format and legacy heading format.
 */
function parseOutputLanguageFromContent(content: string): string | null {
  // Primary: machine-readable marker (e.g., <!-- moli-code:llm-output-language: 中文 -->)
  const markerRegex = new RegExp(
    String.raw`<!--\s*${LLM_OUTPUT_LANGUAGE_MARKER_PREFIX}\s*(.*?)\s*-->`,
    'i',
  );
  const markerMatch = content.match(markerRegex);
  if (markerMatch?.[1]?.trim()) {
    return markerMatch[1].trim();
  }

  // Fallback: legacy heading format (e.g., # CRITICAL: Chinese Output Language Rule)
  const headingMatch = content.match(
    /^#.*?CRITICAL:\s*(.*?)\s+Output Language Rule\b/im,
  );
  if (headingMatch?.[1]?.trim()) {
    return headingMatch[1].trim();
  }

  return null;
}

/**
 * Reads the current output language from the rule file.
 * Returns null if the file doesn't exist or can't be parsed.
 */
function readOutputLanguageFromFile(): string | null {
  const filePath = getOutputLanguageFilePath();
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return parseOutputLanguageFromContent(content);
  } catch {
    return null;
  }
}

/**
 * Writes the output language rule file with the given language.
 */
export function writeOutputLanguageFile(language: string): void {
  const filePath = getOutputLanguageFilePath();
  const content = generateOutputLanguageFileContent(language);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Updates the LLM output language rule file based on the setting value.
 * Resolves 'auto' to the detected system language before writing.
 */
export function updateOutputLanguageFile(settingValue: string): void {
  const resolved = resolveOutputLanguage(settingValue);
  writeOutputLanguageFile(resolved);
}

/**
 * Initializes the LLM output language rule file on application startup.
 *
 * @param outputLanguage - The output language setting value (e.g., 'auto', 'Chinese', etc.)
 *
 * Behavior:
 * - Resolves the setting value ('auto' -> detected system language, or use as-is)
 * - Ensures the rule file matches the resolved language
 * - Creates the file if it doesn't exist
 */
export function initializeLlmOutputLanguage(outputLanguage?: string): void {
  // Resolve 'auto' or undefined to the detected system language
  const resolved = resolveOutputLanguage(outputLanguage);
  const currentFileLanguage = readOutputLanguageFromFile();

  // Only write if the file doesn't match the resolved language
  if (currentFileLanguage !== resolved) {
    writeOutputLanguageFile(resolved);
  }
}
