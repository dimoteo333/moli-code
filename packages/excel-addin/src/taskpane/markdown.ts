/**
 * Minimal Markdown to HTML renderer for assistant messages (ES5/IE11-safe,
 * no dependencies). Supports: headings, bold, italic, strikethrough, inline
 * code, fenced code blocks, unordered/ordered lists, blockquotes, links and
 * horizontal rules. Everything is HTML-escaped first; the only markup in
 * the output is what this renderer generates.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Non-code inline formatting on an already HTML-escaped fragment. */
function formatText(escaped: string): string {
  let text = escaped;
  // Links: only http(s) targets, label already escaped.
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  // Bold before italic so ** is not consumed as two *.
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  text = text.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  return text;
}

/**
 * Inline formatting on an already HTML-escaped line. The line is split on
 * backticks so inline-code contents are never touched by the other rules:
 * odd segments with a closing backtick are code, everything else is text.
 */
function renderInline(escaped: string): string {
  const parts = escaped.split('`');
  let html = '';
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1 && i + 1 < parts.length) {
      html += '<code>' + parts[i] + '</code>';
    } else if (i % 2 === 1) {
      // Unpaired trailing backtick: keep it literal.
      html += formatText('`' + parts[i]);
    } else {
      html += formatText(parts[i]);
    }
  }
  return html;
}

interface ListState {
  ordered: boolean;
  html: string[];
}

/** Render a full markdown document to an HTML string. */
export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];

  let inCode = false;
  let codeLines: string[] = [];
  let list: ListState | null = null;
  let paragraph: string[] = [];
  let quote: string[] = [];

  function flushParagraph(): void {
    if (paragraph.length > 0) {
      out.push('<p>' + paragraph.join('<br>') + '</p>');
      paragraph = [];
    }
  }

  function flushList(): void {
    if (list) {
      const tag = list.ordered ? 'ol' : 'ul';
      out.push(
        '<' +
          tag +
          '><li>' +
          list.html.join('</li><li>') +
          '</li></' +
          tag +
          '>',
      );
      list = null;
    }
  }

  function flushQuote(): void {
    if (quote.length > 0) {
      out.push('<blockquote>' + quote.join('<br>') + '</blockquote>');
      quote = [];
    }
  }

  function flushAll(): void {
    flushParagraph();
    flushList();
    flushQuote();
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inCode) {
      if (/^\s*```/.test(line)) {
        out.push(
          '<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>',
        );
        codeLines = [];
        inCode = false;
      } else {
        codeLines.push(line);
      }
      continue;
    }

    if (/^\s*```/.test(line)) {
      flushAll();
      inCode = true;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      // h1/h2 are too large for the pane; clamp to h3-h6.
      const level = Math.min(heading[1].length + 2, 6);
      out.push(
        '<h' +
          level +
          '>' +
          renderInline(escapeHtml(heading[2])) +
          '</h' +
          level +
          '>',
      );
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushAll();
      out.push('<hr>');
      continue;
    }

    const quoted = /^\s*>\s?(.*)$/.exec(line);
    if (quoted) {
      flushParagraph();
      flushList();
      quote.push(renderInline(escapeHtml(quoted[1])));
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = bullet ? null : /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      flushQuote();
      const ordered = !!numbered;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, html: [] };
      }
      const itemText = bullet ? bullet[1] : (numbered as RegExpExecArray)[1];
      list.html.push(renderInline(escapeHtml(itemText)));
      continue;
    }

    if (!/\S/.test(line)) {
      flushAll();
      continue;
    }

    // Indented continuation of a list item stays inside the item.
    if (list && /^\s{2,}\S/.test(line)) {
      list.html[list.html.length - 1] +=
        '<br>' + renderInline(escapeHtml(line.replace(/^\s+/, '')));
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(renderInline(escapeHtml(line)));
  }

  if (inCode) {
    // Unterminated fence (mid-stream): render what we have.
    out.push(
      '<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>',
    );
  }
  flushAll();

  return out.join('');
}

/**
 * Replace a node's content with the rendered markdown. Typed structurally
 * (not HTMLElement) so this module stays DOM-free — it is also compiled
 * into the sidecar tsconfig program via the test suite.
 */
export function renderMarkdownInto(
  node: { innerHTML: string },
  markdown: string,
): void {
  node.innerHTML = renderMarkdown(markdown);
}
