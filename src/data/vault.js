import { DEMO_SNAPSHOT } from './vaultDemo.js';
import { buildVault } from './vaultAdapter.js';
import { createStressSnapshot } from './vaultStressDemo.js';

// Local imports are optional and only available to the development preview.
// A clean checkout and all production builds use the public synthetic demo.
const stressPreview = import.meta.env.DEV && import.meta.env.VITE_STRESS_PREVIEW === 'true';
const localSnapshots = import.meta.env.DEV && !stressPreview
  ? import.meta.glob('./vaultSnapshot.json', { eager: true, import: 'default' })
  : {};
const localSnapshot = localSnapshots['./vaultSnapshot.json'];
const snapshot = stressPreview ? createStressSnapshot() : Array.isArray(localSnapshot?.records) ? localSnapshot : DEMO_SNAPSHOT;

export { CATEGORIES } from './categories.js';
export { mulberry32 } from './random.js';
export { buildVault } from './vaultAdapter.js';

export const VAULT = { ...buildVault(snapshot.records, { folders: snapshot.folders, readingHistory: snapshot.readingHistory }), vaultName: snapshot.vaultName };
export const VAULT_NAME = snapshot.vaultName;
export const catById = Object.fromEntries(VAULT.categories.map((category) => [category.id, category]));
export const noteById = Object.fromEntries(VAULT.notes.map((note) => [note.id, note]));
