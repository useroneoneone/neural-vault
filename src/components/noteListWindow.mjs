export const NOTE_ROW_HEIGHT = 52;
export const NOTE_LIST_PADDING = 4;
export const NOTE_LIST_OVERSCAN = 3;

/** A scroll window over equally sized rows, including the list's vertical padding. */
export function getNoteListWindow({ count, scrollTop = 0, viewportHeight = 0, rowHeight = NOTE_ROW_HEIGHT, overscan = NOTE_LIST_OVERSCAN, padding = NOTE_LIST_PADDING }) {
  const rowCount = Math.max(0, Math.floor(count));
  const height = Math.max(0, viewportHeight);
  const totalHeight = rowCount * rowHeight + padding * 2;
  const top = Math.max(0, Math.min(scrollTop, Math.max(0, totalHeight - height)));

  if (!rowCount || !height) {
    return { start: 0, end: 0, visibleStart: 0, visibleEnd: 0, totalHeight, scrollTop: top };
  }

  const visibleStart = Math.min(rowCount - 1, Math.max(0, Math.floor((top - padding) / rowHeight)));
  const visibleEnd = Math.min(rowCount, Math.max(visibleStart + 1, Math.ceil((top + height - padding) / rowHeight)));
  return {
    start: Math.max(0, visibleStart - overscan),
    end: Math.min(rowCount, visibleEnd + overscan),
    visibleStart,
    visibleEnd,
    totalHeight,
    scrollTop: top,
  };
}

/** Keep a selected row visible, moving only as far as needed. */
export function getNoteScrollTop({ index, count, scrollTop = 0, viewportHeight = 0, rowHeight = NOTE_ROW_HEIGHT, padding = NOTE_LIST_PADDING }) {
  const maximum = Math.max(0, count * rowHeight + padding * 2 - viewportHeight);
  const current = Math.max(0, Math.min(scrollTop, maximum));
  if (index < 0 || index >= count || viewportHeight <= 0) return current;

  const rowTop = padding + index * rowHeight;
  const rowBottom = rowTop + rowHeight;
  let target = current;
  if (rowTop < current || viewportHeight < rowHeight) target = rowTop;
  else if (rowBottom > current + viewportHeight) target = rowBottom - viewportHeight;
  return Math.max(0, Math.min(target, maximum));
}
