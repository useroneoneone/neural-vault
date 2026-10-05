import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVault, buildOutline, countWords, parseMarkdown } from '../src/data/vaultAdapter.js';
import { CATEGORIES, categoryForPath, discoverCategories } from '../src/data/categories.js';

const record = (path, content = '', extra = {}) => ({ path, content, stat: { mtime: Date.parse('2026-10-03T20:00:00Z') }, ...extra });

test('actual roots flatten nested notes and preserve the existing six visual presets', () => {
  const vault = buildVault([
    record('01-项目/深层/再一层/README.md', '---\ntitle: 真正的项目标题\n---\n# 标题\n正文'),
    record('02-资产/README.md', '# 资产框架说明'),
    record('03-资源/来源/资料.md', '# 资料'),
    record('04-辅助/维护/检查.md', '# 检查'),
    record('05-灵感/想法.md', '# 想法'),
    record('06-Skills/工作流/SKILL.md', '# 可重复流程'),
    record('Daily/2026-10-04.md', '# 日记'),
    record('Ideas/outside.md', '# 新目录'),
    record('index.md', '# 总索引'),
  ]);
  assert.deepEqual(vault.categories.map(({ name, count }) => [name, count]), [['01-项目', 1], ['02-资产', 1], ['03-资源', 1], ['04-辅助', 1], ['05-灵感', 1], ['06-Skills', 1], ['Daily', 1], ['Ideas', 1], ['根目录', 1]]);
  const note = vault.notes.find((entry) => entry.cat === 'projects');
  assert.equal(note.id, '01-项目/深层/再一层/README.md');
  assert.equal(note.path, note.id);
  assert.equal(note.folder, '01-项目');
  assert.equal(note.title, '真正的项目标题');
  assert.equal(vault.stats.notes, 9);
  assert.equal(vault.notes.find(({ path }) => path === 'index.md').cat, 'vault-root');
  assert.equal(vault.notes.find(({ path }) => path === 'index.md').folder, '根目录');
  assert.equal(categoryForPath('06-Skills\\流程\\SKILL.md').id, 'skills');
  assert.equal(categoryForPath('skills/a.md').id, 'skills');
  assert.equal(categoryForPath('Daily/01-项目/a.md'), null);
  assert.deepEqual(CATEGORIES.slice(0, 5).map(({ pos }) => pos), [[0, -1], [-1, -0.02], [-0.74, 0.5], [1, -0.02], [0.72, 0.5]]);
});

test('real wiki and Markdown links resolve aliases, fragments, relative paths and repeated links', () => {
  const project = '01-项目/nested/项目.md';
  const asset = '02-资产/成果.md';
  const reference = '03-资源/资料 B.md';
  const content = '[[02-资产/成果|成果别名]] [[02-资产/成果#摘要]]\n[跨目录](../../03-资源/资料%20B.md#heading)\n[外网](https://example.com) ![[图.png]] [[#本页]]\n[参考][ref]\n[ref]: <../../03-资源/资料 B.md>\n[[未完成主题]] [[index]]\n```md\n[[代码不是链接]]\n```';
  const vault = buildVault([
    record(project, content),
    record(asset, `[[${project}]]`),
    record(reference),
    { path: 'index.md' },
  ]);
  const notes = Object.fromEntries(vault.notes.map((note) => [note.id, note]));
  assert.deepEqual(new Set(notes[project].out), new Set([asset, reference, 'index.md']));
  assert.equal(notes[project].backlinks, 1);
  assert.equal(notes[asset].backlinks, 1, 'repeated citations do not duplicate graph relationships');
  assert.equal(notes[reference].backlinks, 1);
  assert.equal(vault.edges.length, 3);
  assert.equal(vault.stats.links, 4);
  assert.equal(vault.stats.mutual, 1);
  assert.equal(notes[project].mutual, 1);
  assert.deepEqual(vault.unresolved, ['未完成主题']);
});

test('full paths disambiguate repeated README and SKILL filenames', () => {
  const vault = buildVault([
    record('01-项目/README.md', '[[README]] [[06-Skills/a/SKILL]] [[b/SKILL]]'),
    record('02-资产/README.md'),
    record('06-Skills/a/SKILL.md'),
    record('06-Skills/b/SKILL.md'),
  ]);
  const note = vault.notes.find(({ cat }) => cat === 'projects');
  assert.deepEqual(new Set(note.out), new Set(['06-Skills/a/SKILL.md', '06-Skills/b/SKILL.md']));
  assert.equal(vault.stats.unresolved, 0);
});

