import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVault, buildOutline } from '../src/data/vaultAdapter.js';
import { classifyTechnicalContent, tokenizeInlineTechnical, prepareTechnicalMarkdown } from '../src/data/technicalContent.js';
import { unified } from 'unified';
import remarkParse from 'remark-parse';

test('the raw note Markdown and fenced outline code preserve original indentation and CRLF', () => {
  const json = '{\r\n  "path": "C:\\\\fixture\\\\config",\r\n  "enabled": true\r\n}\r\n';
  const markdown = `# 服务配置\r\n前文。\r\n\r\n\`\`\`json title=config\r\n${json}\`\`\`\r\n\r\n后文。\r\n`;
  const vault = buildVault([{ path: '06-Skills/demo/SKILL.md', content: `---\r\ntitle: 测试配置\r\n---\r\n${markdown}` }]);
  assert.equal(vault.notes[0].markdown, markdown);
  const children = vault.notes[0].outline[0].children;
  assert.equal(children[0].text, '前文。');
  assert.deepEqual(children[1], { kind: 'code', text: json, language: 'json title=config', done: false });
  assert.equal(children[2].text, '后文。');
  assert.deepEqual(JSON.parse(children[1].text), { path: 'C:\\fixture\\config', enabled: true });
});

test('fences separate prose and keep comments, short inner markers and unclosed code intact', () => {
  const body = '前言\n````powershell\n# command comment\n    $config = @{}\n```\n\nWrite-Output $config';
  const section = buildOutline(body, '说明')[0];
  assert.equal(section.text, '说明');
  assert.equal(section.children[0].text, '前言');
  assert.equal(section.children[1].kind, 'code');
  assert.equal(section.children[1].text, '# command comment\n    $config = @{}\n```\n\nWrite-Output $config');
  assert.equal(section.children[1].language, 'powershell');
  assert.equal(buildOutline('~~~sh\necho value\n~~~\n# 下一节', '标题').length, 2);
});

test('explicit technical languages win while plain text hints allow automatic detection', () => {
  assert.deepEqual(classifyTechnicalContent('{"ok": true}', 'bash'), { language: 'bash', label: 'Bash', kind: 'command' });
  assert.equal(classifyTechnicalContent('not valid json', 'json').language, 'json');
  assert.equal(classifyTechnicalContent('Get-Content -LiteralPath .\\config.json', 'text').language, 'powershell');
  assert.equal(classifyTechnicalContent('C:\\fixture\\config.json', 'plaintext').kind, 'path');
  assert.equal(classifyTechnicalContent('{"ok": true}', 'text').language, 'json');
  assert.deepEqual(classifyTechnicalContent('正常说明文字', 'text'), { language: 'text', label: '文本', kind: 'text' });
});

test('automatic JSON recognition requires a complete valid object or array', () => {
  assert.equal(classifyTechnicalContent('{\n  "port": 3000,\n  "enabled": true\n}').language, 'json');
  assert.equal(classifyTechnicalContent('[{"path":"C:\\\\fixture"}]').language, 'json');
  for (const value of ['{"port": 3000,}', '{port: 3000}', 'true', '"hello"', '[参考资料]']) assert.equal(classifyTechnicalContent(value).kind, 'text', value);
});

test('standalone Windows, UNC, Unix and relative filenames are recognized as paths', () => {
  for (const path of ['C:\\fixture\\config.json', 'D:/fixture/file.md', '\\\\fixture-host\\share\\file.toml', '%APPDATA%\\obsidian\\config.json', '$env:APPDATA\\obsidian', '/etc/systemd/system/example.service', '~/.config/demo/config.json', './scripts/start.sh', '../config.json', 'src/data/config.json', '"C:\\Program Files\\Fixture\\config.ini"']) assert.equal(classifyTechnicalContent(path).kind, 'path', path);
  for (const prose of ['read/write', '研发/发布', 'API / v2', 'https://example.com/file.json', 'we should read notes']) assert.equal(classifyTechnicalContent(prose).kind, 'text', prose);
  assert.deepEqual(classifyTechnicalContent('C:\\Demo Vault\\config.json\n/etc/fixture/config.json\n~/.config/fixture/config.json\n', 'text'), { language: 'text', label: '文件路径', kind: 'path' });
});

