import assert from 'node:assert/strict';
import test from 'node:test';
import { copyTextInWindow } from '../src/utils/clipboard.js';
import { handleCopyRequest, writeHostClipboard } from '../obsidian-plugin/clipboardBridge.js';

function frameWindow() {
  const listeners = new Map();
  const requests = [];
  const parent = { postMessage: (message) => requests.push(message) };
  const win = {
    __NEURAL_HOST__: 'obsidian', parent, requests, listeners, setTimeout, clearTimeout,
    addEventListener(type, handler) { const list = listeners.get(type) ?? new Set(); list.add(handler); listeners.set(type, list); },
    removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
    emit(type, event = {}) { for (const handler of [...listeners.get(type) ?? []]) handler(event); },
  };
  win.response = (data, source = parent) => win.emit('message', { source, data });
  return win;
}

test('browser copy writes original text and only resolves after the clipboard write completes', async () => {
  let complete;
  let written;
  const win = { navigator: { clipboard: { writeText: (text) => { written = text; return new Promise((resolve) => { complete = resolve; }); } } } };
  let settled = false;
  const copy = copyTextInWindow('  echo "$HOME"\r\nnext  ', win).then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(written, '  echo "$HOME"\r\nnext  ');
  assert.equal(settled, false);
  complete();
  await copy;
  assert.equal(settled, true);
});

function legacyWindow(success = true) {
  const range = { cloneRange() { return this; } };
  const selection = { ranges: [range], get rangeCount() { return this.ranges.length; }, getRangeAt(index) { return this.ranges[index]; }, removeAllRanges() { this.ranges = []; }, addRange(value) { this.ranges.push(value); } };
  const input = { isConnected: true, selectionStart: 2, selectionEnd: 5, selectionDirection: 'backward', focus() { this.focused = true; }, setSelectionRange(...values) { this.restored = values; } };
  let copied;
  const textarea = { style: {}, setAttribute() {}, focus() {}, select() { selection.removeAllRanges(); }, remove() { this.removed = true; } };
  const document = { activeElement: input, body: { appendChild() {} }, createElement: () => textarea, execCommand: (command) => { assert.equal(command, 'copy'); copied = textarea.value; return success; } };
  const win = { navigator: { clipboard: { writeText: async () => { throw new Error('permission denied'); } } }, document, getSelection: () => selection };
  return { win, input, textarea, selection, range, copied: () => copied };
}

test('browser fallback preserves verbatim text, editor focus, input selection and document range', async () => {
  const fixture = legacyWindow();
  await copyTextInWindow('\tline one\nline two\n', fixture.win);
  assert.equal(fixture.copied(), '\tline one\nline two\n');
  assert.equal(fixture.input.focused, true);
  assert.deepEqual(fixture.input.restored, [2, 5, 'backward']);
  assert.deepEqual(fixture.selection.ranges, [fixture.range]);
  assert.equal(fixture.textarea.removed, true);
});

test('failed fallback rejects while restoring the editor instead of reporting copied', async () => {
  const fixture = legacyWindow(false);
  await assert.rejects(copyTextInWindow('text', fixture.win), /复制失败/);
  assert.equal(fixture.input.focused, true);
  assert.equal(fixture.textarea.removed, true);
  assert.deepEqual(fixture.selection.ranges, [fixture.range]);
  await assert.rejects(copyTextInWindow({ text: 'object' }, fixture.win), TypeError);
});

