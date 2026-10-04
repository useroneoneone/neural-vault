let nextRequest = 0;

function cancelledError() {
  const error = new Error('复制已取消。');
  error.name = 'AbortError';
  return error;
}

/** The legacy browser path also restores the user's editor focus and selection. */
export function legacyCopyText(text, win) {
  const document = win?.document;
  if (!document?.body || typeof document.execCommand !== 'function') {
    throw new Error('剪贴板暂不可用，请选中文本后手动复制。');
  }
  const focused = document.activeElement;
  const inputSelection = focused && typeof focused.selectionStart === 'number'
    ? [focused.selectionStart, focused.selectionEnd, focused.selectionDirection]
    : null;
  const selection = win.getSelection?.();
  const ranges = [];
  for (let index = 0; index < (selection?.rangeCount ?? 0); index++) ranges.push(selection.getRangeAt(index).cloneRange());
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.tabIndex = -1;
  textarea.setAttribute('aria-hidden', 'true');
  Object.assign(textarea.style, { position: 'fixed', left: '-9999px', top: '0', opacity: '0' });
  document.body.appendChild(textarea);
  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    if (!document.execCommand('copy')) throw new Error('复制失败，请选中文本后手动复制。');
  } finally {
    textarea.remove();
    if (selection) {
      try {
        selection.removeAllRanges();
        for (const range of ranges) {
          try { selection.addRange(range); } catch { /* Ignore a range from a detached editor. */ }
        }
      } catch { /* A closing document may no longer expose its selection. */ }
    }
    // Restore input selection last: changing document ranges can clear it.
    if (focused?.isConnected !== false) {
      try {
        focused?.focus({ preventScroll: true });
        if (inputSelection) focused.setSelectionRange(...inputSelection);
      } catch { /* The original editor may have been removed during the copy. */ }
    }
  }
}

function copyThroughHost(text, win, { signal, timeoutMs = 6000 } = {}) {
  if (!win.parent || win.parent === win) return Promise.reject(new Error('复制服务未连接，请重新打开此页面。'));
  if (signal?.aborted) return Promise.reject(cancelledError());
  const requestId = `copy-${Date.now().toString(36)}-${++nextRequest}`;
  return new Promise((resolve, reject) => {
    let timer;
    const finish = (error) => {
      win.clearTimeout(timer);
      win.removeEventListener('message', onMessage);
      win.removeEventListener('pagehide', onCancel);
      signal?.removeEventListener('abort', onCancel);
      if (error) reject(error);
      else resolve();
    };
    const onCancel = () => finish(cancelledError());
    const onMessage = (event) => {
      const response = event.data;
      if (event.source !== win.parent || response?.type !== 'neural-vault:copy-result' || response.requestId !== requestId) return;
      if (response.ok === true) finish();
      else if (response.ok === false) finish(new Error(typeof response.error === 'string' ? response.error : '复制失败，请重试。'));
    };
    win.addEventListener('message', onMessage);
    win.addEventListener('pagehide', onCancel);
    signal?.addEventListener('abort', onCancel, { once: true });
    timer = win.setTimeout(() => finish(new Error('复制等待超时，请重试。')), timeoutMs);
    try {
      win.parent.postMessage({ type: 'neural-vault:copy-text', requestId, text }, '*');
    } catch {
      finish(new Error('复制请求发送失败，请重试。'));
    }
  });
}

/** Resolve only after text was actually written; callers display failures from rejection. */
export async function copyTextInWindow(text, win, options = {}) {
  if (typeof text !== 'string') throw new TypeError('复制内容必须是文本。');
  if (!win) throw new Error('剪贴板暂不可用。');
  if (options.signal?.aborted) throw cancelledError();
  if (win.__NEURAL_HOST__ === 'obsidian') return copyThroughHost(text, win, options);
  if (typeof win.navigator?.clipboard?.writeText === 'function') {
    try {
      await win.navigator.clipboard.writeText(text);
      if (options.signal?.aborted) throw cancelledError();
      return;
    } catch (error) {
      if (options.signal?.aborted) throw cancelledError();
    }
  }
  legacyCopyText(text, win);
}

export function copyText(text, options) {
  return copyTextInWindow(text, typeof window === 'undefined' ? null : window, options);
}
