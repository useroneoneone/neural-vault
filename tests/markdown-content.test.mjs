import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMarkdownContent } from '../src/data/markdownContent.js';

test('reading-order reveals count visible blocks once and skip nested paragraph animations', () => {
  const model = createMarkdownContent('# 配置\n\n说明\n\n- 第一项\n  - 内层\n- 第二项\n\n> 引用\n>\n> 另一个段落\n\n```json\n{"port":8787}\n```\n');
  assert.equal(model.revealCount, 13);
  assert.deepEqual([...model.revealIndexByOffset.values()], [7, 8, 9, 10, 11, 12]);
  assert.equal(model.codeByOffset.size, 1);
});

test('fenced source copied with original CRLF, indentation, trailing newline and backslashes', () => {
  const source = '# 示例\r\n\r\n```json\r\n{\r\n  "path": "C:\\\\Demo\\\\config.json"\r\n}\r\n```\r\n';
  const model = createMarkdownContent(source);
  assert.equal(model.markdown, source);
  assert.equal([...model.codeByOffset.values()][0].text, '{\r\n  "path": "C:\\\\Demo\\\\config.json"\r\n}\r\n');
});

test('unclosed and nested fences retain code content without fence markers', () => {
  const unclosed = createMarkdownContent('```sh\nprintf "done"\n  # retained');
  assert.equal([...unclosed.codeByOffset.values()][0].text, 'printf "done"\n  # retained');
  const nested = createMarkdownContent('- 服务\n\n    ```json\n    {"port":8787}\n    ```\n');
  assert.equal(nested.codeByOffset.size, 1);
  assert.equal([...nested.codeByOffset.values()][0].text.trim(), '{"port":8787}');
});

test('automatically detected EOF blocks copy no synthetic fence newline', () => {
  for (const source of ['C:\\Demo Vault\\settings.json', 'systemctl status neural-preview.service', '{"port":8787}']) {
    const model = createMarkdownContent(source);
    assert.equal([...model.codeByOffset.values()][0].text, source);
  }
});

test('rendered technical blocks show language labels, syntax tokens and accessible copy controls safely', async () => {
  await mkdir(path.resolve('.codex-preview'), { recursive: true });
  const directory = await mkdtemp(path.resolve('.codex-preview/render-test-'));
  try {
    const output = path.join(directory, 'content.mjs');
    const bundle = await build({ entryPoints: ['src/components/NoteContent.jsx'], bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', write: false });
    await writeFile(output, bundle.outputFiles[0].text);
    const { default: NoteContent } = await import(pathToFileURL(output).href);
    const model = createMarkdownContent('# 说明\n\n路径：C:\\Demo Vault\\config.json。\n\n{"enabled":true,"port":8787}\n\nsystemctl status neural-preview.service\n\n```unknown\n<script>alert("literal")</script>\n```\n\n| 字段 | 值 |\n| --- | --- |\n| 状态 | 正常 |');
    const html = renderToStaticMarkup(React.createElement(NoteContent, { model, color: '#e9a4ca', reveal: () => ({}) }));
    assert.match(html, /aria-label="复制文件路径"/);
    assert.match(html, /aria-label="复制JSON"/);
    assert.match(html, /aria-label="复制Bash"/);
    assert.match(html, /data-language="unknown"/);
    assert.match(html, /hljs-attr/);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /<script[\s>]/);
    assert.match(html, /note-table-wrap/);
    assert.doesNotMatch(html, /<p[^>]*><div/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
