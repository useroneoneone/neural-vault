import { Plugin, ItemView, TFile, TFolder, Notice } from 'obsidian';
import { buildVault } from '../src/data/vaultAdapter.js';
import UI_DOCUMENT from 'neural-vault:ui';
import { injectVault } from './iframeDocument.js';
import { handleCopyRequest } from './clipboardBridge.js';

export const VIEW_TYPE = 'neural-vault-view';

function readingDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type) => parts.find((entry) => entry.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

class NeuralVaultView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.closed = false;
    this.frame = null;
    this.frameEpoch = 0;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Neural Vault'; }
  getIcon() { return 'network'; }

  async onOpen() {
    this.closed = false;
    this.frameEpoch += 1;
    this.contentEl.empty();
    this.contentEl.addClass('neural-vault-container');
    const loading = this.contentEl.createDiv({ cls: 'neural-vault-loading', text: '正在读取知识库…' });
    const ownerWindow = this.contentEl.ownerDocument.defaultView;
    this.registerDomEvent(ownerWindow, 'message', (event) => {
      if (event.data?.type === 'neural-vault:copy-text') {
        const frame = this.frame;
        const epoch = this.frameEpoch;
        void handleCopyRequest(event, frame, ownerWindow, () => !this.closed && this.frame === frame && this.frameEpoch === epoch);
        return;
      }
      if (event.source !== this.frame?.contentWindow || event.data?.type !== 'neural-vault:open-note') return;
      const path = event.data.path;
      const file = typeof path === 'string' ? this.app.vault.getAbstractFileByPath(path) : null;
      if (file instanceof TFile && file.extension === 'md') {
        void this.app.workspace.openLinkText(file.path, '', 'tab').catch((error) => {
          console.error('[Neural Vault] Open note failed', error);
          new Notice('打开笔记失败，请稍后重试。');
        });
      }
    });
    try {
      const vault = await this.plugin.getVaultData();
      if (this.closed) return;
      this.frame = this.contentEl.createEl('iframe', {
        cls: 'neural-vault-frame',
        attr: { title: '知识库水母星图', sandbox: 'allow-scripts allow-same-origin' },
      });
      // srcdoc bundles the UI and data locally, without localhost or remote assets.
      this.frame.srcdoc = injectVault(UI_DOCUMENT, vault);
      this.registerDomEvent(this.frame, 'load', () => {
        this.frameEpoch += 1;
        loading.remove();
        if (this.plugin.snapshot) this.updateVault(this.plugin.snapshot);
      });
    } catch (error) {
      console.error('[Neural Vault] Reading vault failed', error);
      loading.setText('读取知识库失败，请关闭此页后重试。');
    }
  }

  updateVault(vault) {
    const win = this.frame?.contentWindow;
    if (!this.closed && win) {
      win.dispatchEvent(new win.CustomEvent('neural-vault:update', { detail: vault }));
    }
  }

  async onClose() {
    this.closed = true;
    this.frameEpoch += 1;
    // Detaching the iframe releases its React roots, canvas loop and listeners.
    this.frame?.remove();
    this.frame = null;
    this.contentEl.empty();
  }
}

