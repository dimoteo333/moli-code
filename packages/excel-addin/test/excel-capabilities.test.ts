import { describe, expect, it } from 'vitest';
import {
  EXCEL_API_VERSIONS,
  supportsNativeFillDown,
} from '../src/shared/excel-capabilities.js';

describe('Excel capability detection', () => {
  it('probes ExcelApi 1.9 and gates native fill-down on it', () => {
    expect(EXCEL_API_VERSIONS).toContain('1.9');
    expect(supportsNativeFillDown({ 'ExcelApi 1.9': true })).toBe(true);
    expect(supportsNativeFillDown({ 'ExcelApi 1.9': false })).toBe(false);
    expect(supportsNativeFillDown({})).toBe(false);
  });
});
