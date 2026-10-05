import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';
import { createUiDocument, injectVault } from '../obsidian-plugin/iframeDocument.js';

class Events {
  constructor() { this.callbacks = new Map(); }
  on(name, callback) {
    const listeners = this.callbacks.get(name) ?? [];
    listeners.push(callback);
    this.callbacks.set(name, listeners);
    return { name, callback };
  }
  fire(name, ...args) { for (const callback of this.callbacks.get(name) ?? []) callback(...args); }
}

class Element {
  constructor(window) { this.ownerDocument = { defaultView: window }; this.children = []; this.domEvents = new Map(); }
  empty() { this.children = []; }
  addClass() {}
  remove() { this.removed = true; }
  setText(text) { this.text = text; }
  createDiv(options) { const child = this.createEl('div', options); child.text = options.text; return child; }
  createEl(tag, options) {
    const child = new Element(this.ownerDocument.defaultView);
    child.tag = tag;
    child.options = options;
    if (tag === 'iframe') child.contentWindow = {
      CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
      events: [],
      dispatchEvent(event) { this.events.push(event); },
    };
    this.children.push(child);
    return child;
  }
}

class Component {
  registerDomEvent(target, type, callback) {
    const listeners = target.domEvents.get(type) ?? [];
    listeners.push(callback);
    target.domEvents.set(type, listeners);
  }
}

class TFile {
  constructor(path, content = '') {
    this.path = path;
    this.extension = path.split('.').at(-1);
    this.content = content;
    this.stat = { ctime: 1700000000000, mtime: 1800000000000 };
  }
}

class TFolder {
  constructor(path) { this.path = path; this.children = []; }
}

class Plugin extends Component {
  constructor(app) { super(); this.app = app; this.viewFactories = new Map(); this.commands = []; this.events = []; this.saved = []; }
  async loadData() { return this.stored; }
  async saveData(data) { this.saved.push(JSON.parse(JSON.stringify(data))); }
  registerView(type, callback) { this.viewFactories.set(type, callback); }
  addRibbonIcon(icon, name, callback) { this.ribbon = { icon, name, callback }; }
  addCommand(command) { this.commands.push(command); }
  registerEvent(event) { this.events.push(event); }
}

class ItemView extends Component {
  constructor(leaf) { super(); this.app = leaf.app; this.contentEl = new Element(leaf.window); }
}

const result = await build({
  entryPoints: ['obsidian-plugin/main.js'], bundle: true, format: 'cjs', write: false,
  external: ['obsidian'],
  plugins: [{ name: 'test-ui', setup(builder) {
    builder.onResolve({ filter: /^neural-vault:ui$/ }, () => ({ path: 'ui', namespace: 'test' }));
    builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `export default ${JSON.stringify(createUiDocument('window.ready = true;', 'body { color: white; }'))};` }));
  } }],
});
const pluginModule = { exports: {} };
vm.runInNewContext(result.outputFiles[0].text, {
  module: pluginModule,
  exports: pluginModule.exports,
  require(name) {
    assert.equal(name, 'obsidian');
    return { Plugin, ItemView, TFile, TFolder, Notice: class {} };
  },
  console, setTimeout, clearTimeout,
});
const NeuralPlugin = pluginModule.exports.default;
const VIEW_TYPE = pluginModule.exports.VIEW_TYPE;

function appFor(files) {
  const reads = [];
  const opens = [];
  const vault = new Events();
  Object.assign(vault, {
    getMarkdownFiles: () => files.filter((file) => file.extension === 'md'),
    getAllLoadedFiles: () => files,
    cachedRead: async (file) => { reads.push(file.path); return file.content; },
    getAbstractFileByPath: (path) => files.find((file) => file.path === path) ?? null,
    getName: () => 'Fixture vault',
  });
  const metadataCache = new Events();
  Object.assign(metadataCache, { resolvedLinks: {}, getFileCache: () => null });
  const workspace = new Events();
  Object.assign(workspace, {
    getLeavesOfType: () => [],
    getActiveFile: () => null,
    onLayoutReady: (callback) => { workspace.ready = callback; },
    openLinkText: async (...args) => { opens.push(args); },
    detachLeavesOfType: (type) => { workspace.detached = type; },
  });
  return { vault, metadataCache, workspace, reads, opens };
}

