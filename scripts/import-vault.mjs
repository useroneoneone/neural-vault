import { readdir, readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVault } from '../src/data/vaultAdapter.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2]) {
  console.error('用法：npm run import:vault -- "<知识库路径>" [输出文件]');
  process.exit(1);
}
const vaultRoot = resolve(process.argv[2]);
const outputPath = resolve(process.argv[3] ?? join(projectRoot, 'src/data/vaultSnapshot.json'));

const folders = [];
async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (directory === vaultRoot) folders.push(entry.name);
      files.push(...await markdownFiles(path));
    }
    else if (entry.isFile() && /\.md$/i.test(entry.name)) files.push(path);
  }
  return files;
}

const paths = await markdownFiles(vaultRoot);
const records = await Promise.all(paths.map(async (filePath) => {
  const path = relative(vaultRoot, filePath).replaceAll('\\', '/');
  const [content, metadata] = await Promise.all([readFile(filePath, 'utf8'), stat(filePath)]);
  return { path, content, stat: { mtime: metadata.mtimeMs, ctime: metadata.ctimeMs } };
}));
const snapshot = { vaultName: vaultRoot.split(/[\\/]/).at(-1), importedAt: new Date().toISOString(), folders, records };
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
const vault = buildVault(records, { folders });
console.log(JSON.stringify({ output: outputPath, groups: vault.categories.map(({ name, count }) => ({ name, count })), ...vault.stats, totalWords: vault.totalWords }, null, 2));