test('common command and configuration syntax receives a specific readable label', () => {
  assert.equal(classifyTechnicalContent('npm run dev').language, 'bash');
  assert.equal(classifyTechnicalContent('git status\ndocker compose up -d').kind, 'command');
  assert.equal(classifyTechnicalContent('curl https://example.com').kind, 'command');
  assert.equal(classifyTechnicalContent('ssh fixture-host').kind, 'command');
  assert.equal(classifyTechnicalContent('Get-Content -LiteralPath "C:\\fixture\\config.json"').language, 'powershell');
  assert.equal(classifyTechnicalContent('cmd /c dir').language, 'cmd');
  assert.equal(classifyTechnicalContent('dir C:\\fixture').language, 'cmd');
  assert.equal(classifyTechnicalContent('[Service]\nType=simple\nExecStart=/usr/bin/fixture').language, 'ini');
  assert.equal(classifyTechnicalContent('[mcp_servers.fixture]\ncommand="node"').language, 'toml');
  assert.equal(classifyTechnicalContent('server:\n  host: localhost\n  port: 3000').language, 'yaml');
  assert.equal(classifyTechnicalContent('PORT=3000\nHOST=localhost').kind, 'config');
  for (const prose of ['git improves collaboration', 'Note: this is ordinary prose', 'we run npm commands to build', '今日计划：学习服务配置']) assert.equal(classifyTechnicalContent(prose).kind, 'text', prose);
});

test('inline tokenization is lossless and avoids existing code, destinations and prose lookalikes', () => {
  const text = '配置路径 C:\\fixture\\config.json，日志在 /var/log/fixture.log。\n命令：npm run dev\n`C:\\existing\\code.json` [打开](./other/config.json) [[03-资源/README]] https://example.com/file.json read/write';
  const tokens = tokenizeInlineTechnical(text);
  assert.equal(tokens.map(({ text }) => text).join(''), text);
  assert.deepEqual(tokens.filter(({ kind }) => kind === 'path').map(({ text }) => text), ['C:\\fixture\\config.json', '/var/log/fixture.log']);
  assert.deepEqual(tokens.filter(({ kind }) => kind === 'command').map(({ text }) => text), ['npm run dev']);
  assert.deepEqual(tokenizeInlineTechnical('普通说明和 read/write，没有路径。'), [{ kind: 'text', text: '普通说明和 read/write，没有路径。' }]);
  const spaced = '配置位于 C:\\Program Files\\Fixture\\config.json，随后启动。';
  assert.deepEqual(tokenizeInlineTechnical(spaced).filter(({ kind }) => kind === 'path').map(({ text }) => text), ['C:\\Program Files\\Fixture\\config.json']);
  assert.ok(prepareTechnicalMarkdown('**C:\\fixture\\config.json**').includes('**`C:\\fixture\\config.json`**'));
});

test('render preparation adds virtual blocks to bare JSON, commands, paths and configurations', () => {
  const source = '服务配置说明。\n{\n  "port": 3000,\n  "path": "C:\\\\fixture"\n}\n\nnpm run dev\ncurl https://example.com\n\n\\\\fixture-host\\share\\config.json\n\n[Service]\nType=simple\nExecStart=/usr/bin/fixture\n';
  const prepared = prepareTechnicalMarkdown(source);
  assert.match(prepared, /```json\n\{\n  "port": 3000,/);
  assert.match(prepared, /```bash\nnpm run dev\ncurl https:\/\/example\.com\n```/);
  assert.ok(prepared.includes('```path\n\\\\fixture-host\\share\\config.json\n```'));
  assert.match(prepared, /```ini\n\[Service\]\nType=simple/);
  assert.equal(source.includes('```'), false, 'the input string is not rewritten');
  assert.equal(prepareTechnicalMarkdown(prepared), prepared, 'repeated render preparation is idempotent');
  const outline = buildOutline(prepared, '测试');
  const codes = outline.flatMap(({ children }) => children).filter(({ kind }) => kind === 'code');
  assert.equal(codes.length, 4);
  assert.equal(JSON.parse(codes[0].text).path, 'C:\\fixture');
});

