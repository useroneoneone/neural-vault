import test from 'node:test';
import assert from 'node:assert/strict';
import { branchLayoutMetrics, categoryLayoutCapacity, categoryScene } from '../src/engine/categoryLayout.js';

const roots = (count) => Array.from({ length: count }, (_, index) => ({ id: `folder:${index}`, pos: [0, 0] }));

test('six known categories keep their original star coordinates', () => {
  const categories = [
    ['projects', [0, -1]], ['assets', [-1, -0.02]], ['resources', [-0.74, 0.5]],
    ['support', [1, -0.02]], ['inspiration', [0.72, 0.5]], ['skills', [0, 1]],
  ].map(([id, pos]) => ({ id, pos }));
  const scene = categoryScene(categories, 1280, 800, 'galaxy', null, 99);
  assert.equal(scene.pageCount, 1);
  assert.equal(scene.page, 0);
  for (const category of categories) {
    const target = scene.targets.get(category.id);
    assert.equal(target.x, 640 + category.pos[0] * Math.min(1280 * 0.33, 800 * 0.78));
    assert.equal(target.y, 800 * 0.43 + category.pos[1] * 800 * 0.32);
  }
});

test('many roots use separated pages and every root is reachable', () => {
  const categories = roots(70);
  const width = 1083, height = 884;
  const capacity = categoryLayoutCapacity(width, height);
  assert.ok(capacity >= 13, 'ordinary 13-folder vault fits one screen');
  const reached = new Set();
  const first = categoryScene(categories, width, height, 'galaxy');
  assert.equal(first.pageCount, Math.ceil(categories.length / capacity));
  for (let page = 0; page < first.pageCount; page++) {
    const scene = categoryScene(categories, width, height, 'galaxy', null, page);
    const visible = scene.visibleIds.map((id) => scene.targets.get(id));
    for (const id of scene.visibleIds) reached.add(id);
    for (let a = 0; a < visible.length; a++) {
      assert.ok(visible[a].x + 88 + 26 < width - 196, 'cards reserve legend and drift room');
      assert.ok(!(visible[a].x < 270 && visible[a].y < 185), 'left navigation stays clear');
      for (let b = a + 1; b < visible.length; b++) {
        assert.ok(Math.abs(visible[a].x - visible[b].x) >= 180 || Math.abs(visible[a].y - visible[b].y) >= 110, 'category cards do not overlap');
      }
    }
  }
  assert.equal(reached.size, categories.length);
  assert.equal(categoryScene(categories, width, height, 'galaxy', null, 100).page, first.pageCount - 1);
});

test('large branch windows keep each selected root visible with usable spacing', () => {
  const categories = roots(70);
  for (const category of categories) {
    const scene = categoryScene(categories, 1280, 720, 'branch', category.id);
    assert.ok(scene.visibleIds.includes(category.id));
    const visible = scene.visibleIds.map((id) => scene.targets.get(id));
    for (let i = 1; i < visible.length; i++) assert.ok(visible[i].y - visible[i - 1].y >= 82);
  }
  const empty = categoryScene([], 1280, 720, 'galaxy');
  assert.equal(empty.pageCount, 1);
  assert.equal(empty.visibleIds.length, 0);
  assert.equal(categoryScene([], 1280, 720, 'branch', 'missing').visibleIds.length, 0);
});

test('small arbitrary roots spread even when their data defaults coincide', () => {
  const scene = categoryScene(roots(4), 1280, 800, 'galaxy');
  const values = [...scene.targets.values()];
  for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) {
    assert.ok(Math.hypot(values[i].x - values[j].x, values[i].y - values[j].y) > 200);
  }
});

test('branch labels fit before the note list at 1083, 1280 and 1920 pixels', () => {
  const categories = roots(13);
  for (const [width, height] of [[1083, 884], [1280, 720], [1920, 1080]]) {
    const metrics = branchLayoutMetrics(width, height);
    const scene = categoryScene(categories, width, height, 'branch', categories[0].id);
    const maximumJellySize = Math.min(32, Math.max(18, Math.min(width, height) * 0.03));
    const drift = metrics.parallaxScale === 1 ? 26 : 8;
    for (const id of scene.visibleIds) {
      const target = scene.targets.get(id);
      const hoveredCardRight = target.x + maximumJellySize * 1.1 * 1.35 + 176 * 1.05 + drift;
      assert.ok(hoveredCardRight <= metrics.listLeft - 11, `${width}px branch reserves the note list lane`);
    }
    assert.ok(metrics.coreX + metrics.coreRadius < metrics.columnX - maximumJellySize, 'core and folder column stay separate');
  }
  const wide = branchLayoutMetrics(1920, 1080);
  assert.equal(wide.columnX, 1920 * 0.185 + 32 * 6);
  assert.equal(wide.coreX, 1920 * 0.075);
  assert.equal(wide.coreRadius, 1080 * 0.075);
  assert.equal(wide.parallaxScale, 1);
});

