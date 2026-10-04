import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { prepareTechnicalMarkdown } from './technicalContent.js';

const parser = unified().use(remarkParse).use(remarkGfm);
const blocks = new Set(['heading', 'paragraph', 'code', 'table', 'thematicBreak', 'blockquote', 'listItem']);

function codeText(node, markdown) {
  const source = markdown.slice(node.position.start.offset, node.position.end.offset);
  const lines = source.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const opening = lines[0]?.replace(/\r?\n$/, '').match(/^ {0,3}(`{3,}|~{3,})([^\n]*)$/);
  if (!opening) return node.value;
  // Nested list/quote fences carry Markdown container indentation on later
  // lines. The parser's value has that layout removed from the actual code.
  if (node.position.start.column > 1) {
    const newline = source.includes('\r\n') ? '\r\n' : '\n';
    return node.value.replace(/\r?\n/g, newline);
  }
  const last = lines.at(-1)?.replace(/\r?\n$/, '').match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
  const closed = lines.length > 1 && last && last[1][0] === opening[1][0] && last[1].length >= opening[1].length;
  return lines.slice(1, closed ? -1 : undefined).join('');
}

/** Build a reading-order animation map and retain the code's source whitespace. */
export function createMarkdownContent(source = '') {
  const markdown = prepareTechnicalMarkdown(source);
  const tree = parser.parse(markdown);
  const revealIndexByOffset = new Map();
  const codeByOffset = new Map();
  let nextIndex = 7;
  function visit(node, animatedParent = false) {
    const offset = node.position?.start.offset;
    const selected = !animatedParent && blocks.has(node.type) && offset !== undefined;
    if (selected) revealIndexByOffset.set(offset, nextIndex++);
    if (node.type === 'code') {
      let text = codeText(node, markdown);
      // A virtual fence needs a line break before its closing marker, even if
      // the pasted source ended at EOF. That added break is not clipboard data.
      if (!source.endsWith('\n') && text.endsWith('\n')) {
        const raw = text.slice(0, text.endsWith('\r\n') ? -2 : -1);
        if (source.endsWith(raw)) text = raw;
      }
      codeByOffset.set(offset, { text, language: node.lang ?? '' });
    }
    for (const child of node.children ?? []) visit(child, animatedParent || selected);
  }
  visit(tree);
  return { markdown, revealIndexByOffset, codeByOffset, revealCount: nextIndex };
}
