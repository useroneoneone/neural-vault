import { build as viteBuild } from 'vite';
import { build as bundle } from 'esbuild';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createUiDocument } from '../obsidian-plugin/iframeDocument.js';
import { excludePrivatePreviewData } from './private-preview-data.mjs';
import { writeThirdPartyNotices } from './third-party-notices.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uiDirectory = path.join(project, '.codex-plugin-build', 'ui');
const pluginDirectory = path.join(project, 'plugin-dist', 'neural-vault');

process.env.NEURAL_PLUGIN_BUILD = '1';

const uiBuild = await viteBuild({
  root: project,
  configFile: false,
  plugins: [
    excludePrivatePreviewData(project),
    react(),
    tailwindcss(),
  ],
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false' },
  build: {
    outDir: uiDirectory,
    emptyOutDir: true,
    target: 'chrome112',
    cssCodeSplit: false,
    assetsInlineLimit: Infinity,
    sourcemap: false,
    lib: { entry: path.join(project, 'src', 'main.jsx'), name: 'NeuralVaultUI', formats: ['iife'], fileName: () => 'ui.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});

const uiScript = await readFile(path.join(uiDirectory, 'ui.js'), 'utf8');
const cssFiles = (await readdir(uiDirectory)).filter((name) => name.endsWith('.css'));
if (cssFiles.length !== 1) throw new Error('Expected a single bundled CSS file.');
const uiCss = await readFile(path.join(uiDirectory, cssFiles[0]), 'utf8');
const document = createUiDocument(uiScript, uiCss);
await mkdir(pluginDirectory, { recursive: true });
const notices = await readFile(path.join(project, 'NOTICE'), 'utf8');
const requiredNotices = notices.split(/\r?\n/).filter((line) => line.startsWith('Required Notice:'));

await bundle({
  absWorkingDir: project,
  entryPoints: ['obsidian-plugin/main.js'],
  bundle: true,
  format: 'cjs',
  target: 'es2020',
  external: ['obsidian'],
  outfile: path.join(pluginDirectory, 'main.js'),
  sourcemap: false,
  minify: false,
  banner: { js: ['// Neural Vault original portions: SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0', '// License: https://polyformproject.org/licenses/noncommercial/1.0.0', ...requiredNotices.map((line) => `// ${line}`)].join('\n') },
  plugins: [{
    name: 'inline-offline-ui',
    setup(build) {
      build.onResolve({ filter: /^neural-vault:ui$/ }, () => ({ path: 'ui', namespace: 'neural-vault' }));
      build.onLoad({ filter: /.*/, namespace: 'neural-vault' }, () => ({ contents: `export default ${JSON.stringify(document)};`, loader: 'js' }));
    },
  }],
});

await copyFile(path.join(project, 'obsidian-plugin', 'manifest.json'), path.join(pluginDirectory, 'manifest.json'));
await copyFile(path.join(project, 'obsidian-plugin', 'styles.css'), path.join(pluginDirectory, 'styles.css'));
await copyFile(path.join(project, 'README.md'), path.join(pluginDirectory, 'README.md'));
for (const file of ['LICENSE', 'NOTICE']) await copyFile(path.join(project, file), path.join(pluginDirectory, file));
const uiOutputs = Array.isArray(uiBuild) ? uiBuild : [uiBuild];
const moduleIds = uiOutputs.flatMap(({ output }) => output.filter((item) => item.type === 'chunk').flatMap((chunk) => Object.keys(chunk.modules)));
const thirdPartyNotices = await writeThirdPartyNotices({ moduleIds, pluginDirectory, projectDirectory: project });
if (thirdPartyNotices.warnings.length) throw new Error(`Missing third-party license notices: ${thirdPartyNotices.warnings.join('; ')}`);
console.log(`Plugin prepared: ${pluginDirectory}`);