async function pluginFor(t, files) {
  const app = appFor(files);
  const plugin = new NeuralPlugin(app);
  await plugin.onload();
  t.after(() => plugin.onunload());
  return { app, plugin };
}

test('all root reading uses cached content and authoritative Obsidian links without writing notes', async (t) => {
  const first = new TFile('01-项目/sub/first.md', '# First\n[[stale]]');
  const second = new TFile('02-资产/second.md', '# Second\nHello');
  const external = new TFile('Daily/private.md', '# Private');
  const { app, plugin } = await pluginFor(t, [first, second, external]);
  app.metadataCache.resolvedLinks = { [first.path]: { [second.path]: 2 } };
  app.metadataCache.getFileCache = (file) => file === first ? { frontmatter: { title: 'Cached title' } } : null;
  const snapshot = await plugin.getVaultData();
  assert.equal(snapshot.categories.length, 3);
  assert.equal(snapshot.notes.length, 3);
  assert.equal(snapshot.vaultName, 'Fixture vault');
  assert.equal(snapshot.notes.find((note) => note.id === first.path).title, 'Cached title');
  assert.deepEqual(Array.from(snapshot.notes.find((note) => note.id === first.path).out), [second.path]);
  assert.deepEqual(app.reads, [first.path, second.path, external.path]);
  assert.equal(plugin.saved.length, 0);
  assert.equal(plugin.viewFactories.has(VIEW_TYPE), true);
  assert.equal(plugin.ribbon.icon, 'network');
  assert.equal(plugin.commands.length, 2);
});

