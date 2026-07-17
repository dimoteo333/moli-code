import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/taskpane/markdown.js';

describe('renderMarkdown', () => {
  it('renders paragraphs and line breaks', () => {
    expect(renderMarkdown('안녕하세요\n반갑습니다')).toBe(
      '<p>안녕하세요<br>반갑습니다</p>',
    );
    expect(renderMarkdown('첫 문단\n\n둘째 문단')).toBe(
      '<p>첫 문단</p><p>둘째 문단</p>',
    );
  });

  it('renders headings clamped to h3-h6', () => {
    expect(renderMarkdown('# 제목')).toBe('<h3>제목</h3>');
    expect(renderMarkdown('## 소제목')).toBe('<h4>소제목</h4>');
    expect(renderMarkdown('###### 깊은 제목')).toBe('<h6>깊은 제목</h6>');
  });

  it('renders bold, italic, strikethrough and inline code', () => {
    expect(renderMarkdown('**굵게** 그리고 *기울임*')).toBe(
      '<p><strong>굵게</strong> 그리고 <em>기울임</em></p>',
    );
    expect(renderMarkdown('~~취소~~')).toBe('<p><s>취소</s></p>');
    expect(renderMarkdown('코드 `a < b` 입니다')).toBe(
      '<p>코드 <code>a &lt; b</code> 입니다</p>',
    );
  });

  it('does not format markdown inside inline code', () => {
    expect(renderMarkdown('`**not bold**`')).toBe(
      '<p><code>**not bold**</code></p>',
    );
  });

  it('renders unordered and ordered lists', () => {
    expect(renderMarkdown('- 하나\n- 둘')).toBe(
      '<ul><li>하나</li><li>둘</li></ul>',
    );
    expect(renderMarkdown('1. 하나\n2. 둘')).toBe(
      '<ol><li>하나</li><li>둘</li></ol>',
    );
  });

  it('renders fenced code blocks without inline formatting', () => {
    expect(renderMarkdown('```\n**x** <tag>\n```')).toBe(
      '<pre><code>**x** &lt;tag&gt;</code></pre>',
    );
  });

  it('renders an unterminated fence while streaming', () => {
    expect(renderMarkdown('```\nSUM(A1:A10)')).toBe(
      '<pre><code>SUM(A1:A10)</code></pre>',
    );
  });

  it('renders blockquotes and horizontal rules', () => {
    expect(renderMarkdown('> 인용문')).toBe('<blockquote>인용문</blockquote>');
    expect(renderMarkdown('---')).toBe('<hr>');
  });

  it('renders http(s) links only', () => {
    expect(renderMarkdown('[문서](https://example.com/a)')).toBe(
      '<p><a href="https://example.com/a" target="_blank" rel="noopener noreferrer">문서</a></p>',
    );
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('<a ');
  });

  it('escapes raw HTML', () => {
    expect(renderMarkdown('<script>alert(1)</script>')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    );
    expect(renderMarkdown('a < b & c > d')).toBe(
      '<p>a &lt; b &amp; c &gt; d</p>',
    );
  });

  it('keeps an unpaired backtick literal', () => {
    expect(renderMarkdown('값은 `A1 입니다')).toBe('<p>값은 `A1 입니다</p>');
  });

  it('renders GFM tables', () => {
    expect(renderMarkdown('| 항목 | 금액 |\n|---|---|\n| 사과 | 500 |')).toBe(
      '<div class="mc-table-wrap"><table><thead><tr>' +
        '<th>항목</th><th>금액</th></tr></thead><tbody>' +
        '<tr><td>사과</td><td>500</td></tr></tbody></table></div>',
    );
  });

  it('applies table column alignment and inline formatting', () => {
    const html = renderMarkdown(
      '| a | b | c |\n|:---:|---:|---|\n| **x** | 1 | `y` |',
    );
    expect(html).toContain('<th style="text-align:center">a</th>');
    expect(html).toContain('<th style="text-align:right">b</th>');
    expect(html).toContain(
      '<td style="text-align:center"><strong>x</strong></td>',
    );
    expect(html).toContain('<td><code>y</code></td>');
  });

  it('pads short table rows and stops at non-table lines', () => {
    const html = renderMarkdown('| a | b |\n|---|---|\n| 1 |\n끝');
    expect(html).toBe(
      '<div class="mc-table-wrap"><table><thead><tr>' +
        '<th>a</th><th>b</th></tr></thead><tbody>' +
        '<tr><td>1</td><td></td></tr></tbody></table></div><p>끝</p>',
    );
  });

  it('leaves pipe lines without a separator as text', () => {
    expect(renderMarkdown('a | b\nc | d')).toBe('<p>a | b<br>c | d</p>');
  });

  it('escapes HTML inside table cells', () => {
    const html = renderMarkdown('| x | y |\n|---|---|\n| <b>bad</b> | ok |');
    expect(html).toContain('<td>&lt;b&gt;bad&lt;/b&gt;</td>');
    expect(html).not.toContain('<b>');
  });
});
