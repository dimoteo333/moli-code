/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import AjvPkg, { type AnySchema, type Ajv } from 'ajv';
// Ajv2020 is the documented way to use draft-2020-12: https://ajv.js.org/json-schema.html#draft-2020-12
// eslint-disable-next-line import/no-internal-modules
import Ajv2020Pkg from 'ajv/dist/2020.js';
import * as addFormats from 'ajv-formats';
import levenshtein from 'fast-levenshtein';
import { createDebugLogger } from './debugLogger.js';

// Ajv's ESM/CJS interop: use 'any' for compatibility as recommended by Ajv docs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AjvClass = (AjvPkg as any).default || AjvPkg;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Ajv2020Class = (Ajv2020Pkg as any).default || Ajv2020Pkg;

const debugLogger = createDebugLogger('SchemaValidator');

const ajvOptions = {
  // See: https://ajv.js.org/options.html#strict-mode-options
  // strictSchema defaults to true and prevents use of JSON schemas that
  // include unrecognized keywords. The JSON schema spec specifically allows
  // for the use of non-standard keywords and the spec-compliant behavior
  // is to ignore those keywords. Note that setting this to false also
  // allows use of non-standard or custom formats (the unknown format value
  // will be logged but the schema will still be considered valid).
  strictSchema: false,
};

// Draft-07 validator (default)
const ajvDefault: Ajv = new AjvClass(ajvOptions);

// Draft-2020-12 validator for MCP servers using rmcp
const ajv2020: Ajv = new Ajv2020Class(ajvOptions);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const addFormatsFunc = (addFormats as any).default || addFormats;
addFormatsFunc(ajvDefault);
addFormatsFunc(ajv2020);

// Canonical draft-2020-12 meta-schema URI (used by rmcp MCP servers)
const DRAFT_2020_12_SCHEMA = 'https://json-schema.org/draft/2020-12/schema';

/**
 * Returns the appropriate validator based on schema's $schema field.
 */
function getValidator(schema: AnySchema): Ajv {
  if (
    typeof schema === 'object' &&
    schema !== null &&
    '$schema' in schema &&
    schema.$schema === DRAFT_2020_12_SCHEMA
  ) {
    return ajv2020;
  }
  return ajvDefault;
}

/**
 * Simple utility to validate objects against JSON Schemas.
 * Supports both draft-07 (default) and draft-2020-12 schemas.
 */
export class SchemaValidator {
  /**
   * Returns null if the data conforms to the schema described by schema (or if schema
   *  is null). Otherwise, returns a string describing the error.
   */
  static validate(schema: unknown | undefined, data: unknown): string | null {
    if (!schema) {
      return null;
    }
    if (typeof data !== 'object' || data === null) {
      return 'Value of params must be an object';
    }

    const anySchema = schema as AnySchema;
    const validator = getValidator(anySchema);

    // Try to compile and validate; skip validation if schema can't be compiled.
    // This handles schemas using JSON Schema versions AJV doesn't support
    // (e.g., draft-2019-09, future versions).
    // This matches LenientJsonSchemaValidator behavior in mcp-client.ts.
    let validate;
    try {
      validate = validator.compile(anySchema);
    } catch (error) {
      // Schema compilation failed (unsupported version, invalid $ref, etc.)
      // Skip validation rather than blocking tool usage.
      debugLogger.warn(
        `Failed to compile schema (${
          (schema as Record<string, unknown>)?.['$schema'] ?? '<no $schema>'
        }): ${error instanceof Error ? error.message : String(error)}. ` +
          'Skipping parameter validation.',
      );
      return null;
    }

    let valid = validate(data);
    if (!valid && validate.errors) {
      // Coerce mistyped values from LLMs (string booleans, string numbers,
      // stringified arrays/objects) before retrying validation.
      const dataRecord = data as Record<string, unknown>;
      fixMisnamedProperties(dataRecord, anySchema);
      fixBooleanValues(dataRecord);
      fixNumberValues(dataRecord, anySchema);
      fixStringifiedJsonValues(dataRecord, anySchema);

      valid = validate(data);
      if (!valid && validate.errors) {
        return validator.errorsText(validate.errors, { dataVar: 'params' });
      }
    }
    return null;
  }
}

/**
 * Coerces string boolean values to actual booleans.
 * This handles cases where LLMs return "true"/"false" strings instead of boolean values,
 * which is common with self-hosted LLMs.
 *
 * Converts:
 * - "true", "True", "TRUE" -> true
 * - "false", "False", "FALSE" -> false
 */