test('Obsidian resolvedLinks are authoritative and never fall back to guesses', () => {
  const a = '01-项目/a.md';
  const b = '02-资产/b.md';
  const c = '03-资源/c.md';
  const records = [record(a, `[[${b}]]`), record(b), record(c)];
  const vault = buildVault(records, { resolvedLinks: { [a]: { [c]: 4 }, [b]: { [a]: 1 }, [c]: { [a]: 0 } } });
  assert.deepEqual(vault.notes.find(({ id }) => id === a).out, [c]);
  assert.equal(vault.notes.find(({ id }) => id === c).backlinks, 1);
  assert.equal(vault.stats.links, 2);
  assert.equal(buildVault(records, { resolvedLinks: {} }).stats.links, 0);
  const ambiguous = buildVault([record(a, '[[README]]'), record('02-资产/README.md'), record('03-资源/README.md')], { resolvedLinks: { [a]: { '02-资产/README.md': 1 } } });
  assert.equal(ambiguous.stats.unresolved, 0, 'metadata-resolved duplicate names are not reported as missing');
});

test('word counts use body text and real labels instead of frontmatter, markup or destinations', () => {
  const { body } = parseMarkdown('---\ntitle: 不计入统计\ntags: [标签]\n---\n# 中文\nhello world [[path/目标|别名]] [link](https://example.com/a)');
  assert.equal(countWords(body), 7, '4 Chinese characters and 3 English words');
  assert.equal(countWords(''), 0);
  assert.equal(countWords('中文test-case AI\'s 2026'), 5);
});

test('metadata and body form a real outline without fictional progress or activity', () => {
  const vault = buildVault([record('02-资产/文件名.md', '---\ntitle: "成果标题"\ntags:\n - 资产\n - AI\nviews: 7\nupdated: 2026-09-30\nstatus: active\n---\n## 项目经历\n真实正文\n\n- 具体成果 #交付\n\n## 后续\n继续完善')]);
  const note = vault.notes[0];
  assert.equal(note.title, '成果标题');
  assert.deepEqual(note.tags, ['资产', 'AI', '交付']);
  assert.equal(note.views, 7);
  assert.equal(note.saves, 0);
  assert.equal(note.status, 'unread');
  assert.equal(note.updated, '2026-09-30');
  assert.equal(note.mtime, Date.parse('2026-10-03T20:00:00Z'));
  assert.deepEqual(note.activity, []);
  assert.deepEqual(note.stream, []);
  assert.deepEqual(note.outline.map(({ text }) => text), ['项目经历', '后续']);
  assert.equal(note.outline[0].children[0].text, '真实正文');
  assert.ok(note.outline.flatMap((section) => [section, ...section.children]).every(({ done }) => done === false));
  assert.equal(buildOutline('没有标题的正文', '笔记')[0].children[0].text, '没有标题的正文');
  assert.equal(buildOutline('', '空笔记').length, 1, 'empty notes keep the popup progress denominator nonzero');
  assert.deepEqual(buildOutline('# 标题\n```md\n# 代码中标题\n```', '笔记').map(({ text }) => text), ['标题']);
});

test('plugin metadata overrides simple YAML and recorded dates align with actual reading days', () => {
  const path = '06-Skills/flow/SKILL.md';
  const records = [record(path, '---\ntitle: 离线标题\n---\n# 原文', { frontmatter: { title: 'Obsidian 解析标题', tags: ['skills'], reading_status: 'read' } })];
  const vault = buildVault(records, { readingHistory: { [path]: { '2026-10-03': true, '2026-10-04': false } }, now: '2026-10-04' });
  assert.equal(vault.notes[0].title, 'Obsidian 解析标题');
  assert.equal(vault.notes[0].status, 'read');
  assert.deepEqual(vault.notes[0].activity.slice(-3), [0, 1, 0]);
  assert.equal(vault.notes[0].activity.length, 184);
  const before = JSON.stringify(records);
  buildVault(records);
  assert.equal(JSON.stringify(records), before, 'the adapter never mutates supplied records');
});

