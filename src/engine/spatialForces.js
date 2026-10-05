// The tree approximates distant repulsion; nearby label contacts stay exact.
export function buildRepulsionTree(nodes) {
  if (!nodes.length) return null;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const node of nodes) {
    left = Math.min(left, node.x); top = Math.min(top, node.y);
    right = Math.max(right, node.x); bottom = Math.max(bottom, node.y);
  }
  const size = Math.max(right - left, bottom - top, 1);
  const build = (points, x, y, width, depth) => {
    let sumX = 0, sumY = 0;
    for (const point of points) { sumX += point.x; sumY += point.y; }
    const cell = { x, y, width, count: points.length, cx: sumX / points.length, cy: sumY / points.length };
    if (points.length <= 4 || depth >= 20) { cell.points = points; return cell; }
    const half = width / 2;
    const buckets = [[], [], [], []];
    for (const point of points) buckets[(point.x >= x + half ? 1 : 0) + (point.y >= y + half ? 2 : 0)].push(point);
    cell.children = buckets.map((bucket, index) => bucket.length
      ? build(bucket, x + (index % 2) * half, y + Math.floor(index / 2) * half, half, depth + 1) : null);
    return cell;
  };
  return build(nodes, left, top, size + 0.001, 0);
}

export function addTreeRepulsion(tree, node, repulsion, force, theta = 0.65) {
  let visits = 0;
  const add = (x, y, count, point) => {
    let dx = node.x - x, dy = node.y - y;
    if (Math.abs(dx) + Math.abs(dy) < 0.001) {
      const a = Math.min(node.index, point?.index ?? 0), b = Math.max(node.index, point?.index ?? 0);
      const angle = (a + b * 7) * 2.399963229728653;
      const direction = node.index === a ? 1 : -1;
      dx = Math.cos(angle) * 0.1 * direction;
      dy = Math.sin(angle) * 0.1 * direction;
    }
    const distance = Math.hypot(dx, dy);
    const strength = Math.min(8, repulsion / Math.max(100, distance * distance)) * count;
    force.x += dx / distance * strength;
    force.y += dy / distance * strength;
  };
  const visit = (cell) => {
    if (!cell) return;
    visits++;
    if (cell.points) {
      for (const point of cell.points) if (point !== node) add(point.x, point.y, 1, point);
      return;
    }
    const contains = node.x >= cell.x && node.x <= cell.x + cell.width && node.y >= cell.y && node.y <= cell.y + cell.width;
    if (!contains && cell.width / Math.max(0.001, Math.hypot(node.x - cell.cx, node.y - cell.cy)) < theta) {
      add(cell.cx, cell.cy, cell.count);
    } else for (const child of cell.children) visit(child);
  };
  visit(tree);
  return visits;
}

export function visitNearbyPairs(nodes, cellWidth, cellHeight, callback) {
  const buckets = new Map();
  const width = Math.max(1, cellWidth), height = Math.max(1, cellHeight);
  for (const node of nodes) {
    const x = Math.floor(node.x / width), y = Math.floor((node.y + node.titleOffset) / height);
    const key = `${x},${y}`;
    if (!buckets.has(key)) buckets.set(key, { x, y, nodes: [] });
    buckets.get(key).nodes.push(node);
  }
  let pairs = 0;
  for (const bucket of buckets.values()) {
    for (let a = 0; a < bucket.nodes.length; a++) {
      for (let b = a + 1; b < bucket.nodes.length; b++) { callback(bucket.nodes[a], bucket.nodes[b]); pairs++; }
    }
    for (const [dx, dy] of [[0, 1], [1, -1], [1, 0], [1, 1]]) {
      const other = buckets.get(`${bucket.x + dx},${bucket.y + dy}`);
      if (other) for (const first of bucket.nodes) for (const second of other.nodes) { callback(first, second); pairs++; }
    }
  }
  return pairs;
}
