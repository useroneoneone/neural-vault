import { legacyCopyText } from '../src/utils/clipboard.js';

/** Use the host window, since a sandboxed srcdoc may lack clipboard permission. */
export async function writeHostClipboard(text, ownerWindow, isCurrent = () => true) {
  const checkCurrent = () => {
    if (!isCurrent()) throw new Error('复制已取消。');
  };
  checkCurrent();
  if (typeof ownerWindow.navigator?.clipboard?.writeText === 'function') {
    try {
      await ownerWindow.navigator.clipboard.writeText(text);
      return;
    } catch { /* Desktop hosts can still provide their native text clipboard. */ }
  }
  checkCurrent();
  if (typeof ownerWindow.require === 'function') {
    try {
      const clipboard = ownerWindow.require('electron')?.clipboard;
      if (typeof clipboard?.writeText === 'function') {
        await clipboard.writeText(text);
        return;
      }
    } catch { /* Newer Electron renderers may only expose the browser API. */ }
  }
  checkCurrent();
  legacyCopyText(text, ownerWindow);
}

export async function handleCopyRequest(event, frame, ownerWindow, isCurrent, writeText = writeHostClipboard) {
  const request = event.data;
  const source = frame?.contentWindow;
  if (!source || event.source !== source || request?.type !== 'neural-vault:copy-text' || !isCurrent()) return;
  if (typeof request.requestId !== 'string' || !request.requestId || request.requestId.length > 128) return;
  const respond = (ok, error) => {
    if (isCurrent()) source.postMessage({ type: 'neural-vault:copy-result', requestId: request.requestId, ok, ...(error ? { error } : {}) }, '*');
  };
  if (typeof request.text !== 'string') {
    respond(false, '复制内容必须是文本。');
    return;
  }
  // The UI sends a request directly from its copy button click, preserving activation.
  if (source.navigator?.userActivation?.isActive === false) {
    respond(false, '请点击复制按钮后重试。');
    return;
  }
  try {
    await writeText(request.text, ownerWindow, isCurrent);
    respond(true);
  } catch {
    respond(false, '复制失败，请选中文本后手动复制。');
  }
}
