import path from 'node:path';

/** Prevent an optional private preview snapshot from entering plugin bundles. */
export function excludePrivatePreviewData(projectRoot) {
  const snapshotPath = path.resolve(projectRoot, 'src', 'data', 'vaultSnapshot.json').replaceAll('\\', '/');
  return {
    name: 'exclude-private-preview-data',
    enforce: 'pre',
    load(id) {
      if (id.split('?')[0].replaceAll('\\', '/') === snapshotPath) {
        return JSON.stringify({ records: [], vaultName: '' });
      }
    },
  };
}