test('partial star pages cover both the upper and lower grid instead of filling top rows', () => {
  const width = 1083, height = 884;
  const capacity = categoryLayoutCapacity(width, height);
  const full = categoryScene(roots(capacity), width, height, 'galaxy');
  const fullYs = full.visibleIds.map((id) => full.targets.get(id).y);
  const top = Math.min(...fullYs), bottom = Math.max(...fullYs);
  for (const count of [12, 13, capacity - 1]) {
    const scene = categoryScene(roots(count), width, height, 'galaxy');
    const ys = scene.visibleIds.map((id) => scene.targets.get(id).y);
    assert.ok(Math.min(...ys) <= top, `${count} directories reach the upper grid`);
    assert.ok(Math.max(...ys) >= bottom, `${count} directories reach the lower grid`);
    assert.ok(ys.filter((y) => y < (top + bottom) / 2).length >= Math.floor(count / 3), 'upper area has multiple categories');
    assert.ok(ys.filter((y) => y > (top + bottom) / 2).length >= Math.floor(count / 3), 'lower area has multiple categories');
  }
  const lastPage = categoryScene(roots(capacity + 7), width, height, 'galaxy', null, 1);
  const lastYs = lastPage.visibleIds.map((id) => lastPage.targets.get(id).y);
  assert.equal(lastPage.visibleIds.length, 7);
  assert.ok(Math.max(...lastYs) - Math.min(...lastYs) >= (bottom - top) * 0.9, 'the final page also uses the available height');
});

test('12-folder cards reserve the bottom search bar at the observed viewport sizes', () => {
  for (const [width, height] of [[1083, 884], [1280, 720], [1514, 884]]) {
    const scene = categoryScene(roots(12), width, height, 'galaxy');
    assert.equal(scene.visibleIds.length, 12, `${width}px keeps all 12 folders on one page`);
    const search = { left: (width - 540) / 2, right: (width + 540) / 2, top: height - 74, bottom: height - 24 };
    for (const id of scene.visibleIds) {
      const target = scene.targets.get(id);
      // Include the 176px card, hover scale, jellyfish-to-card offset and drift.
      const card = { left: target.x - 101, right: target.x + 101, top: target.y + 8, bottom: target.y + 115 };
      const overlaps = card.left < search.right && card.right > search.left && card.top < search.bottom && card.bottom > search.top;
      assert.equal(overlaps, false, `${width}×${height} ${id} stays clear of search`);
    }
  }
});

test('wide 12-folder scenes form an evenly spaced ellipse around the chaos core', () => {
  for (const [width, height] of [[1514, 884], [1920, 1080]]) {
    const scene = categoryScene(roots(12), width, height, 'galaxy');
    const points = scene.visibleIds.map((id) => scene.targets.get(id));
    const cx = width / 2, cy = height * 0.43;
    const rx = Math.min(width * 0.33, cx - 292), ry = Math.min(cy - 100, height - 205 - cy);
    const angles = [];
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const ellipseRadius = ((point.x - cx) / rx) ** 2 + ((point.y - cy) / ry) ** 2;
      assert.ok(Math.abs(ellipseRadius - 1) < 1e-10, `${width}px node remains on the ellipse`);
      let angle = Math.atan2((point.y - cy) / ry, (point.x - cx) / rx);
      if (i && angle <= angles[i - 1]) angle += Math.PI * 2;
      angles.push(angle);
      for (let j = 0; j < i; j++) {
        assert.ok(Math.abs(point.x - points[j].x) >= 168.8 || Math.abs(point.y - points[j].y) >= 94, 'hovered cards retain spacing and independent floating room');
      }
      const card = { left: point.x - 91.5, right: point.x + 91.5, top: point.y + 8, bottom: point.y + 115 };
      assert.ok(card.right < width - 196, 'legend remains clear with common parallax included');
      assert.ok(card.top > 56, 'top mode bar remains clear');
      assert.ok(!(card.left < 244 && card.right > 20 && card.top < 117 && card.bottom > 72), 'folder selector remains clear');
      assert.ok(card.bottom < height - 74, 'bottom search remains clear');
    }
    const arcLengths = angles.map((angle, index) => {
      const end = index === angles.length - 1 ? angles[0] + Math.PI * 2 : angles[index + 1];
      let length = 0;
      const samples = 80;
      for (let step = 0; step < samples; step++) {
        const a = angle + (end - angle) * step / samples, b = angle + (end - angle) * (step + 1) / samples;
        length += Math.hypot(rx * (Math.cos(b) - Math.cos(a)), ry * (Math.sin(b) - Math.sin(a)));
      }
      return length;
    });
    assert.ok(Math.max(...arcLengths) / Math.min(...arcLengths) < 1.02, 'neighbouring jellyfish have nearly equal arc distances');
  }
});

test('ellipse page capacity matches page contents and keeps every directory reachable', () => {
  const width = 1514, height = 884, categories = roots(70);
  const capacity = categoryLayoutCapacity(width, height);
  assert.ok(capacity >= 12);
  const first = categoryScene(categories, width, height, 'galaxy');
  assert.equal(first.visibleIds.length, capacity);
  assert.equal(first.pageCount, Math.ceil(categories.length / capacity));
  const reached = new Set();
  for (let page = 0; page < first.pageCount; page++) {
    const scene = categoryScene(categories, width, height, 'galaxy', null, page);
    assert.equal(scene.visibleIds.length, Math.min(capacity, categories.length - page * capacity));
    for (const id of scene.visibleIds) {
      assert.equal(reached.has(id), false);
      reached.add(id);
    }
  }
  assert.equal(reached.size, categories.length);
});
