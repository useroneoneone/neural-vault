const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

/**
 * A small, deterministic force graph in canvas pixels. Velocities use pixels
 * per 60 Hz frame; step() accepts seconds, like NeuralEngine's animation loop.
 * Labels sit beneath their nodes, so a second, rectangular collision force
 * preserves enough room for two lines of text as well as the dots themselves.
 */
export class InsightSimulation {
  constructor(notes, edges) {
    this.nodes = notes.map((note, index) => {
      let currentWidth = 0, titleWidth = 0, lines = 1;
      for (const char of note.title || '') {
        const charWidth = /[\u0000-\u007f]/u.test(char) ? 5.8 : 11;
        if (currentWidth + charWidth > 142) {
          titleWidth = Math.max(titleWidth, currentWidth);
          currentWidth = 0;
          lines++;
        }
        currentWidth += charWidth;
      }
      return {
        id: note.id, x: 0, y: 0, vx: 0, vy: 0, index, degree: 0,
        titleWidth: Math.max(30, titleWidth, currentWidth) + 14,
        titleHeight: 37 + (lines - 1) * 15,
        titleOffset: 11 + (lines - 1) * 7.5,
      };
    });
    this.nodeMap = new Map(this.nodes.map((node) => [node.id, node]));
    this.edges = edges.flatMap((edge) => {
      const source = this.nodeMap.get(edge.source);
      const target = this.nodeMap.get(edge.target);
      if (!source || !target || source === target) return [];
      source.degree++;
      target.degree++;
      return [{ source, target, mutual: Boolean(edge.mutual) }];
    });
    this.width = 0;
    this.height = 0;
    this.bounds = null;
    this.dragged = null;
    this.isSettled = false;
    this.temperature = 1;
    this._forces = this.nodes.map(() => ({ x: 0, y: 0 }));
  }

  resize(width, height) {
    const previous = this.bounds;
    this.width = Math.max(1, finite(width, 1));
    this.height = Math.max(1, finite(height, 1));
    // On compact screens, reduce the UI reserve instead of inverting bounds.
    const left = this.width >= 700 ? 125 : this.width * 0.08;
    const right = this.width >= 700 ? this.width - 210 : this.width * 0.92;
    const top = this.height >= 420 ? 105 : this.height * 0.14;
    const bottom = this.height >= 420 ? this.height - 110 : this.height * 0.84;
    this.bounds = { left, right, top, bottom, width: right - left, height: bottom - top };
    const area = this.bounds.width * this.bounds.height;
    this.spacing = Math.sqrt(area / Math.max(1, this.nodes.length));
    this.labelWidth = Math.min(150, Math.max(35, this.spacing * 1.48));
    this.labelHeight = Math.min(58, Math.max(20, this.spacing * 0.62));
    this.repulsion = Math.max(80, this.spacing * this.spacing * 0.48);
    this.linkLength = this.spacing * 1.65;
    if (!previous) {
      this.reset();
      // Entering the graph should reveal a spacious layout, not a tiny knot.
      for (let frame = 0; frame < 240; frame++) this.step(1 / 60);
    } else {
      for (const node of this.nodes) {
        node.x = left + (node.x - previous.left) / previous.width * this.bounds.width;
        node.y = top + (node.y - previous.top) / previous.height * this.bounds.height;
        node.vx *= this.bounds.width / previous.width;
        node.vy *= this.bounds.height / previous.height;
        this._contain(node);
      }
      this.isSettled = false;
      this.temperature = 1;
    }
  }

  reset() {
    if (!this.bounds) return;
    this.dragged = null;
    const { left, top, width, height } = this.bounds;
    const count = Math.max(1, this.nodes.length);
    // A golden-angle disc has no random state and no exact coincident points.
    for (const node of this.nodes) {
      const angle = node.index * TAU * 0.3819660112501051;
      const radius = Math.sqrt((node.index + 0.5) / count);
      node.x = left + width * (0.5 + Math.cos(angle) * radius * 0.4);
      node.y = top + height * (0.5 + Math.sin(angle) * radius * 0.4);
      node.vx = 0;
      node.vy = 0;
    }
    this.isSettled = false;
    this.temperature = 1;
  }

  startDrag(id, x, y) {
    const node = this.nodeMap.get(id);
    if (!node || !this.bounds) return false;
    this.dragged = node;
    this.dragTo(x, y);
    return true;
  }

  dragTo(x, y) {
    if (!this.dragged) return;
    this.dragged.x = finite(x, this.dragged.x);
    this.dragged.y = finite(y, this.dragged.y);
    this._contain(this.dragged);
    this.dragged.vx = 0;
    this.dragged.vy = 0;
    this.isSettled = false;
    this.temperature = 1;
  }

  endDrag() {
    this.dragged = null;
    this.isSettled = false;
    this.temperature = 1;
  }

  step(dt) {
    if (!this.bounds || !this.nodes.length || !Number.isFinite(dt) || dt <= 0) return;
    // A resumed/background tab cannot inject a huge integration timestep.
    const frames = Math.min(dt * 60, 3);
    const substeps = Math.ceil(frames);
    const time = frames / substeps;
    for (let substep = 0; substep < substeps; substep++) this._integrate(time);
  }

