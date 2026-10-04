import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { DEMO_RECORDS, DEMO_SNAPSHOT } from '../src/data/vaultDemo.js';
import { buildVault } from '../src/data/vaultAdapter.js';
import { excludePrivatePreviewData } from '../scripts/private-preview-data.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localCanary = 'SYNTHETIC_PRIVATE_PREVIEW_CANARY_DO_NOT_BUNDLE';

async function fixture(callback, { local = false } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'neural-public-demo-'));
  const data = path.join(directory, 'src', 'data');
  try {
    await mkdir(data, { recursive: true });
    for (const file of ['vault.js', 'vaultDemo.js', 'vaultAdapter.js', 'categories.js', 'random.js', 'readingHistory.js']) await copyFile(path.join(project, 'src', 'data', file), path.join(data, file));
    if (local) await writeFile(path.join(data, 'vaultSnapshot.json'), JSON.stringify({ vaultName: localCanary, records: [{ path: `01-项目/${localCanary}.md`, content: `# ${localCanary}\nSynthetic local preview content.` }] }), 'utf8');
    return await callback(directory);
  } finally {
    // This exact temporary directory was created by this test.
    assert.ok(directory.startsWith(path.join(tmpdir(), 'neural-public-demo-')));
    await rm(directory, { recursive: true, force: true });
  }
}

async function compiledVault(directory, { dev = false, privateGuard = false } = {}) {
  const output = await build({
    root: directory,
    configFile: false,
    logLevel: 'silent',
    plugins: privateGuard ? [excludePrivatePreviewData(directory)] : [],
    define: { 'import.meta.env.DEV': JSON.stringify(dev) },
    build: { write: false, minify: true, lib: { entry: path.join(directory, 'src', 'data', 'vault.js'), formats: ['es'] } },
  });
  const generated = (Array.isArray(output) ? output : [output]).flatMap((result) => result.output);
  const code = generated.find((entry) => entry.type === 'chunk').code;
  const exports = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  return { code, vault: exports.VAULT };
}

test('the public synthetic demo covers all six roots, actual sample links and readable technical examples', () => {
  const vault = buildVault(DEMO_RECORDS);
  assert.deepEqual(vault.categories.map(({ name, count }) => [name, count]), [['项目', 3], ['资产', 3], ['资源', 3], ['辅助', 3], ['灵感', 3], ['skills', 3]]);
  assert.equal(vault.stats.unresolved, 0);
  assert.ok(vault.edges.length > 0);
  assert.ok(vault.stats.mutual > 0);
  assert.equal(DEMO_SNAPSHOT.vaultName, 'Neural Vault Demo');
  const codeBlocks = vault.notes.flatMap(({ outline }) => outline.flatMap(({ children }) => children)).filter(({ kind }) => kind === 'code');
  const json = codeBlocks.find(({ language }) => language === 'json');
  assert.equal(JSON.parse(json.text).notesPath, 'C:\\Demo Vault\\notes');
  assert.ok(codeBlocks.some(({ language, text }) => language === 'bash' && text.includes('npm run dev')));
  assert.ok(codeBlocks.some(({ language, text }) => language === 'text' && text.includes('/opt/neural-demo/notes')));
});

test('a clean checkout without an optional local snapshot builds the public demo', async () => {
  await fixture(async (directory) => {
    const { vault } = await compiledVault(directory);
    assert.equal(vault.vaultName, DEMO_SNAPSHOT.vaultName);
    assert.equal(vault.notes.length, 18);
    const preview = await compiledVault(directory, { dev: true });
    assert.equal(preview.vault.notes.length, 18, 'development preview also works without a local import');
  });
});

test('local development preview prefers the optional import while production excludes it', async () => {
  await fixture(async (directory) => {
    const preview = await compiledVault(directory, { dev: true });
    assert.equal(preview.vault.vaultName, localCanary);
    assert.equal(preview.vault.notes.length, 1);
    const production = await compiledVault(directory);
    assert.equal(production.vault.vaultName, DEMO_SNAPSHOT.vaultName);
    assert.equal(production.vault.notes.length, 18);
    assert.equal(production.code.includes(localCanary), false, 'private import content is absent from production JavaScript');
  }, { local: true });
});

test('the plugin loader blocks private preview content even if a build accidentally enables DEV', async () => {
  await fixture(async (directory) => {
    const protectedBuild = await compiledVault(directory, { dev: true, privateGuard: true });
    assert.equal(protectedBuild.code.includes(localCanary), false);
    assert.equal(protectedBuild.vault.notes.length, 0, 'the intercepted local snapshot is empty');
    const pluginProduction = await compiledVault(directory, { privateGuard: true });
    assert.equal(pluginProduction.vault.notes.length, 18);
    assert.equal(pluginProduction.code.includes(localCanary), false);
  }, { local: true });
});
