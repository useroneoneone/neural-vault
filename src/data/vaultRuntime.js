import { VAULT as previewVault } from './vault';

const isVault = (value) => value && Array.isArray(value.categories) && Array.isArray(value.notes) && Array.isArray(value.edges);
let currentVault = isVault(globalThis.__NEURAL_VAULT__) ? globalThis.__NEURAL_VAULT__ : previewVault;
const listeners = new Set();

export const getVaultSnapshot = () => currentVault;

export function subscribeVault(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// The Obsidian view supplies the initial vault before loading the UI, then
// refreshes this same view when its vault or metadata cache changes.
if (typeof window !== 'undefined') {
  window.addEventListener('neural-vault:update', (event) => {
    if (!isVault(event.detail)) return;
    currentVault = event.detail;
    listeners.forEach((listener) => listener());
  });
}

export function noteUrl(note, vaultName = currentVault.vaultName) {
  const params = new URLSearchParams();
  if (vaultName) params.set('vault', vaultName);
  params.set('file', note.path || note.title);
  return `obsidian://open?${params}`;
}

export function openNoteInHost(note) {
  if (globalThis.__NEURAL_HOST__ !== 'obsidian' || !note.path) return false;
  window.parent.postMessage({ type: 'neural-vault:open-note', path: note.path }, '*');
  return true;
}