test('a browser clipboard AbortError still falls back unless the caller cancelled', async () => {
  const fixture = legacyWindow();
  fixture.win.navigator.clipboard.writeText = async () => {
    const error = new Error('browser operation aborted');
    error.name = 'AbortError';
    throw error;
  };
  await copyTextInWindow('retry text', fixture.win);
  assert.equal(fixture.copied(), 'retry text');
  const controller = new AbortController();
  fixture.win.navigator.clipboard.writeText = async () => { controller.abort(); throw new Error('denied'); };
  await assert.rejects(copyTextInWindow('cancelled text', fixture.win, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(fixture.copied(), 'retry text');
});

test('iframe copy trusts only its parent and correlated successful responses', async () => {
  const win = frameWindow();
  let settled = false;
  const copy = copyTextInWindow('npm run build', win).then(() => { settled = true; });
  const request = win.requests[0];
  assert.equal(request.type, 'neural-vault:copy-text');
  assert.equal(request.text, 'npm run build');
  const response = { type: 'neural-vault:copy-result', requestId: request.requestId, ok: true };
  win.response(response, {});
  win.response({ ...response, requestId: 'other' });
  await Promise.resolve();
  assert.equal(settled, false);
  win.response(response);
  await copy;
  assert.equal(settled, true);
  assert.equal(win.listeners.get('message').size, 0);
  assert.equal(win.listeners.get('pagehide').size, 0);
});

test('iframe failures, explicit cancellation, page closure and timeout reject with listener cleanup', async () => {
  const failed = frameWindow();
  const failure = copyTextInWindow('text', failed);
  failed.response({ type: 'neural-vault:copy-result', requestId: failed.requests[0].requestId, ok: false, error: '宿主写入失败' });
  await assert.rejects(failure, /宿主写入失败/);
  assert.equal(failed.listeners.get('message').size, 0);
  const aborted = frameWindow();
  const controller = new AbortController();
  const cancellation = copyTextInWindow('text', aborted, { signal: controller.signal });
  controller.abort();
  await assert.rejects(cancellation, { name: 'AbortError' });
  assert.equal(aborted.listeners.get('message').size, 0);
  const closed = frameWindow();
  const closure = copyTextInWindow('text', closed);
  closed.emit('pagehide');
  await assert.rejects(closure, { name: 'AbortError' });
  const timedOut = frameWindow();
  await assert.rejects(copyTextInWindow('text', timedOut, { timeoutMs: 5 }), /超时/);
  assert.equal(timedOut.listeners.get('message').size, 0);
});

function hostFrame() {
  const responses = [];
  const source = { navigator: { userActivation: { isActive: true } }, postMessage: (message) => responses.push(message) };
  const frame = { contentWindow: source };
  const event = { source, data: { type: 'neural-vault:copy-text', requestId: 'copy-1', text: 'code' } };
  return { frame, event, responses };
}

test('host bridge rejects foreign senders, non-text payloads and inactive gestures without copying', async () => {
  const fixture = hostFrame();
  let writes = 0;
  const write = async () => { writes++; };
  await handleCopyRequest({ ...fixture.event, source: {} }, fixture.frame, {}, () => true, write);
  assert.equal(fixture.responses.length, 0);
  await handleCopyRequest({ ...fixture.event, data: { ...fixture.event.data, text: {} } }, fixture.frame, {}, () => true, write);
  assert.equal(fixture.responses[0].ok, false);
  fixture.event.source.navigator.userActivation.isActive = false;
  await handleCopyRequest(fixture.event, fixture.frame, {}, () => true, write);
  assert.equal(fixture.responses[1].ok, false);
  assert.equal(writes, 0);
});

test('host bridge acknowledges actual async success or failure and suppresses a stale view response', async () => {
  const fixture = hostFrame();
  let release;
  const pending = handleCopyRequest(fixture.event, fixture.frame, {}, () => true, () => new Promise((resolve) => { release = resolve; }));
  assert.equal(fixture.responses.length, 0);
  release();
  await pending;
  assert.equal(fixture.responses[0].requestId, 'copy-1');
  assert.equal(fixture.responses[0].ok, true);
  await handleCopyRequest(fixture.event, fixture.frame, {}, () => true, async () => { throw new Error('denied'); });
  assert.equal(fixture.responses[1].ok, false);
  let current = true;
  const stale = handleCopyRequest(fixture.event, fixture.frame, {}, () => current, () => new Promise((resolve) => { release = resolve; }));
  current = false;
  release();
  await stale;
  assert.equal(fixture.responses.length, 2);
});

test('host clipboard awaits browser or native writes and never falls back after view cancellation', async () => {
  const writes = [];
  const win = { navigator: { clipboard: { writeText: async () => { throw new Error('denied'); } } }, require: (name) => {
    assert.equal(name, 'electron');
    return { clipboard: { writeText: async (text) => { writes.push(text); } } };
  } };
  await writeHostClipboard('  {"key": "value"}\n', win);
  assert.deepEqual(writes, ['  {"key": "value"}\n']);
  let current = true;
  win.navigator.clipboard.writeText = async () => { current = false; throw new Error('closed'); };
  await assert.rejects(writeHostClipboard('after-close', win, () => current), /取消/);
  assert.equal(writes.length, 1);
});