function fixBooleanValues(data: Record<string, unknown>) {
  for (const key of Object.keys(data)) {
    if (!(key in data)) continue;
    const value = data[key];

    if (typeof value === 'object' && value !== null) {
      fixBooleanValues(value as Record<string, unknown>);
    } else if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true') {
        data[key] = true;
      } else if (lower === 'false') {
        data[key] = false;
      }
    }
  }
}

/**
 * Known parameter name aliases that LLMs commonly use instead of the correct names.
 * Maps alias → canonical name. Only applied when the canonical name is a valid
 * schema property and not already present in the data.
 */
const PARAM_ALIASES: Record<string, string> = {
  abs_path: 'absolute_path',
  file_path: 'absolute_path',
  path: 'absolute_path',
  file: 'absolute_path',
  agent_type: 'subagent_type',
  type: 'subagent_type',
};

/**
 * Remaps misnamed parameter keys to their correct schema property names.
 * Uses a hardcoded alias map for known LLM mistakes, then falls back to
 * Levenshtein distance matching for typos (e.g., "absolut_path" → "absolute_path").
 */
function fixMisnamedProperties(
  data: Record<string, unknown>,
  schema: AnySchema,
): void {
  if (typeof schema !== 'object' || schema === null) return;
  const schemaObj = schema as Record<string, unknown>;
  const properties = schemaObj['properties'] as
    | Record<string, unknown>
    | undefined;
  if (!properties) return;

  const validKeys = Object.keys(properties);

  for (const dataKey of Object.keys(data)) {
    if (dataKey in properties) continue;

    // Check explicit aliases first
    const aliasTarget = PARAM_ALIASES[dataKey];
    if (aliasTarget && aliasTarget in properties && !(aliasTarget in data)) {
      data[aliasTarget] = data[dataKey];
      delete data[dataKey];
      continue;
    }

    // Fall back to Levenshtein distance matching
    let bestMatch: string | null = null;
    let bestDistance = Infinity;
    for (const validKey of validKeys) {
      if (validKey in data) continue;
      const distance = levenshtein.get(dataKey, validKey);
      const threshold = Math.max(2, Math.floor(validKey.length * 0.4));
      if (distance < bestDistance && distance <= threshold) {
        bestDistance = distance;
        bestMatch = validKey;
      }
    }

    if (bestMatch) {
      data[bestMatch] = data[dataKey];
      delete data[dataKey];
    }
  }
}

/**
 * Coerces string numeric values to actual numbers when the schema expects a number.
 * This handles cases where LLMs return "0", "42", "3.14" strings instead of number values.
 */
function fixNumberValues(
  data: Record<string, unknown>,
  schema: AnySchema,
): void {
  if (typeof schema !== 'object' || schema === null) return;
  const schemaObj = schema as Record<string, unknown>;
  const properties = schemaObj['properties'] as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!properties) return;

  for (const key of Object.keys(data)) {
    if (!(key in data) || !(key in properties)) continue;
    const propSchema = properties[key];
    const value = data[key];

    if (
      propSchema &&
      (propSchema['type'] === 'number' || propSchema['type'] === 'integer') &&
      typeof value === 'string'
    ) {
      const num = Number(value);
      if (!isNaN(num) && value.trim() !== '') {
        data[key] = num;
      }
    }
  }
}

/**
 * Coerces stringified JSON arrays/objects back to their proper types when the
 * schema expects an array or object. This handles cases where LLMs return
 * '[{"id":"1",...}]' as a string instead of an actual array value.
 */
function fixStringifiedJsonValues(
  data: Record<string, unknown>,
  schema: AnySchema,
): void {
  if (typeof schema !== 'object' || schema === null) return;
  const schemaObj = schema as Record<string, unknown>;
  const properties = schemaObj['properties'] as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!properties) return;

  for (const key of Object.keys(data)) {
    if (!(key in data) || !(key in properties)) continue;
    const propSchema = properties[key];
    const value = data[key];

    if (
      propSchema &&
      (propSchema['type'] === 'array' || propSchema['type'] === 'object') &&
      typeof value === 'string'
    ) {
      try {
        const parsed = JSON.parse(value);
        if (
          (propSchema['type'] === 'array' && Array.isArray(parsed)) ||
          (propSchema['type'] === 'object' &&
            typeof parsed === 'object' &&
            parsed !== null &&
            !Array.isArray(parsed))
        ) {
          data[key] = parsed;
        }
      } catch {
        // Not valid JSON, leave as-is
      }
    }
  }
}
