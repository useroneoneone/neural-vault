import test from 'node:test';
import assert from 'node:assert/strict';
import { getNoteListWindow, getNoteScrollTop, NOTE_ROW_HEIGHT } from '../src/components/noteListWindow.mjs';

test('a large folder mounts only the viewport and a small overscan', () => {
  const window = getNoteListWindow({ count: 100_000, viewportHeight: 680 });
  assert.equal(window.visibleStart, 0);
  assert.equal(window.visibleEnd, 13);
  assert.equal(window.start, 0);
  assert.equal(window.end, 16);
  assert.equal(window.totalHeight, 100_000 * NOTE_ROW_HEIGHT + 8);
});

test('partially scrolled rows are included and mounting remains bounded', () => {
  const window = getNoteListWindow({ count: 10_000, scrollTop: 100 * 52 + 20, viewportHeight: 680 });
  assert.equal(window.visibleStart, 100);
  assert.equal(window.visibleEnd, 114);
  assert.equal(window.start, 97);
  assert.equal(window.end, 117);
});

test('scrolling beyond the end clamps the window and retains the final row', () => {
  const window = getNoteListWindow({ count: 1_000, scrollTop: 999_999, viewportHeight: 680 });
  assert.equal(window.scrollTop, 1_000 * 52 + 8 - 680);
  assert.equal(window.end, 1_000);
  assert.equal(window.visibleEnd, 1_000);
  assert.ok(window.start > 970);
});

test('empty directories and zero-height viewports mount no rows', () => {
  for (const options of [{ count: 0, viewportHeight: 680 }, { count: 10_000, viewportHeight: 0 }]) {
    const window = getNoteListWindow(options);
    assert.equal(window.start, 0);
    assert.equal(window.end, 0);
  }
});

test('short directories retain every row without a truncated total', () => {
  const window = getNoteListWindow({ count: 3, scrollTop: -10, viewportHeight: 680 });
  assert.equal(window.start, 0);
  assert.equal(window.end, 3);
  assert.equal(window.scrollTop, 0);
  assert.equal(window.totalHeight, 164);
});

test('a narrower viewport changes the virtual row range', () => {
  const small = getNoteListWindow({ count: 100, viewportHeight: 140 });
  const large = getNoteListWindow({ count: 100, viewportHeight: 680 });
  assert.equal(small.visibleEnd, 3);
  assert.ok(small.end < large.end);
});

test('selecting a distant note scrolls just enough to expose the entire row', () => {
  const next = getNoteScrollTop({ index: 500, count: 1_000, scrollTop: 0, viewportHeight: 680 });
  assert.equal(next, 4 + 501 * 52 - 680);
  const window = getNoteListWindow({ count: 1_000, scrollTop: next, viewportHeight: 680 });
  assert.ok(window.visibleStart <= 500 && window.visibleEnd > 500);
});

test('a visible selected note does not move the list, and a preceding one returns to its top', () => {
  assert.equal(getNoteScrollTop({ index: 2, count: 100, scrollTop: 0, viewportHeight: 680 }), 0);
  assert.equal(getNoteScrollTop({ index: 1, count: 100, scrollTop: 1_000, viewportHeight: 680 }), 56);
});

test('active selection is bounded at the end, tolerates missing IDs, and works in a tiny viewport', () => {
  assert.equal(getNoteScrollTop({ index: 999, count: 1_000, viewportHeight: 680 }), 51_324);
  assert.equal(getNoteScrollTop({ index: -1, count: 100, scrollTop: 100, viewportHeight: 680 }), 100);
  assert.equal(getNoteScrollTop({ index: 5, count: 100, viewportHeight: 20 }), 264);
});
