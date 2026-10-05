import path from 'node:path';

/** Prevent an optional private preview snapshot from entering plugin bundles. */
export function excludePrivatePreviewData(projectRoot) {
  const normalizeFilePath = (value) => {
    const normalized = path.resolve(value).replaceAll('\\', '/');
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
  };
  const snapshotPath = normalizeFilePath(path.join(projectRoot, 'src', 'data', 'vaultSnapshot.json'));
  return {
    name: 'exclude-private-preview-data',
    enforce: 'pre',
    configureServer(server) {
      // Installed only for the stress preview. Vite's static file middleware
      // bypasses load hooks for plain JSON downloads, so protect that route too.
      server.middlewares.use((request, response, next) => {
        let url;
        let requestPath;
        try {
          url = new URL(request.url ?? '/', 'http://localhost');
          requestPath = decodeURIComponent(url.pathname).replaceAll('\\', '/');
        } catch {
          return next();
        }
        const base = server.config.base;
        if (base !== '/' && requestPath.startsWith(base)) requestPath = '/' + requestPath.slice(base.length);
        const requestedFile = requestPath.startsWith('/@fs/')
          ? requestPath.slice('/@fs/'.length).replace(/^\/(?=[a-zA-Z]:\/)/, '')
          : path.resolve(server.config.root, '.' + requestPath);
        if (normalizeFilePath(requestedFile) !== snapshotPath) return next();
        // Preserve the application's JSON module import; the load hook below
        // supplies its empty object. Raw/static downloads receive no file body.
        if (/(?:\?|&)import(?:&|$)/.test(url.search) && !url.searchParams.has('raw')) return next();
        response.statusCode = 404;
        response.setHeader('Content-Type', 'text/plain; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.end('Not found\n');
      });
    },
    load(id) {
      if (normalizeFilePath(id.split('?')[0]) === snapshotPath) {
        return JSON.stringify({ records: [], vaultName: '' });
      }
    },
  };
}