export default class NeuralVaultPlugin extends Plugin {
  async onload() {
    const stored = await this.loadData();
    this.data = { readingHistory: stored?.readingHistory ?? {} };
    this.snapshot = null;
    this.reading = null;
    this.dataRevision = 0;
    this.snapshotRevision = -1;
    this.refreshTimer = null;
    this.saveTimer = null;
    this.unloaded = false;

    this.registerView(VIEW_TYPE, (leaf) => new NeuralVaultView(leaf, this));
    this.addRibbonIcon('network', '打开知识库水母星图', () => void this.activateView());
    this.addCommand({ id: 'open-neural-vault', name: '打开知识库水母星图', callback: () => void this.activateView() });
    this.addCommand({ id: 'refresh-neural-vault', name: '刷新知识库数据', callback: () => this.scheduleRefresh() });

    for (const event of ['create', 'modify', 'delete']) {
      this.registerEvent(this.app.vault.on(event, (file) => {
        if (file instanceof TFile && file.extension !== 'md') return;
        if (event === 'delete') this.forgetReading(file.path);
        this.scheduleRefresh();
      }));
    }
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      this.renameReading(oldPath, file.path);
      this.scheduleRefresh();
    }));
    this.registerEvent(this.app.metadataCache.on('resolved', () => this.scheduleRefresh()));
    this.registerEvent(this.app.workspace.on('file-open', (file) => this.recordReading(file)));
    this.app.workspace.onLayoutReady(() => {
      if (this.unloaded) return;
      this.recordReading(this.app.workspace.getActiveFile());
      this.scheduleRefresh();
    });
  }

  async activateView() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
  }

  scheduleRefresh() {
    if (this.unloaded) return;
    this.dataRevision += 1;
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      void this.refreshViews().catch((error) => console.error('[Neural Vault] Refresh failed', error));
    }, 350);
  }

  async getVaultData(force = false) {
    if (this.reading) {
      await this.reading;
      if (this.snapshotRevision !== this.dataRevision) return this.getVaultData(true);
      return this.snapshot;
    }
    if (!force && this.snapshot && this.snapshotRevision === this.dataRevision) return this.snapshot;
    const revision = this.dataRevision;
    this.reading = this.readVault().then((vault) => {
      this.snapshot = vault;
      this.snapshotRevision = revision;
      return vault;
    }).finally(() => { this.reading = null; });
    return this.reading;
  }

  async readVault() {
    const files = this.app.vault.getMarkdownFiles();
    const folders = (this.app.vault.getAllLoadedFiles?.() ?? [])
      .filter((file) => file instanceof TFolder && file.path && file.path !== '/')
      .map((folder) => folder.path);
    const records = await Promise.all(files.map(async (file) => {
      try {
        return {
          path: file.path,
          content: await this.app.vault.cachedRead(file),
          stat: { ctime: file.stat.ctime, mtime: file.stat.mtime },
          frontmatter: this.app.metadataCache.getFileCache(file)?.frontmatter,
        };
      } catch (error) {
        // A note deleted during a refresh has already been covered by its event.
        if (this.app.vault.getAbstractFileByPath(file.path) !== file) return null;
        throw error;
      }
    }));
    return {
      ...buildVault(records.filter(Boolean), {
        resolvedLinks: this.app.metadataCache.resolvedLinks,
        readingHistory: this.data.readingHistory,
        folders,
      }),
      vaultName: this.app.vault.getName(),
    };
  }

  async refreshViews() {
    const vault = await this.getVaultData(true);
    if (this.unloaded) return;
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof NeuralVaultView) leaf.view.updateVault(vault);
    }
  }

  recordReading(file) {
    if (!(file instanceof TFile) || file.extension !== 'md') return;
    const day = readingDate();
    const days = this.data.readingHistory[file.path] ?? {};
    if (days[day]) return;
    const cutoff = new Date(Date.now() - 190 * 86400000).toISOString().slice(0, 10);
    this.data.readingHistory[file.path] = Object.fromEntries(
      [...Object.entries(days).filter(([date]) => date >= cutoff), [day, 1]],
    );
    this.scheduleSave();
    this.scheduleRefresh();
  }

  renameReading(oldPath, newPath) {
    const entries = Object.entries(this.data.readingHistory);
    let changed = false;
    for (const [path, history] of entries) {
      if (path === oldPath || path.startsWith(`${oldPath}/`)) {
        delete this.data.readingHistory[path];
        this.data.readingHistory[newPath + path.slice(oldPath.length)] = history;
        changed = true;
      }
    }
    if (changed) this.scheduleSave();
  }

  forgetReading(path) {
    let changed = false;
    for (const key of Object.keys(this.data.readingHistory)) {
      if (key === path || key.startsWith(`${path}/`)) {
        delete this.data.readingHistory[key];
        changed = true;
      }
    }
    if (changed) this.scheduleSave();
  }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.saveData(this.data).catch((error) => console.error('[Neural Vault] Saving reading history failed', error));
    }, 700);
  }

  onunload() {
    this.unloaded = true;
    clearTimeout(this.refreshTimer);
    clearTimeout(this.saveTimer);
    if (this.saveTimer) void this.saveData(this.data);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }
}