test('reading events record real days once for every root and survive folder rename', async (t) => {
  const note = new TFile('01-项目/sub/first.md', '# First');
  const outside = new TFile('Daily/private.md');
  const { app, plugin } = await pluginFor(t, [note, outside]);
  app.workspace.fire('file-open', note);
  app.workspace.fire('file-open', note);
  app.workspace.fire('file-open', outside);
  const history = plugin.data.readingHistory[note.path];
  assert.equal(Object.keys(history).length, 1);
  assert.match(Object.keys(history)[0], /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(Object.values(history)[0], 1);
  assert.equal(Object.keys(plugin.data.readingHistory[outside.path]).length, 1);
  app.vault.fire('rename', { path: '01-项目/renamed' }, '01-项目/sub');
  assert.equal(plugin.data.readingHistory[note.path], undefined);
  assert.equal(Object.keys(plugin.data.readingHistory['01-项目/renamed/first.md']).length, 1);
  app.vault.fire('delete', { path: '01-项目/renamed' });
  assert.equal(Object.keys(plugin.data.readingHistory).length, 1);
});

test('iframe bridge rejects wrong senders and missing targets, and opens existing Markdown in a new tab', async (t) => {
  const note = new TFile('01-项目/first.md', '# First');
  const image = new TFile('01-项目/image.png');
  const { app, plugin } = await pluginFor(t, [note, image]);
  const window = { domEvents: new Map() };
  const view = plugin.viewFactories.get(VIEW_TYPE)({ app, window });
  await view.onOpen();
  const handler = window.domEvents.get('message')[0];
  const message = (source, path) => handler({ source, data: { type: 'neural-vault:open-note', path } });
  message({}, note.path);
  message(view.frame.contentWindow, '01-项目/missing.md');
  message(view.frame.contentWindow, image.path);
  message(view.frame.contentWindow, '../outside.md');
  assert.equal(app.opens.length, 0);
  message(view.frame.contentWindow, note.path);
  assert.deepEqual(app.opens, [[note.path, '', 'tab']]);
  assert.match(view.frame.srcdoc, /window\.__NEURAL_HOST__="obsidian"/);
  assert.match(view.frame.srcdoc, /Fixture vault/);
  const frame = view.frame;
  await view.onClose();
  assert.equal(frame.removed, true);
  assert.equal(view.frame, null);
});

test('embedded note data cannot close its script tag and the document needs no external asset', () => {
  const payload = { title: '</script><script>window.attack=true</script>', content: 'a\u2028b\u2029c' };
  const document = injectVault(createUiDocument('window.ready=true;', 'body{color:white}'), payload);
  assert.equal(document.includes(payload.title), false);
  assert.equal(document.match(/<script>/g).length, 2);
  const bootstrap = document.match(/window\.__NEURAL_VAULT__=(.*?);<\/script>/s)[1];
  assert.deepEqual(JSON.parse(bootstrap), payload);
  assert.match(document, /connect-src 'none'/);
  assert.equal(/<(?:script|link)\b[^>]*(?:src|href)=/i.test(document), false);
});

test('an event during a pending read causes another snapshot instead of dropping the change', async (t) => {
  const note = new TFile('01-项目/first.md', '# Before');
  const { app, plugin } = await pluginFor(t, [note]);
  let release;
  let calls = 0;
  app.vault.cachedRead = async () => {
    calls += 1;
    if (calls === 1) return new Promise((resolve) => { release = () => resolve('# Before'); });
    return '# After';
  };
  const firstRead = plugin.getVaultData();
  app.vault.fire('modify', note);
  const refresh = plugin.getVaultData(true);
  release();
  await firstRead;
  const snapshot = await refresh;
  assert.equal(calls, 2);
  assert.equal(snapshot.notes[0].title, 'After');
});

test('root files and actual empty folders update categories as directories are created and removed', async (t) => {
  const rootNote = new TFile('README.md', '# Root');
  const nested = new TFile('Custom/deep/note.md', '# Nested');
  const empty = new TFolder('Empty');
  const files = [rootNote, nested, empty, new TFolder('Custom'), new TFolder('/')];
  const { app, plugin } = await pluginFor(t, files);
  let snapshot = await plugin.getVaultData();
  assert.deepEqual(new Set(Array.from(snapshot.categories, ({ root }) => root)), new Set(['', 'Custom', 'Empty']));
  assert.equal(snapshot.categories.find(({ root }) => root === 'Empty').count, 0);
  assert.equal(snapshot.notes.find(({ path }) => path === rootNote.path).cat, 'vault-root');
  app.workspace.fire('file-open', rootNote);
  assert.equal(Object.keys(plugin.data.readingHistory[rootNote.path]).length, 1);
  const created = new TFolder('New empty folder');
  files.push(created);
  app.vault.fire('create', created);
  snapshot = await plugin.getVaultData(true);
  assert.equal(snapshot.categories.find(({ root }) => root === created.path).count, 0);
  files.splice(files.indexOf(created), 1);
  app.vault.fire('delete', created);
  snapshot = await plugin.getVaultData(true);
  assert.equal(snapshot.categories.some(({ root }) => root === created.path), false);
});

test('an empty vault has no invented categories and attachment-only roots can come from folders', async (t) => {
  const files = [];
  const { app, plugin } = await pluginFor(t, files);
  let snapshot = await plugin.getVaultData();
  assert.equal(snapshot.categories.length, 0);
  assert.equal(snapshot.notes.length, 0);
  files.push(new TFolder('Attachments'), new TFile('Attachments/image.png'));
  app.vault.fire('create', files[0]);
  snapshot = await plugin.getVaultData(true);
  assert.equal(snapshot.categories.length, 1);
  assert.equal(snapshot.categories[0].root, 'Attachments');
  assert.equal(snapshot.categories[0].count, 0);
  assert.equal(app.reads.length, 0);
});
