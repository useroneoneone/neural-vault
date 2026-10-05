import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const previews = path.join(project, '.codex-preview');
const canary = 'SYNTHETIC_STRESS_SERVE_PRIVATE_CANARY_DO_NOT_SEND';

async function withSyntheticPreview(callback) {
  await mkdir(previews, { recursive: true });
  const directory = await mkdtemp(path.join(previews, 'stress-server-test-'));
  try {
    const data = path.join(directory, 'src', 'data');
    const scripts = path.join(directory, 'scripts');
    await mkdir(data, { recursive: true });
    await mkdir(scripts, { recursive: true });
    await copyFile(path.join(project, 'vite.config.js'), path.join(directory, 'vite.config.js'));
    await copyFile(path.join(project, 'scripts', 'private-preview-data.mjs'), path.join(scripts, 'private-preview-data.mjs'));
    for (const file of ['vault.js', 'vaultDemo.js', 'vaultStressDemo.js', 'vaultAdapter.js', 'categories.js', 'random.js', 'readingHistory.js']) {
      await copyFile(path.join(project, 'src', 'data', file), path.join(data, file));
    }
    await writeFile(path.join(data, 'vaultSnapshot.json'), JSON.stringify({
      vaultName: canary,
      records: [{ path: `Custom/${canary}.md`, content: `# ${canary}\nFictional private preview fixture.` }],
    }), 'utf8');
    return await callback(directory);
  } finally {
    // Only remove the exact ignored directory created above, never project data.
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(previews));
    assert.ok(path.basename(directory).startsWith('stress-server-test-'));
    await rm(directory, { recursive: true, force: true });
  }
}

async function withServer(directory, mode, callback) {
  const server = await createServer({
    root: directory,
    configFile: path.join(directory, 'vite.config.js'),
    mode,
    logLevel: 'silent',
    plugins: [{
      name: 'json-privacy-fixture-without-dependency-prebundling',
      enforce: 'post',
      config(config) {
        // The fixture requests only local data modules; avoid starting React
        // prebundling that would be cancelled when this short-lived server closes.
        config.optimizeDeps = { ...config.optimizeDeps, noDiscovery: true, include: [] };
      },
    }],
    server: { host: '127.0.0.1', port: 0, strictPort: false, open: false },
  });
  try {
    await server.listen();
    const address = server.httpServer.address();
    assert.equal(typeof address, 'object');
    return await callback(`http://127.0.0.1:${address.port}`, server);
  } finally {
    await server.close();
  }
}

test('stress serve returns an empty snapshot for Vite-hoisted eager imports', async () => {
  await withSyntheticPreview(async (directory) => {
    await withServer(directory, 'stress', async (origin, server) => {
      const sourceResponse = await fetch(`${origin}/src/data/vault.js`);
      assert.equal(sourceResponse.status, 200);
      const source = await sourceResponse.text();
      // This is the real development transform, rather than a tree-shaken build.
      const snapshotImport = source.match(/from\s*["']([^"']*vaultSnapshot\.json\?import[^"']*)["']/);
      assert.ok(snapshotImport, 'the eager glob still generates a static snapshot import');
      assert.equal(source.includes(canary), false);
      const snapshotResponse = await fetch(new URL(snapshotImport[1], origin));
      assert.equal(snapshotResponse.status, 200);
      const snapshotModule = await snapshotResponse.text();
      assert.equal(snapshotModule.includes(canary), false, 'the imported JSON response must exclude every private canary field');
      assert.match(snapshotModule, /records\s*=\s*\[\]/);
      const snapshot = await server.ssrLoadModule('/src/data/vaultSnapshot.json');
      assert.deepEqual(snapshot.default, { records: [], vaultName: '' });
      const snapshotPath = path.join(directory, 'src', 'data', 'vaultSnapshot.json').replaceAll('\\', '/');
      const endpoints = ['/src/data/vaultSnapshot.json', '/src/data/vaultSnapshot.json?raw', '/src/data/vaultSnapshot.json?raw&import', `/@fs/${snapshotPath}`, `/@fs/${snapshotPath}?raw`];
      if (process.platform === 'win32') {
        endpoints.push('/src/data/VaultSnapshot.json', '/src/data/VaultSnapshot.json?raw', `/@fs/${snapshotPath.toUpperCase()}`, `/@fs/${snapshotPath.toUpperCase()}?raw`);
        const caseVariant = await fetch(`${origin}/src/data/VaultSnapshot.json?import`);
        assert.equal(caseVariant.status, 200);
        const caseModule = await caseVariant.text();
        assert.equal(caseModule.includes(canary), false);
        assert.match(caseModule, /records\s*=\s*\[\]/);
        assert.deepEqual((await server.ssrLoadModule('/src/data/VaultSnapshot.json')).default, { records: [], vaultName: '' });
      }
      const downloads = await Promise.all(endpoints.map(async (endpoint) => {
        const response = await fetch(`${origin}${endpoint}`);
        return { endpoint, status: response.status, includesCanary: (await response.text()).includes(canary) };
      }));
      for (const download of downloads) {
        assert.equal(download.includesCanary, false, `raw snapshot downloads must be blocked: ${download.endpoint}`);
        assert.equal(download.status, 404, `static/raw snapshot requests must be rejected before filesystem serving: ${download.endpoint}`);
      }
    });
    await withServer(directory, 'development', async (origin) => {
      for (const endpoint of ['/src/data/vaultSnapshot.json?import', '/src/data/vaultSnapshot.json', '/src/data/vaultSnapshot.json?raw']) {
        const response = await fetch(`${origin}${endpoint}`);
        assert.equal(response.status, 200);
        assert.ok((await response.text()).includes(canary), 'ordinary local preview still supports explicitly imported private data');
      }
    });
  });
});
