const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const LEGACY_IDS = new Set(['projects', 'assets', 'resources', 'support', 'inspiration', 'skills']);

function categorySlots(width, height) {
  const left = Math.min(90, width * 0.15);
  const right = Math.max(left, width - (width >= 700 ? 320 : 70));
  const top = Math.min(150, height * 0.25);
  // The slot marks the jellyfish, while its card extends below it. Reserve
  // hover/drift room as well as the search bar's 74-pixel bottom band.
  const bottom = Math.max(top, height - (height >= 420 ? 205 : height * 0.12));
  const columns = Math.max(1, Math.floor((right - left) / 190) + 1);
  const rows = Math.max(1, Math.floor((bottom - top) / 115) + 1);
  const slots = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const x = columns === 1 ? (left + right) / 2 : left + column / (columns - 1) * (right - left);
    const y = rows === 1 ? (top + bottom) / 2 : top + row / (rows - 1) * (bottom - top);
    const navigatorOverlap = x < 270 && y < 185 && width >= 700 && height >= 420;
    if (!navigatorOverlap && Math.hypot((x - width / 2) / 1.25, y - height * 0.43) > Math.min(width, height) * 0.15) slots.push({ x, y });
  }
  if (!slots.length) slots.push({ x: left, y: top });
  return slots;
}

const HOVER_CARD_WIDTH = 176 * 0.88;
const CARD_SEPARATION_X = HOVER_CARD_WIDTH + 6 + 8;
const CARD_SEPARATION_Y = 80 + 6 + 8;
const starLayouts = new Map();

function ellipsePoints(width, height, count) {
  const cx = width / 2, cy = height * 0.43;
  const rx = Math.min(width * 0.33, cx - 292);
  const ry = Math.min(cy - 100, height - 205 - cy);
  if (rx < 100 || ry < 100) return null;
  // An arc-length table keeps spacing even on an ellipse with unequal axes.
  const segments = 360, lengths = [0];
  let previousX = 0, previousY = -ry, total = 0;
  for (let i = 1; i <= segments; i++) {
    const angle = -Math.PI / 2 + i / segments * Math.PI * 2;
    const x = Math.cos(angle) * rx, y = Math.sin(angle) * ry;
    total += Math.hypot(x - previousX, y - previousY);
    lengths.push(total); previousX = x; previousY = y;
  }
  const arcAngles = [];
  let segment = 0;
  for (let i = 0; i < count; i++) {
    const distance = i / count * total;
    while (segment < segments - 1 && lengths[segment + 1] < distance) segment++;
    const fraction = (distance - lengths[segment]) / (lengths[segment + 1] - lengths[segment]);
    arcAngles.push((segment + fraction) / segments * Math.PI * 2);
  }
  const safe = (points) => {
    const coreRadius = Math.min(width, height) * 0.115 + 8;
    for (let i = 0; i < points.length; i++) {
      const { x, y } = points[i];
      const left = x - HOVER_CARD_WIDTH / 2 - 14;
      const right = x + HOVER_CARD_WIDTH / 2 + 14;
      const top = y + 8, bottom = y + 115;
      if (left < 16 || right > width - 200 || top < 68 || bottom > height - 82) return false;
      if (left < 244 && right > 20 && top < 117 && bottom > 72) return false;
      const nearestX = clamp(cx, left, right), nearestY = clamp(cy, top, bottom);
      if (Math.hypot(nearestX - cx, nearestY - cy) < coreRadius) return false;
      for (let j = 0; j < i; j++) {
        if (Math.abs(x - points[j].x) < CARD_SEPARATION_X && Math.abs(y - points[j].y) < CARD_SEPARATION_Y) return false;
      }
    }
    return true;
  };
  // Prefer equal arc lengths. Small angular adjustments can keep neighbouring
  // rectangular cards apart while every jellyfish remains on the same ellipse.
  for (const blend of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    for (const phase of [0, 0.25, 0.5, 0.75]) {
      const points = arcAngles.map((angle, index) => {
        const theta = -Math.PI / 2 + angle * (1 - blend) + index / count * Math.PI * 2 * blend + phase * Math.PI * 2 / count;
        return { x: cx + Math.cos(theta) * rx, y: cy + Math.sin(theta) * ry };
      });
      if (safe(points)) return points;
    }
  }
  return null;
}

function starLayout(width, height) {
  const key = `${width},${height}`;
  if (starLayouts.has(key)) return starLayouts.get(key);
  let capacity = 0;
  for (let count = 24; count >= 12; count--) {
    if (ellipsePoints(width, height, count)) { capacity = count; break; }
  }
  const grid = categorySlots(width, height);
  const layout = { grid, capacity: capacity || grid.length, ellipse: capacity > 0 };
  starLayouts.set(key, layout);
  if (starLayouts.size > 24) starLayouts.delete(starLayouts.keys().next().value);
  return layout;
}