test('render preparation preserves existing fences, inline code, URLs and Markdown link destinations', () => {
  const source = '```text\r\nC:\\fixture\\existing.json\r\n```\r\n\n`C:\\fixture\\inline.json` [link](../dest/file.json) [[06-Skills/demo/SKILL]]\n[ref]: ../dest/second.json\nhttps://example.com/file.json\n';
  assert.equal(prepareTechnicalMarkdown(source), source);
  assert.equal(prepareTechnicalMarkdown('未闭合。\n```sh\n# 内部原样\nC:\\fixture\\config.json'), '未闭合。\n```sh\n# 内部原样\nC:\\fixture\\config.json');
});

test('render preparation identifies naked inline paths and keeps raw HTML literal', () => {
  const source = '日志位于 /var/log/fixture.log，配置在 C:\\fixture\\config.json。\n\n<script>alert("fixture")</script>\n\n普通文本中的 <b>标签</b> 保留。';
  const prepared = prepareTechnicalMarkdown(source);
  assert.ok(prepared.includes('`/var/log/fixture.log`'));
  assert.ok(prepared.includes('`C:\\fixture\\config.json`'));
  assert.ok(prepared.includes('```html\n<script>alert("fixture")</script>\n```'));
  assert.ok(prepared.includes('`<b>`标签`</b>`'));
  const prose = '这是普通笔记。\n\n## 计划\n明天阅读文档，路径与命令随后补充。\nNote: this is ordinary prose\n研发/发布';
  assert.equal(prepareTechnicalMarkdown(prose), prose);
});

test('CommonMark nested fences, indented code and multiline code spans remain untouched', () => {
  const examples = [
    '- 步骤\n\n    ```json\n    {"enabled":true}\n    ```\n',
    '> ```powershell\n> Get-Content .\\config.json\n> ```\n',
    '前文\n\n    C:\\Demo Vault\\config.json\n    Get-Content -LiteralPath .\\settings.json\n',
    '使用 `\nC:\\Demo Vault\\settings.json\n` 来配置。\n',
  ];
  const parser = unified().use(remarkParse);
  const codes = (tree) => [tree.type === 'code' || tree.type === 'inlineCode' ? tree.value : null, ...(tree.children ?? []).flatMap(codes)].filter((value) => value !== null);
  for (const source of examples) {
    const prepared = prepareTechnicalMarkdown(source);
    assert.equal(prepared, source);
    assert.deepEqual(codes(parser.parse(prepared)), codes(parser.parse(source)), 'existing copy values are identical after preparation');
  }
});

test('unfenced command continuation lines stay in one complete copyable block with the right shell', () => {
  const commands = [
    { language: 'bash', source: 'curl \\\n  --header "Content-Type: application/json" \\\n  https://example.com/api\n' },
    { language: 'powershell', source: 'Get-Content `\r\n  -LiteralPath "C:\\Demo Vault\\config.json" `\r\n  -Raw\r\n' },
    { language: 'cmd', source: 'node tools.js ^\n  --config "C:\\Demo Vault\\config.json" ^\n  --verbose\n' },
  ];
  for (const { source, language } of commands) {
    assert.equal(classifyTechnicalContent(source).language, language);
    const prepared = prepareTechnicalMarkdown(source);
    assert.ok(prepared.startsWith('```' + language));
    const blocks = buildOutline(prepared, '命令')[0].children;
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].text, source, 'continuation args and original line endings are kept exactly');
    assert.equal(prepareTechnicalMarkdown(prepared), prepared);
  }
});

test('ordinary English hints remain prose and filenames with spaces are not truncated or padded with commentary', () => {
  const prose = 'Note: this is ordinary prose\nTip: read the docs first\n';
  assert.equal(classifyTechnicalContent(prose).kind, 'text');
  assert.equal(prepareTechnicalMarkdown(prose), prose);
  assert.equal(classifyTechnicalContent('C:\\Demo Vault\\settings.json 是配置文件。').kind, 'text');
  const source = '配置路径是 C:\\Demo Vault\\my settings.json，然后读取。';
  assert.deepEqual(tokenizeInlineTechnical(source).filter(({ kind }) => kind === 'path').map(({ text }) => text), ['C:\\Demo Vault\\my settings.json']);
  const suffix = 'C:\\Demo Vault\\settings.json 是配置文件。';
  assert.deepEqual(tokenizeInlineTechnical(suffix).filter(({ kind }) => kind === 'path').map(({ text }) => text), ['C:\\Demo Vault\\settings.json']);
  assert.ok(prepareTechnicalMarkdown(suffix).startsWith('`C:\\Demo Vault\\settings.json` 是配置文件。'));
});
