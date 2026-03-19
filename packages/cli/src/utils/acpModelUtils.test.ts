/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { AuthType } from '@dobby/moli-code-core';
import {
  formatAcpModelId,
  parseAcpBaseModelId,
  parseAcpModelOption,
} from './acpModelUtils.js';

describe('acpModelUtils', () => {
  it('formats modelId(authType)', () => {
    expect(formatAcpModelId('moli3', AuthType.MOLI_OAUTH)).toBe(
      `moli3(${AuthType.MOLI_OAUTH})`,
    );
  });

  it('extracts base model id when string ends with parentheses', () => {
    expect(parseAcpBaseModelId(`moli3(${AuthType.USE_OPENAI})`)).toBe('moli3');
  });

  it('does not strip when parentheses are not a trailing suffix', () => {
    expect(parseAcpBaseModelId('moli3(x) y')).toBe('moli3(x) y');
  });

  it('parses modelId and validates authType', () => {
    expect(parseAcpModelOption(` moli3(${AuthType.USE_OPENAI}) `)).toEqual({
      modelId: 'moli3',
      authType: AuthType.USE_OPENAI,
    });
  });

  it('returns trimmed input as modelId when authType is invalid', () => {
    expect(parseAcpModelOption('moli3(not-a-real-auth)')).toEqual({
      modelId: 'moli3(not-a-real-auth)',
    });
  });
});
