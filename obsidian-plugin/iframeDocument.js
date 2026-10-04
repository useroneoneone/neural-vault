export const BOOTSTRAP_SLOT = '/* NEURAL_VAULT_BOOTSTRAP */';

export function serializeBootstrap(vault) {
  return JSON.stringify(vault)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function injectVault(document, vault) {
  const bootstrap = `window.__NEURAL_HOST__="obsidian";window.__NEURAL_VAULT__=${serializeBootstrap(vault)};`;
  return document.replace(BOOTSTRAP_SLOT, () => bootstrap);
}

export function createUiDocument(script, css) {
  const inlineScript = script.replace(/<\/script/gi, '<\\/script');
  const inlineCss = css.replace(/<\/style/gi, '<\\/style');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none';">
<title>Neural Vault</title>
<style>${inlineCss}</style>
<script>${BOOTSTRAP_SLOT}</script>
</head>
<body><div id="root"></div><script>${inlineScript}</script></body>
</html>`;
}
