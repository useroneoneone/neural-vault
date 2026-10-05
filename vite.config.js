import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { excludePrivatePreviewData } from './scripts/private-preview-data.mjs';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => ({
  // Vite hoists eager glob imports even when stress mode skips their values.
  // Intercept the imported module so its response contains only an empty stub.
  plugins: [...(mode === 'stress' ? [excludePrivatePreviewData(projectRoot)] : []), react(), tailwindcss()],
  define: { 'import.meta.env.VITE_STRESS_PREVIEW': JSON.stringify(mode === 'stress' ? 'true' : 'false') },
  server: { port: 5173, open: false },
}));
