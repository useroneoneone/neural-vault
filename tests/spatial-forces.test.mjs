import test from 'node:test';
import assert from 'node:assert/strict';
import { addTreeRepulsion, buildRepulsionTree, visitNearbyPairs } from '../src/engine/spatialForces.js';
import { wrapLabel } from '../src/engine/labelLayout.js';

test('unapproximated tree force matches direct repulsion and excludes self', () => {
  const nodes = Array.from({ length: 30 }, (_, index) => ({ index, x: index % 6 * 55, y: Math.floor(index / 6) * 60, titleOffset: 0 }));
  const tree = buildRepulsionTree(nodes);
  for (const node of nodes) {
    const actual = { x: 0, y: 0 }, expected = { x: 0, y: 0 };
    addTreeRepulsion(tree, node, 5000, actual, 0);
    for (const other of nodes) {
      if (other === node) continue;
      const dx = node.x - other.x, dy = node.y - other.y, distance = Math.hypot(dx, dy);
      const strength = Math.min(8, 5000 / Math.max(100, distance * distance));
      expected.x += dx / distance * strength; expected.y += dy / distance * strength;
    }
    assert.ok(Math.abs(actual.x - expected.x) < 1e-10);
    assert.ok(Math.abs(actual.y - expected.y) < 1e-10);
  }
});

test('collision grid visits every nearby contact once, including negative cells', () => {
  const nodes = Array.from({ length: 180 }, (_, index) => ({
    index, x: (index * 37 % 710) - 300, y: (index * 43 % 580) - 200, titleOffset: index % 3 * 7.5,
  }));
  const visited = new Set();
  const pairs = visitNearbyPairs(nodes, 150, 58, (a, b) => {
    const key = [a.index, b.index].sort((x, y) => x - y).join(':');
    assert.equal(visited.has(key), false);
    visited.add(key);
  });
  assert.ok(pairs < nodes.length * (nodes.length - 1) / 2);
  for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
    if (Math.abs(nodes[a].x - nodes[b].x) < 150 && Math.abs(nodes[a].y + nodes[a].titleOffset - nodes[b].y - nodes[b].titleOffset) < 58) {
      assert.ok(visited.has(`${a}:${b}`));
    }
  }
});

test('labels use the supplied real font measurement and preserve the full title', () => {
  const title = 'WWW长标题WWW长标题WWW长标题WWW';
  const measure = (text) => [...text].reduce((sum, char) => sum + (char === 'W' ? 12 : 11), 0);
  const label = wrapLabel(title, measure);
  assert.equal(label.lines.join(''), title);
  assert.ok(label.lines.length > 1);
  assert.ok(label.lines.every((line) => measure(line) <= 142));
  assert.equal(label.width, Math.max(...label.lines.map(measure)));
});
