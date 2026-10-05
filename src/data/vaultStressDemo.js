// Deterministic fictional data for the opt-in adaptation preview. No vault files
// are created or read, and the installed Obsidian plugin never selects this mode.
export const STRESS_ROOTS = [
  ['项目', 120], ['资产', 108], ['资源', 84], ['辅助', 24],
  ['灵感', 18], ['skills', 16], ['Research Lab · 实验记录', 36],
  ['阅读与摘录', 28], ['旅行 Journal', 20], ['收件箱', 12], ['空目录', 0],
];

export function createStressSnapshot({ extraRoots = 0 } = {}) {
  const roots = [...STRESS_ROOTS, ...Array.from({ length: Math.max(0, Math.min(48, extraRoots)) }, (_, i) => [`扩展目录 ${String(i + 1).padStart(2, '0')}`, 5])];
  const records = [];
  const groups = [];
  for (const [root, count] of [...roots, ['', 6]]) {
    const group = [];
    for (let i = 0; i < count; i++) {
      const number = String(i + 1).padStart(3, '0');
      const title = i === 0 ? '每周回顾' : `${root || '知识库首页'} · 笔记 ${number}`;
      const filename = root && (i === 1 || i === 2) ? '同名笔记' : i === 0 ? '每周回顾' : `笔记-${number}`;
      const nested = root && i === 1 ? '专题 A/' : root && i === 2 ? '专题 B/' : root && i % 5 === 0 ? '专题/深层/' : '';
      const path = `${root ? `${root}/` : ''}${nested}${filename}.md`;
      const record = { path, title, index: i, root, stat: {
        ctime: Date.UTC(2026, 0, 1), mtime: Date.UTC(2026, 8, 1 + i % 28, i % 24),
      } };
      records.push(record);
      group.push(record);
    }
    if (group.length) groups.push(group);
  }
  const readingHistory = {};
  groups.forEach((group, groupIndex) => {
    group.forEach((record, i) => {
      const next = group[(i + 1) % group.length];
      const previous = group[(i + group.length - 1) % group.length];
      const cross = groups[(groupIndex + 1) % groups.length][i % groups[(groupIndex + 1) % groups.length].length];
      const links = [next, ...(i % 3 === 0 ? [previous] : []), ...(i % 7 === 0 ? [cross] : [])];
      record.content = [
        '---', `title: ${JSON.stringify(record.title)}`,
        `tags: [演示, ${i % 2 === 0 ? '观察' : '方法论'}]`,
        `reading_status: ${['unread', 'reading', 'read'][i % 3]}`, '---',
        `# ${record.title}`, '',
        '这是一篇合成测试笔记，用来核验自动目录适配、长列表和笔记关联。', '',
        '## 观察记录', `记录 ${String(i + 1).padStart(3, '0')}：从一个问题出发，整理假设、观察和下一步。`,
        '- 检查所属目录与标题是否正确。', '- 试着滚动列表，再用搜索定位本页。', '',
        '## 关联笔记', ...links.map((target) => `- [[${target.path.replace(/\.md$/i, '')}|${target.title}]]`), '',
        ...(i % 12 === 0 ? [
          '## 配置示例', '```json', JSON.stringify({ name: 'synthetic-preview', port: 5174, path: 'C:\\Demo Vault\\notes', enabled: true }, null, 2), '```', '',
          '## 启动命令', '```bash', 'npm run dev:stress', '```', '',
          '配置路径：`C:\\Demo Vault\\config.json`', '',
        ] : []),
        '## 下一步', '把有用的结论记录下来，沿着关联笔记继续阅读。', '',
      ].join('\n');
      if (i % 3 !== 0) readingHistory[record.path] = { '2026-09-01': 1, '2026-09-15': 1, '2026-10-04': 1 };
    });
  });
  for (const record of records) {
    delete record.title;
    delete record.index;
    delete record.root;
  }
  return {
    vaultName: '自动适配测试 · 合成知识库',
    folders: roots.map(([root]) => root),
    records, readingHistory,
  };
}