export const categoryLayoutCapacity = (width, height) => starLayout(width, height).capacity;

/** Share the note-list width with React so cards and list never claim one lane. */
export function branchLayoutMetrics(width, height, sidebarWidth = 452) {
  const size = clamp(Math.min(width, height) * 0.03, 18, 32);
  const listWidth = Math.min(320, Math.max(260, width - 800));
  const listLeft = width - sidebarWidth - 12 - listWidth;
  const originalColumn = width * 0.185 + size * 6;
  const labelOffset = size * 1.1 * 1.35;
  const labelWidth = 176 * 1.05;
  const gap = 12;
  const constrained = originalColumn + labelOffset + labelWidth + 26 + gap > listLeft;
  const drift = constrained ? 8 : 26;
  const columnX = Math.max(42, Math.min(originalColumn, listLeft - labelOffset - labelWidth - drift - gap));
  return {
    listWidth, listLeft, columnX, parallaxScale: constrained ? 0.2 : 1,
    coreX: constrained ? Math.min(width * 0.075, columnX * 0.28) : width * 0.075,
    coreRadius: constrained ? Math.min(Math.min(width, height) * 0.075, columnX * 0.22) : Math.min(width, height) * 0.075,
  };
}

/** Six-folder scenes keep their original layout; larger scenes get readable windows. */
export function categoryScene(categories, width, height, mode, selectedId, requestedPage = 0) {
  const count = categories.length;
  const small = count <= 6;
  const size = clamp(Math.min(width, height) * 0.03, 18, 32);
  const targets = new Map();
  if (mode === 'branch' && selectedId && categories.some((category) => category.id === selectedId)) {
    const selected = categories.find((category) => category.id === selectedId);
    const order = categories.filter((category) => category !== selected);
    order.splice(Math.floor(count / 2), 0, selected);
    const capacity = Math.max(3, Math.floor(height * 0.6 / 82) + 1);
    const selectedIndex = order.indexOf(selected);
    const start = small ? 0 : clamp(selectedIndex - Math.floor(capacity / 2), 0, Math.max(0, count - capacity));
    const visible = order.slice(start, small ? count : start + capacity);
    const top = height * 0.2, bottom = height * 0.8;
    const x = branchLayoutMetrics(width, height).columnX;
    for (const category of categories) targets.set(category.id, { x, y: height / 2, scale: 0.78, alpha: 0, visible: false });
    visible.forEach((category, index) => targets.set(category.id, {
      x, y: visible.length === 1 ? height / 2 : top + index / (visible.length - 1) * (bottom - top),
      scale: category === selected ? 1 : 0.78, alpha: category === selected ? 1 : 0.62, visible: true,
    }));
    return { targets, page: 0, pageCount: 1, visibleIds: visible.map((category) => category.id) };
  }
  if (small) {
    const rx = Math.min(width * 0.33, Math.min(width, height) * 0.78), ry = Math.min(width, height) * 0.32;
    const legacy = categories.every((category) => LEGACY_IDS.has(category.id));
    categories.forEach((category, index) => {
      const angle = -Math.PI / 2 + index / Math.max(1, count) * Math.PI * 2;
      const pos = legacy ? category.pos : [Math.cos(angle), Math.sin(angle)];
      targets.set(category.id, {
      x: width / 2 + pos[0] * rx, y: height * 0.43 + pos[1] * ry,
      scale: 1, alpha: 1, visible: true,
      });
    });
    return { targets, page: 0, pageCount: 1, visibleIds: categories.map((category) => category.id) };
  }
  const layout = starLayout(width, height);
  const pageCount = Math.max(1, Math.ceil(count / layout.capacity));
  const page = clamp(Math.floor(requestedPage), 0, pageCount - 1);
  const visible = categories.slice(page * layout.capacity, (page + 1) * layout.capacity);
  const ellipse = layout.ellipse ? ellipsePoints(width, height, visible.length) : null;
  const slots = ellipse || layout.grid;
  for (const category of categories) targets.set(category.id, { x: width / 2, y: height * 0.43, scale: 0.8, alpha: 0, visible: false });
  visible.forEach((category, index) => {
    // Partial pages spread across the entire grid rather than filling its top
    // rows first. Full pages retain one category per slot in the same order.
    const slotIndex = ellipse ? index : visible.length === 1
      ? Math.floor((slots.length - 1) / 2)
      : Math.round(index * (slots.length - 1) / (visible.length - 1));
    targets.set(category.id, { ...slots[slotIndex], scale: 0.8, alpha: 1, visible: true });
  });
  return { targets, page, pageCount, visibleIds: visible.map((category) => category.id) };
}
