/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { parseXmlToolCalls, containsXmlToolCall } from './xmlToolCallParser.js';

describe('xmlToolCallParser', () => {
  describe('containsXmlToolCall', () => {
    it('should detect XML function calls', () => {
      expect(
        containsXmlToolCall(
          '<function=todo_write>\n<parameter=todos>\ntest\n</parameter>\n</function>',
        ),
      ).toBe(true);
    });

    it('should return false for regular text', () => {
      expect(containsXmlToolCall('Hello, this is regular text')).toBe(false);
    });

    it('should return false for incomplete tags', () => {
      expect(containsXmlToolCall('<function>')).toBe(false);
    });
  });

  describe('parseXmlToolCalls', () => {
    it('should parse a complete XML tool call', () => {
      const text = `I'll add that file.
<function=todo_write>
<parameter=todos>
[{"id": "1", "content": "Fix bug"}]
</parameter>
</function>`;

      const { calls, remainingText } = parseXmlToolCalls(text);
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe('todo_write');
      expect(calls[0].args['todos']).toEqual([{ id: '1', content: 'Fix bug' }]);
      expect(remainingText.trim()).toBe("I'll add that file.");
    });

    it('should parse tool call with multiple parameters', () => {
      const text = `<function=edit_file>
<parameter=path>
src/auth.py
</parameter>
<parameter=old_content>
old code
</parameter>
<parameter=new_content>
new code
</parameter>
</function>`;

      const { calls } = parseXmlToolCalls(text);
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe('edit_file');
      expect(calls[0].args['path']).toBe('src/auth.py');
      expect(calls[0].args['old_content']).toBe('old code');
      expect(calls[0].args['new_content']).toBe('new code');
    });

    it('should parse tool call with Windows paths', () => {
      const text = `<function=todo_write>
<parameter=todos>
C:\\Users\\abc\\test.sql
</parameter>
</function>`;

      const { calls } = parseXmlToolCalls(text);
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe('todo_write');
      expect(calls[0].args['todos']).toBe('C:\\Users\\abc\\test.sql');
    });

    it('should handle incomplete XML (no closing function tag)', () => {
      const text = `<function=run_shell_command>
<parameter=command>
npm test
</parameter>`;

      const { calls } = parseXmlToolCalls(text);
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe('run_shell_command');
      expect(calls[0].args['command']).toBe('npm test');
    });

    it('should handle incomplete parameter tag', () => {
      const text = `<function=read_file>
<parameter=path>
src/main.ts`;

      const { calls } = parseXmlToolCalls(text);
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe('read_file');
      expect(calls[0].args['path']).toBe('src/main.ts');
    });

    it('should parse boolean parameter values', () => {
      const text = `<function=shell>
<parameter=command>
echo hello
</parameter>
<parameter=is_background>
true
</parameter>
</function>`;

      const { calls } = parseXmlToolCalls(text);
      expect(calls[0].args['is_background']).toBe(true);
    });

    it('should parse numeric parameter values', () => {
      const text = `<function=read_file>
<parameter=path>
test.ts
</parameter>
<parameter=offset>
10
</parameter>
<parameter=limit>
50
</parameter>
</function>`;

      const { calls } = parseXmlToolCalls(text);
      expect(calls[0].args['offset']).toBe(10);
      expect(calls[0].args['limit']).toBe(50);
    });

    it('should return empty calls for text without tool calls', () => {
      const text = 'This is just regular text without any tool calls.';
      const { calls, remainingText } = parseXmlToolCalls(text);
      expect(calls).toHaveLength(0);
      expect(remainingText).toBe(text);
    });

    it('should handle empty text', () => {
      const { calls, remainingText } = parseXmlToolCalls('');
      expect(calls).toHaveLength(0);
      expect(remainingText).toBe('');
    });

    it('should handle multiple tool calls in one response', () => {
      const text = `Let me check those files.
<function=read_file>
<parameter=path>
file1.ts
</parameter>
</function>

<function=read_file>
<parameter=path>
file2.ts
</parameter>
</function>`;

      const { calls } = parseXmlToolCalls(text);
      expect(calls).toHaveLength(2);
      expect(calls[0].name).toBe('read_file');
      expect(calls[0].args['path']).toBe('file1.ts');
      expect(calls[1].name).toBe('read_file');
      expect(calls[1].args['path']).toBe('file2.ts');
    });

    it('should preserve surrounding text', () => {
      const text = `I'll do this in two steps.

First, let me read the file.
<function=read_file>
<parameter=path>
config.json
</parameter>
</function>

Then I'll update it.`;

      const { calls, remainingText } = parseXmlToolCalls(text);
      expect(calls).toHaveLength(1);
      expect(remainingText).toContain("I'll do this in two steps.");
      expect(remainingText).toContain('First, let me read the file.');
      expect(remainingText).toContain("Then I'll update it.");
    });

    it('should handle multi-line parameter values', () => {
      const text = `<function=write_file>
<parameter=path>
output.txt
</parameter>
<parameter=content>
Line 1
Line 2
Line 3
</parameter>
</function>`;

      const { calls } = parseXmlToolCalls(text);
      expect(calls[0].args['content']).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should handle JSON array parameter', () => {
      const text = `<function=todo_write>
<parameter=todos>
[{"path": "a.ts", "task": "fix"}, {"path": "b.ts", "task": "refactor"}]
</parameter>
</function>`;

      const { calls } = parseXmlToolCalls(text);
      expect(calls[0].args['todos']).toEqual([
        { path: 'a.ts', task: 'fix' },
        { path: 'b.ts', task: 'refactor' },
      ]);
    });
  });
});
