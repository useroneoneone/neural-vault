import test from 'node:test';
import assert from 'node:assert/strict';
import { InsightSimulation } from '../src/engine/InsightSimulation.js';

// Keep physics verification independent of the user's local vault snapshot.
// Six groups mix short Chinese labels, wrapped labels, and English filenames;
// resolved directed links and mutual pairs include hubs and cross-group links.
const GROUPS = ['projects', 'assets', 'resources', 'support', 'ideas', 'skills'];
const TITLES = [
  '概念',
  '项目复盘与下一步计划',
  '从信息收集到知识应用的完整实践记录',
  '长期研究资料与跨领域案例整理',
  'README',
  '工具使用方法和常见问题',
  '知识连接',
];
const FIXTURE = (() => {
  const notes = Array.from({ length: 42 }, (_, index) => ({
    id: `${GROUPS[index % GROUPS.length]}/note-${index}.md`,
    cat: GROUPS[index % GROUPS.length],
    title: `${TITLES[index % TITLES.length]} ${index + 1}`,
  }));
  const edges = [];
  const seen = new Set();
  const link = (source, target, mutual) => {
    const key = [source, target].sort((a, b) => a - b).join(':');
    if (source === target || seen.has(key)) return;
    seen.add(key);
    edges.push({ source: notes[source].id, target: notes[target].id, mutual });
  };
  for (let index = 0; index < notes.length; index++) {
    link(index, (index + 1) % notes.length, index % 4 === 0);
    if (index % 3 === 0) link(index, 0, index % 6 === 0);
    if (index % 4 === 0) link(index, (index + 11) % notes.length, false);
  }
  return { notes, edges };
})();

const advance = (simulation, frames) => {
  for (let i = 0; i < frames; i++) simulation.step(1 / 60);
};

test('settled physics pauses and drag or resize resumes its actual integration', () => {
  const graph = new InsightSimulation(FIXTURE.notes, FIXTURE.edges);
  graph.resize(1083, 882);
  advance(graph, 900);
  assert.equal(graph.isSettled, true);
  const positions = graph.nodes.map(({ x, y }) => ({ x, y }));
  const steps = graph.stats.integrationSteps;
  advance(graph, 120);
  assert.equal(graph.stats.integrationSteps, steps);
  assert.deepEqual(graph.nodes.map(({ x, y }) => ({ x, y })), positions);
  const node = graph.nodes[0];
  graph.startDrag(node.id, node.x + 80, node.y + 40);
  graph.step(1 / 60);
  assert.equal(graph.stats.integrationSteps, steps + 1);
  graph.endDrag();
  advance(graph, 900);
  assert.equal(graph.isSettled, true);
  graph.resize(1280, 800);
  assert.equal(graph.isSettled, false);
  const resumed = graph.stats.integrationSteps;
  graph.step(1 / 60);
  assert.equal(graph.stats.integrationSteps, resumed + 1);
  assertContained(graph);
});

test('a 600-note fixture starts without synchronous warmup and uses spatial forces', () => {
  const notes = Array.from({ length: 600 }, (_, index) => ({ id: `note-${index}`, title: `笔记 ${index}` }));
  const edges = notes.slice(1).map((note, index) => ({ source: notes[index].id, target: note.id }));
  const graph = new InsightSimulation(notes, edges);
  graph.resize(1440, 900);
  assert.equal(graph.stats.warmupSteps, 0);
  assert.equal(graph.stats.integrationSteps, 0);
  graph.step(1 / 60);
  assert.ok(graph.stats.repulsionVisits < notes.length * notes.length * 0.6, 'distant cells are aggregated');
  assert.ok(graph.stats.collisionPairs < 3 * notes.length * (notes.length - 1) / 2, 'contacts use local spatial buckets');
  advance(graph, 900);
  assertContained(graph);
  assert.equal(graph.isSettled, true);
  const xs = graph.nodes.map((node) => node.x), ys = graph.nodes.map((node) => node.y);
  assert.ok(Math.max(...xs) - Math.min(...xs) > graph.bounds.width * 0.65);
  assert.ok(Math.max(...ys) - Math.min(...ys) > graph.bounds.height * 0.65);
  const neighbour = graph.nodes[1], previous = { x: neighbour.x, y: neighbour.y };
  graph.startDrag(graph.nodes[0].id, graph.bounds.right, graph.bounds.top);
  advance(graph, 30);
  assert.ok(Math.hypot(neighbour.x - previous.x, neighbour.y - previous.y) > 0.1);
  assertContained(graph);
});

function assertContained(simulation) {
  const { left, right, top, bottom } = simulation.bounds;
  for (const node of simulation.nodes) {
    for (const key of ['x', 'y', 'vx', 'vy']) assert.ok(Number.isFinite(node[key]), `${node.id}.${key} is finite`);
    assert.ok(node.x >= left && node.x <= right, `${node.id} is inside horizontal bounds`);
    assert.ok(node.y >= top && node.y <= bottom, `${node.id} is inside vertical bounds`);
  }
}

