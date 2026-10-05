import test from 'node:test';
import assert from 'node:assert/strict';
import { InsightCamera, insightWorldScale } from '../src/engine/InsightCamera.js';
import { InsightSimulation } from '../src/engine/InsightSimulation.js';

const close = (actual, expected, message = '') => {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} ≈ ${expected}`);
};

test('world scale preserves small graphs and grows area with the note count', () => {
  for (const count of [0, 1, 42, 64, -1, NaN, Infinity]) assert.equal(insightWorldScale(count), 1);
  assert.equal(insightWorldScale(256), 2);
  close(insightWorldScale(600), Math.sqrt(600 / 64));
});

test('small graphs fit at their original scale and large worlds fit the viewport', () => {
  const camera = new InsightCamera();
  camera.resize(1083, 882, 1083, 882);
  assert.equal(camera.zoom, 1);
  assert.deepEqual({ x: camera.x, y: camera.y }, { x: 541.5, y: 441 });
  assert.deepEqual(camera.worldToScreen(0, 0), { x: 0, y: 0 });
  const scale = insightWorldScale(600);
  camera.resize(1083, 882, 1083 * scale, 882 * scale);
  close(camera.zoom, 1 / scale);
  const corner = camera.worldToScreen(camera.worldWidth, camera.worldHeight);
  close(corner.x, 1083);
  close(corner.y, 882);
  camera.resize(1083, 882, 5000, 2000);
  close(camera.zoom, 1083 / 5000);
  assert.ok(camera.worldToScreen(0, 0).y >= 0);
  assert.ok(camera.worldToScreen(5000, 2000).y <= 882);
});

test('coordinate transforms are reversible after pan and zoom', () => {
  const camera = new InsightCamera().resize(1280, 720, 2560, 1440);
  camera.zoomAt(1.8, 170, 600).panBy(-143, 72);
  for (const point of [{ x: 0, y: 0 }, { x: 823, y: 522 }, { x: -100, y: 2700 }]) {
    const screen = camera.worldToScreen(point.x, point.y);
    const world = camera.screenToWorld(screen.x, screen.y);
    close(world.x, point.x);
    close(world.y, point.y);
  }
});

test('zoom fixes the world point under the pointer even when a limit is reached', () => {
  const camera = new InsightCamera().resize(1083, 882, 3249, 2646);
  const pointer = { x: 100, y: 700 };
  const anchor = camera.screenToWorld(pointer.x, pointer.y);
  for (const factor of [1.6, 1000, 0.00001, 2]) {
    camera.zoomAt(factor, pointer.x, pointer.y);
    const after = camera.screenToWorld(pointer.x, pointer.y);
    close(after.x, anchor.x);
    close(after.y, anchor.y);
    assert.ok(camera.zoom >= camera.minZoom && camera.zoom <= 2.5);
  }
  close(camera.minZoom, Math.max(0.08, camera.fitZoom * 0.5));
  camera.resize(1000, 500, 100000, 50000);
  assert.equal(camera.minZoom, 0.08);
  assert.equal(camera.zoom, 0.08);
});

test('panning moves visible graph coordinates by the screen drag distance', () => {
  const camera = new InsightCamera().resize(1200, 800, 2400, 1600);
  const before = camera.worldToScreen(720, 320);
  camera.panBy(120, -80);
  const after = camera.worldToScreen(720, 320);
  close(after.x - before.x, 120);
  close(after.y - before.y, -80);
});

test('resize can retain the relative world position and zoom or explicitly fit', () => {
  const camera = new InsightCamera().resize(1200, 800, 2400, 1600);
  camera.zoomAt(1.5).panBy(100, -50);
  const relative = { x: camera.x / 2400, y: camera.y / 1600, zoom: camera.zoom / camera.fitZoom };
  camera.resize(800, 600, 4000, 3000, { fit: false });
  close(camera.x / camera.worldWidth, relative.x);
  close(camera.y / camera.worldHeight, relative.y);
  close(camera.zoom / camera.fitZoom, relative.zoom);
  camera.setViewport(1000, 750);
  close(camera.x / camera.worldWidth, relative.x);
  close(camera.y / camera.worldHeight, relative.y);
  close(camera.zoom / camera.fitZoom, relative.zoom);
  camera.setViewport(800, 600, { fit: true });
  close(camera.x, 2000);
  close(camera.y, 1500);
  close(camera.zoom, 0.2);
});

test('invalid inputs retain finite camera state and finite transformed points', () => {
  const camera = new InsightCamera().resize(1083, 882, 2166, 1764);
  camera.resize(NaN, Infinity, -100, 0, { fit: false });
  camera.zoomAt(NaN, NaN, Infinity).zoomAt(-1).zoomAt(0);
  camera.panBy(Infinity, NaN);
  for (const key of ['viewportWidth', 'viewportHeight', 'worldWidth', 'worldHeight', 'x', 'y', 'zoom', 'fitZoom', 'minZoom', 'maxZoom']) {
    assert.ok(Number.isFinite(camera[key]), `${key} is finite`);
  }
  for (const point of [camera.screenToWorld(NaN, Infinity), camera.worldToScreen(NaN, Infinity)]) {
    assert.ok(Number.isFinite(point.x));
    assert.ok(Number.isFinite(point.y));
  }
  assert.ok(camera.zoom >= camera.minZoom && camera.zoom <= camera.maxZoom);
});

test('camera screen dragging pins a simulation node and moves its linked neighbour through zoom and pan', () => {
  const notes = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }];
  const simulation = new InsightSimulation(notes, [
    { source: 'a', target: 'b', mutual: true },
    { source: 'b', target: 'c', mutual: false },
  ]);
  const camera = new InsightCamera().resize(1200, 800, 2400, 1600);
  simulation.resize(camera.worldWidth, camera.worldHeight);
  const pinned = simulation.nodeMap.get('a');
  const neighbour = simulation.nodeMap.get('b');
  const drag = (screen, start) => {
    const before = { x: neighbour.x, y: neighbour.y };
    const world = camera.screenToWorld(screen.x, screen.y);
    if (start) assert.equal(simulation.startDrag('a', world.x, world.y), true);
    else simulation.dragTo(world.x, world.y);
    for (let frame = 0; frame < 12; frame++) simulation.step(1 / 60);
    const rendered = camera.worldToScreen(pinned.x, pinned.y);
    close(rendered.x, screen.x, 'pinned screen x');
    close(rendered.y, screen.y, 'pinned screen y');
    assert.ok(Math.hypot(neighbour.x - before.x, neighbour.y - before.y) > 0.1, 'a linked neighbour responds to the dragged node');
  };
  drag({ x: 640, y: 430 }, true);
  camera.zoomAt(1.6, 500, 350).panBy(80, -45);
  drag({ x: 620, y: 380 }, false);
  simulation.endDrag();
  assert.equal(simulation.dragged, null);
});