test('arbitrary roots, their empty folders and root notes form only actual categories', () => {
  const vault = buildVault([record('Research/deep/note.md', '# Research'), record('README.md', '# 首页')], { folders: ['Research', 'Empty Folder/deeper', { path: '另一个空目录' }, '/'] });
  assert.deepEqual(new Set(vault.categories.map(({ root }) => root)), new Set(['Research', 'Empty Folder', '另一个空目录', '']));
  assert.equal(vault.categories.find(({ root }) => root === 'Research').count, 1);
  assert.equal(vault.categories.find(({ root }) => root === 'Empty Folder').count, 0);
  assert.equal(vault.categories.find(({ root }) => root === '').isRoot, true);
  assert.equal(categoryForPath('Research/deep/note.md', vault.categories).root, 'Research');
  assert.equal(categoryForPath('README.md', vault.categories).id, 'vault-root');
  assert.equal(categoryForPath('Missing/note.md', vault.categories), null);
  assert.deepEqual(buildVault([]).categories, []);
  assert.deepEqual(buildVault([]).stats, { notes: 0, links: 0, mutual: 0, unresolved: 0 });
  assert.equal(buildVault([], { folders: ['Empty'] }).categories.length, 1);
  assert.equal(buildVault([], { folders: ['Empty'] }).categories[0].count, 0);
});

test('aliases and case variants are independent actual roots with collision-free IDs', () => {
  const records = [record('01-项目/a.md'), record('项目/a.md'), record('06-Skills/a.md'), record('skills/a.md'), record('Skills/a.md'), record('根目录/a.md'), record('root.md')];
  const vault = buildVault(records);
  assert.equal(vault.categories.length, 7);
  assert.equal(new Set(vault.categories.map(({ id }) => id)).size, 7);
  assert.equal(vault.categories.find(({ root }) => root === '01-项目').id, 'projects');
  assert.equal(vault.categories.find(({ root }) => root === '06-Skills').id, 'skills');
  assert.equal(vault.categories.find(({ root }) => root === '项目').id, 'folder:' + encodeURIComponent('项目'));
  assert.notEqual(vault.categories.find(({ root }) => root === 'skills').id, vault.categories.find(({ root }) => root === 'Skills').id);
  assert.notEqual(vault.categories.find(({ root }) => root === '根目录').id, 'vault-root');
  for (const note of vault.notes) assert.equal(categoryForPath(note.path, vault.categories).id, note.cat);
  assert.equal(buildVault([record('项目/a.md')]).categories[0].id, 'projects', 'a single known alias can use its established preset');
});

test('generic category appearance is deterministic across unrelated additions, deletions and record ordering', () => {
  const records = [record('Research/deep/a.md'), record('Archive/b.md')];
  const original = discoverCategories(records);
  const expanded = discoverCategories([...records].reverse().concat(record('New Root/c.md')), { folders: ['Empty'] });
  for (const category of original) {
    assert.deepEqual(expanded.find(({ root }) => root === category.root), category);
    assert.match(category.color, /^#[\da-f]{6}$/);
    assert.ok(category.pos.every(Number.isFinite));
  }
  const reduced = discoverCategories([records[0]]);
  assert.deepEqual(reduced[0], original.find(({ root }) => root === 'Research'));
  const empty = discoverCategories([], { folders: ['Research'] });
  assert.deepEqual(empty[0], reduced[0], 'empty and populated versions of a folder keep their identity');
});

test('duplicate filenames resolve in their nearest actual root and full paths remain unambiguous', () => {
  const source = 'Work/task.md';
  const vault = buildVault([
    record(source, '[[README]] [[Research/README]] [[../README]]'),
    record('Work/README.md'), record('Research/README.md'), record('README.md'),
    record('Skills/SKILL.md', '[[skills/SKILL]]'), record('skills/SKILL.md'),
  ]);
  assert.deepEqual(new Set(vault.notes.find(({ id }) => id === source).out), new Set(['Work/README.md', 'Research/README.md', 'README.md']));
  assert.deepEqual(vault.notes.find(({ id }) => id === 'Skills/SKILL.md').out, ['skills/SKILL.md']);
  assert.equal(vault.stats.unresolved, 0);
});