test('a representative graph opens as a spacious, reproducible graph', () => {
  const graph = new InsightSimulation(FIXTURE.notes, FIXTURE.edges);
  graph.resize(1440, 900);
  advance(graph, 600);
  assertContained(graph);
  let minDistance = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    for (let j = i + 1; j < graph.nodes.length; j++) {
      minDistance = Math.min(minDistance, Math.hypot(graph.nodes[i].x - graph.nodes[j].x, graph.nodes[i].y - graph.nodes[j].y));
    }
  }
  assert.ok(minDistance > 35, `nodes have room to be individually selected (${minDistance})`);
  const xs = graph.nodes.map((node) => node.x);
  const ys = graph.nodes.map((node) => node.y);
  assert.ok(Math.max(...xs) - Math.min(...xs) > graph.bounds.width * 0.7, 'layout spans the safe width');
  assert.ok(Math.max(...ys) - Math.min(...ys) > graph.bounds.height * 0.7, 'layout spans the safe height');
  const replica = new InsightSimulation(FIXTURE.notes, FIXTURE.edges);
  replica.resize(1440, 900);
  advance(replica, 600);
  assert.deepEqual(replica.nodes, graph.nodes);
});

test('dragging a pinned node pulls a linked neighbour through the spring', () => {
  const notes = ['a', 'b', 'c'].map((id) => ({ id, title: id }));
  const graph = new InsightSimulation(notes, [{ source: 'a', target: 'b' }]);
  const control = new InsightSimulation(notes, []);
  graph.resize(1000, 700);
  control.resize(1000, 700);
  const a = graph.nodeMap.get('a');
  const b = graph.nodeMap.get('b');
  const dragX = graph.bounds.right;
  const dragY = graph.bounds.top;
  assert.equal(graph.startDrag('a', dragX, dragY), true);
  // Match the control's initial geometry so the test isolates the edge force.
  for (const node of control.nodes) Object.assign(node, graph.nodeMap.get(node.id));
  control.startDrag('a', dragX, dragY);
  advance(graph, 90);
  advance(control, 90);
  assert.equal(a.x, dragX);
  assert.equal(a.y, dragY);
  const linkedDistance = Math.hypot(b.x - a.x, b.y - a.y);
  const controlB = control.nodeMap.get('b');
  const unlinkedDistance = Math.hypot(controlB.x - dragX, controlB.y - dragY);
  assert.ok(linkedDistance + 20 < unlinkedDistance, 'the connected node follows more than an unlinked node');
  graph.dragTo(dragX - 90, dragY + 60);
  assert.equal(a.x, dragX - 90);
  assert.equal(a.y, dragY + 60);
  graph.endDrag();
  advance(graph, 900);
  assertContained(graph);
  const speed = Math.max(...graph.nodes.map((node) => Math.hypot(node.vx, node.vy)));
  assert.ok(speed < 0.02, `release gently converges (${speed})`);
  assert.equal(graph.isSettled, true);
});

test('the preview viewport has separated titles after the graph settles', () => {
  const graph = new InsightSimulation(FIXTURE.notes, FIXTURE.edges);
  graph.resize(1083, 882);
  advance(graph, 1200);
  for (let i = 0; i < graph.nodes.length; i++) {
    for (let j = i + 1; j < graph.nodes.length; j++) {
      const a = graph.nodes[i];
      const b = graph.nodes[j];
      const width = Math.min(graph.labelWidth, (a.titleWidth + b.titleWidth) / 2);
      const height = Math.min(graph.labelHeight, (a.titleHeight + b.titleHeight) / 2);
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y + a.titleOffset - b.y - b.titleOffset);
      assert.ok(dx >= width || dy >= height, `title space separates ${a.id} and ${b.id}`);
    }
  }
  assertContained(graph);
  assert.equal(graph.isSettled, true);
});

test('resize preserves relative positions and remains finite on compact screens', () => {
  const graph = new InsightSimulation(FIXTURE.notes, FIXTURE.edges);
  graph.resize(1440, 900);
  const before = graph.nodes.map((node) => ({
    x: (node.x - graph.bounds.left) / graph.bounds.width,
    y: (node.y - graph.bounds.top) / graph.bounds.height,
  }));
  graph.resize(800, 600);
  graph.nodes.forEach((node, index) => {
    assert.ok(Math.abs((node.x - graph.bounds.left) / graph.bounds.width - before[index].x) < 1e-10);
    assert.ok(Math.abs((node.y - graph.bounds.top) / graph.bounds.height - before[index].y) < 1e-10);
  });
  for (const [width, height] of [[375, 667], [280, 260], [1, 1], [1920, 1080]]) {
    graph.resize(width, height);
    assert.ok(graph.bounds.width > 0 && graph.bounds.height > 0);
    graph.startDrag(graph.nodes[0].id, -1000, 10000);
    graph.dragTo(Infinity, NaN);
    graph.endDrag();
    graph.step(NaN);
    graph.step(200);
    advance(graph, 120);
    assertContained(graph);
  }
});

test('reset and empty or invalid graph input stay deterministic and harmless', () => {
  const empty = new InsightSimulation([], [{ source: 'missing', target: 'missing' }]);
  empty.resize(800, 600);
  empty.step(1 / 60);
  assert.equal(empty.startDrag('missing', 20, 30), false);
  const graph = new InsightSimulation(FIXTURE.notes, FIXTURE.edges);
  graph.resize(1280, 800);
  graph.reset();
  const initial = structuredClone(graph.nodes);
  advance(graph, 100);
  graph.reset();
  assert.deepEqual(graph.nodes, initial);
});
