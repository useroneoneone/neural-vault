import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { buildVault } from '../src/data/vaultAdapter.js';

const run = promisify(execFile);
const script = fileURLToPath(new URL('../scripts/import-vault.mjs', import.meta.url));

test('offline import reads all Markdown roots, nested content and empty directories without changing source notes', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'neural-import-test-'));
  const vault = path.join(directory, 'Fixture vault');
  const output = path.join(directory, 'snapshot.json');
  try {
    await mkdir(path.join(vault, 'Custom', 'deep'), { recursive: true });
    await mkdir(path.join(vault, 'Empty'), { recursive: true });
    await mkdir(path.join(vault, '.obsidian'), { recursive: true });
    const rootBody = '# Root\n[[Custom/deep/note]]\n';
    const nestedBody = '# Nested\n[[../../README]]\n';
    await writeFile(path.join(vault, 'README.md'), rootBody);
    await writeFile(path.join(vault, 'Custom', 'deep', 'note.md'), nestedBody);
    await writeFile(path.join(vault, '.obsidian', 'internal.md'), '# Internal configuration');
    await writeFile(path.join(vault, 'Custom', 'image.png'), 'fixture attachment');
    const { stdout } = await run(process.execPath, [script, vault, output]);
    const snapshot = JSON.parse(await readFile(output, 'utf8'));
    assert.deepEqual(new Set(snapshot.folders), new Set(['Custom', 'Empty']));
    assert.deepEqual(new Set(snapshot.records.map(({ path }) => path)), new Set(['README.md', 'Custom/deep/note.md']));
    assert.equal(snapshot.records.find(({ path }) => path === 'README.md').content, rootBody);
    assert.equal(snapshot.records.find(({ path }) => path === 'Custom/deep/note.md').content, nestedBody);
    const data = buildVault(snapshot.records, { folders: snapshot.folders });
    assert.equal(data.categories.length, 3);
    assert.equal(data.categories.find(({ root }) => root === 'Empty').count, 0);
    assert.equal(data.stats.links, 2);
    assert.equal(data.stats.mutual, 1);
    assert.equal(await readFile(path.join(vault, 'README.md'), 'utf8'), rootBody);
    assert.equal(await readFile(path.join(vault, 'Custom', 'deep', 'note.md'), 'utf8'), nestedBody);
    assert.equal(stdout.includes(rootBody), false, 'the importer prints counts rather than note content');
  } finally {
    assert.equal(path.dirname(directory), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith('neural-import-test-'));
    await rm(directory, { recursive: true, force: true });
  }
});