  _integrate(time) {
    const { left, top, width, height } = this.bounds;
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    for (const node of this.nodes) {
      const force = this._forces[node.index];
      force.x = (centerX - node.x) * 0.0016;
      force.y = (centerY - node.y) * 0.0016;
    }

    for (let a = 0; a < this.nodes.length; a++) {
      const first = this.nodes[a];
      const firstForce = this._forces[a];
      for (let b = a + 1; b < this.nodes.length; b++) {
        const second = this.nodes[b];
        const secondForce = this._forces[b];
        let dx = first.x - second.x;
        let dy = first.y - second.y;
        if (Math.abs(dx) + Math.abs(dy) < 0.001) {
          const angle = (a + b * 7) * 2.399963229728653;
          dx = Math.cos(angle) * 0.1;
          dy = Math.sin(angle) * 0.1;
        }
        const distance = Math.hypot(dx, dy);
        const strength = Math.min(8, this.repulsion / Math.max(100, distance * distance));
        let fx = dx / distance * strength;
        let fy = dy / distance * strength;
        const collisionWidth = Math.min(this.labelWidth, (first.titleWidth + second.titleWidth) / 2);
        const collisionHeight = Math.min(this.labelHeight, (first.titleHeight + second.titleHeight) / 2);
        const overlapX = collisionWidth - Math.abs(dx);
        const overlapY = collisionHeight - Math.abs(dy + first.titleOffset - second.titleOffset);
        if (overlapX > 0 && overlapY > 0) {
          // Resolve the shortest rectangle penetration to preserve title rows.
          if (overlapX / collisionWidth < overlapY / collisionHeight) {
            fx += Math.sign(dx || 1) * overlapX * 0.024;
          } else {
            fy += Math.sign(dy || 1) * overlapY * 0.06;
          }
        }
        firstForce.x += fx;
        firstForce.y += fy;
        secondForce.x -= fx;
        secondForce.y -= fy;
      }
    }

    for (const { source, target, mutual } of this.edges) {
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.max(0.001, Math.hypot(dx, dy));
      // Hubs keep room around them instead of collapsing their many neighbours.
      const degree = Math.sqrt(Math.max(source.degree, target.degree, 1));
      const strength = (distance - this.linkLength) * (mutual ? 0.0075 : 0.0065) / degree;
      const fx = dx / distance * strength;
      const fy = dy / distance * strength;
      this._forces[source.index].x += fx;
      this._forces[source.index].y += fy;
      this._forces[target.index].x -= fx;
      this._forces[target.index].y -= fy;
    }

    const damping = Math.pow(0.84, time);
    const temperature = this.dragged ? 1 : this.temperature;
    for (const node of this.nodes) {
      if (node === this.dragged) continue;
      const force = this._forces[node.index];
      node.vx = clamp((node.vx + force.x * temperature * time) * damping, -18, 18);
      node.vy = clamp((node.vy + force.y * temperature * time) * damping, -18, 18);
      node.x += node.vx * time;
      node.y += node.vy * time;
      this._contain(node);
    }
    this._separateLabels(time);
    const maximumSpeed = Math.max(...this.nodes.map((node) => Math.hypot(node.vx, node.vy)));
    this.temperature = this.dragged ? 1 : this.temperature * Math.pow(0.992, time);
    this.isSettled = !this.dragged && maximumSpeed < 0.025;
  }

  _separateLabels(time) {
    // Positional contact complements the smooth forces: titles remain legible
    // even when several link springs try to pull their nodes into one spot.
    for (let pass = 0; pass < 3; pass++) {
      for (let a = 0; a < this.nodes.length; a++) {
        const first = this.nodes[a];
        for (let b = a + 1; b < this.nodes.length; b++) {
          const second = this.nodes[b];
          const dx = first.x - second.x;
          const dy = first.y + first.titleOffset - second.y - second.titleOffset;
          const collisionWidth = Math.min(this.labelWidth, (first.titleWidth + second.titleWidth) / 2);
          const collisionHeight = Math.min(this.labelHeight, (first.titleHeight + second.titleHeight) / 2);
          const overlapX = collisionWidth - Math.abs(dx);
          const overlapY = collisionHeight - Math.abs(dy);
          if (overlapX <= 0 || overlapY <= 0) continue;
          const firstWeight = first === this.dragged ? 0 : second === this.dragged ? 1 : 0.5;
          const secondWeight = 1 - firstWeight;
          if (overlapX < overlapY) {
            const push = Math.sign(dx || (a % 2 ? 1 : -1)) * Math.min(overlapX + 0.05, 12 * time);
            first.x += push * firstWeight;
            second.x -= push * secondWeight;
            if (first.vx * push < 0) first.vx = 0;
            if (second.vx * push > 0) second.vx = 0;
          } else {
            const push = Math.sign(dy || (a % 2 ? 1 : -1)) * Math.min(overlapY + 0.05, 12 * time);
            first.y += push * firstWeight;
            second.y -= push * secondWeight;
            if (first.vy * push < 0) first.vy = 0;
            if (second.vy * push > 0) second.vy = 0;
          }
          this._contain(first);
          this._contain(second);
        }
      }
    }
  }

  _contain(node) {
    const { left, right, top, bottom } = this.bounds;
    node.x = finite(node.x, (left + right) / 2);
    node.y = finite(node.y, (top + bottom) / 2);
    if (node.x < left || node.x > right) {
      node.x = clamp(node.x, left, right);
      node.vx *= 0.15;
    }
    if (node.y < top || node.y > bottom) {
      node.y = clamp(node.y, top, bottom);
      node.vy *= 0.15;
    }
  }
}
