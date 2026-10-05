import { glow, rgba, sprite } from './sprites';
import { mulberry32 } from '../data/random';
import { InsightSimulation } from './InsightSimulation';
import { branchLayoutMetrics, categoryLayoutCapacity, categoryScene } from './categoryLayout';
import { InsightCamera, insightWorldScale } from './InsightCamera';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

function cubicPt(a, c1, c2, b, t, out) {
  const u = 1 - t, uu = u * u, tt = t * t;
  const k0 = uu * u, k1 = 3 * uu * t, k2 = 3 * u * tt, k3 = tt * t;
  out.x = k0 * a.x + k1 * c1.x + k2 * c2.x + k3 * b.x;
  out.y = k0 * a.y + k1 * c1.y + k2 * c2.y + k3 * b.y;
  return out;
}
function quadPt(a, c, b, t, out) {
  const u = 1 - t;
  out.x = u * u * a.x + 2 * u * t * c.x + t * t * b.x;
  out.y = u * u * a.y + 2 * u * t * c.y + t * t * b.y;
  return out;
}
/** Elegant arc: two control points pushed along the normal. */
function arcCtrl(a, b, bend) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const nx = -dy * bend, ny = dx * bend;
  return [
    { x: a.x + dx * 0.3 + nx, y: a.y + dy * 0.3 + ny },
    { x: a.x + dx * 0.7 + nx * 0.7, y: a.y + dy * 0.7 + ny * 0.7 },
  ];
}

const WHITE = '#ffffff';
const GOLD = '#ffb347';
const EMBER = '#ff7a3d';

/**
 * NeuralEngine — a single rAF loop rendering the whole graph on Canvas 2D.
 *  - main canvas  (below DOM panels): halo, chaos sphere, links, leaves, jellyfish
 *  - overlay canvas (above sidebar): fan-out fibers that connect the selected hub
 *    to the real DOM rows of the sidebar (Y coordinates read every frame).
 * React never re-renders per frame; DOM label cards are moved via style.transform.
 */
export class NeuralEngine {
  constructor(canvas, overlay, data) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.ctx = canvas.getContext('2d');
    this.octx = overlay.getContext('2d');
    this.data = data;

    this.w = 1; this.h = 1; this.dpr = 1;
    this.t = 0; this.last = performance.now(); this.paused = false;
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2, px: 0, py: 0 };

    this.mode = 'galaxy'; this.sel = null; this.branchT = 0; this.overlayT = 0; this.sidebarW = 0;
    this.insightT = 0; this.drag = null; this.suppressClick = false;
    this.pan = null; this._cameraChanged = false;
    this.categoryPage = 0; this.categoryPageCount = 1;
    this.branchParallaxScale = 1;
    this.hoverLeaf = null; this.hoverCatDom = null; this.hoverCatCanvas = null;
    this.hoverAnchor = null; this.activeId = null; this.matches = null;

    this.labelEls = new Map();
    this.anchorReg = null;
    this.fpsEl = null;
    this.callbacks = {};
    this._p = { x: 0, y: 0 }; this._q = { x: 0, y: 0 };
    this._fpsAcc = 0; this._fpsN = 0;

    this.init();
    this.bind();
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  /* ------------------------------------------------------------------ init */
  init() {
    const rand = mulberry32(1337);
    const { categories, notes, edges } = this.data;
    this.center = { x: 0, y: 0, R: 10, tx: 0, ty: 0, tR: 60, px: 0, py: 0 };
    this.cats = categories.map((c, i) => ({
      c, id: c.id, color: c.color, bend: c.bend, phase: i * 1.37,
      x: 0, y: 0, tx: 0, ty: 0, s: 0.2, ts: 1, a: 0, ta: 1, px: 0, py: 0,
    }));
    this.catMap = new Map(this.cats.map((c) => [c.id, c]));
    this.leaves = notes.map((n) => ({
      n, id: n.id, cat: this.catMap.get(n.cat),
      x: 0, y: 0, tx: 0, ty: 0, a: 0, ta: 1, px: 0, py: 0,
      r: 1.3 + Math.min(n.backlinks, 14) * 0.17,
      phase: rand() * TAU, u: rand(), v: rand() * 2 - 1, lp: rand(),
    }));
    this.leafMap = new Map(this.leaves.map((l) => [l.id, l]));
    this.cross = edges
      .map((e) => ({ a: this.leafMap.get(e.source), b: this.leafMap.get(e.target), mutual: e.mutual }))
      .filter((e) => e.a && e.b);

    this.neighbors = new Map(notes.map((n) => [n.id, new Set()]));
    for (const e of this.cross) {
      this.neighbors.get(e.a.id).add(e.b.id);
      this.neighbors.get(e.b.id).add(e.a.id);
    }

    this.initSphere(rand);
    this.spikes = Array.from({ length: 90 }, () => this.newSpike(rand(), rand));
    this.dust = Array.from({ length: 170 }, () => ({
      x: rand(), y: rand(), s: 0.4 + rand() * 1.2, a: 0.05 + rand() * 0.28,
      vx: (rand() - 0.5) * 0.006, vy: (rand() - 0.5) * 0.006, d: 0.4 + rand() * 1.8,
      warm: rand() < 0.25,
    }));
    this.ctx.font = '500 11px Inter, "PingFang SC", "Microsoft YaHei", sans-serif';
    this.insight = new InsightSimulation(notes, edges, { measureText: (text) => this.ctx.measureText(text).width });
    this.insightCamera = new InsightCamera();
    this.insightWorldScale = insightWorldScale(notes.length);
  }

  initSphere(rand) {
    const pts = [];
    const N = 150, ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * ga;
      const k = 0.72 + rand() * 0.5;
      pts.push({ x: Math.cos(th) * r * k, y: y * k, z: Math.sin(th) * r * k, ph: rand() * TAU, amp: 0.03 + rand() * 0.09 });
    }
    for (let i = 0; i < 45; i++) {
      const u = rand() * TAU, v = Math.acos(rand() * 2 - 1), k = 0.15 + rand() * 0.55;
      pts.push({ x: Math.sin(v) * Math.cos(u) * k, y: Math.cos(v) * k, z: Math.sin(v) * Math.sin(u) * k, ph: rand() * TAU, amp: 0.05 + rand() * 0.12 });
    }
    const edges = [], seen = new Set();
    for (let i = 0; i < pts.length; i++) {
      const d = [];
      for (let j = 0; j < pts.length; j++) {
        if (i === j) continue;
        const a = pts[i], b = pts[j];
        d.push([(a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2, j]);
      }
      d.sort((p, q) => p[0] - q[0]);
      for (let k = 0; k < 3; k++) {
        const j = d[k][1], key = i < j ? i * 1000 + j : j * 1000 + i;
        if (!seen.has(key)) { seen.add(key); edges.push([i, j]); }
      }
    }
    const hot = Array.from({ length: 38 }, () => ({ e: edges[Math.floor(rand() * edges.length)], ph: rand() * TAU, sp: 1.2 + rand() * 3 }));
    const embers = Array.from({ length: 80 }, () => ({ u: rand() * TAU, v: rand() * 2 - 1, r: 0.1 + rand() * 0.6, sp: (rand() - 0.5) * 1.4, ph: rand() * TAU }));
    this.sphere = { pts, edges, hot, embers, proj: new Float32Array(pts.length * 3) };
  }

  newSpike(d, rand = Math.random) {
    return { ang: rand() * TAU, d, len: 0.15 + rand() * 0.6, sp: 0.07 + rand() * 0.16 };
  }

  /* ---------------------------------------------------------------- events */
  bind() {
    this.onWinMove = (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; };
    this.onDown = (e) => {
      this.suppressClick = false;
      if (this.mode !== 'insight' || e.button !== 0 || !e.isPrimary || this.drag || this.pan) return;
      this.hitTest(e.clientX, e.clientY);
      if (!this.hoverLeaf) {
        this.pan = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false };
        this.canvas.setPointerCapture(e.pointerId);
        return;
      }
      const leaf = this.hoverLeaf;
      this.drag = {
        leaf, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
        offsetX: leaf.px - e.clientX, offsetY: leaf.py - e.clientY, moved: false,
      };
      this.canvas.setPointerCapture(e.pointerId);
    };
    this.onMove = (e) => {
      const pan = this.pan;
      if (pan && pan.pointerId === e.pointerId) {
        if (!pan.moved && Math.hypot(e.clientX - pan.startX, e.clientY - pan.startY) >= 4) pan.moved = true;
        if (pan.moved) {
          e.preventDefault();
          this.insightCamera.panBy(e.clientX - pan.lastX, e.clientY - pan.lastY);
          this._cameraChanged = true;
          this.canvas.style.cursor = 'grabbing';
          pan.lastX = e.clientX; pan.lastY = e.clientY;
        }
        return;
      }
      const drag = this.drag;
      if (!drag || drag.pointerId !== e.pointerId) {
        this.hitTest(e.clientX, e.clientY);
        return;
      }
      if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) >= 4) {
        drag.moved = true;
        const position = this.insightCamera.screenToWorld(drag.leaf.px, drag.leaf.py);
        this.insight.startDrag(drag.leaf.id, position.x, position.y);
      }
      if (drag.moved) {
        e.preventDefault();
        const position = this.insightCamera.screenToWorld(e.clientX + drag.offsetX, e.clientY + drag.offsetY);
        this.insight.dragTo(position.x, position.y);
        this.canvas.style.cursor = 'grabbing';
      }
    };
    this.onUp = (e) => {
      const gesture = this.drag || this.pan;
      if (!gesture || gesture.pointerId !== e.pointerId) return;
      this.suppressClick = gesture.moved || e.type !== 'pointerup';
      this.cancelDrag();
      this.hitTest(e.clientX, e.clientY);
    };
    this.onLostCapture = () => {
      if (this.drag || this.pan) { this.suppressClick = true; this.cancelDrag(); }
    };
    this.onLeave = () => {
      if (this.drag || this.pan) return;
      this.hoverLeaf = null; this.hoverCatCanvas = null; this.canvas.style.cursor = 'default';
    };
    this.onWheel = (e) => {
      if (this.mode !== 'insight') return;
      e.preventDefault();
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.h : 1);
      this.insightCamera.zoomAt(Math.exp(-delta * 0.0015), e.clientX, e.clientY);
      this._cameraChanged = true;
    };
    this.onClick = (e) => {
      if (this.suppressClick) { this.suppressClick = false; return; }
      this.hitTest(e.clientX, e.clientY);
      const cb = this.callbacks;
      if (this.hoverLeaf) cb.onLeafClick?.(this.hoverLeaf.n, { x: this.hoverLeaf.px, y: this.hoverLeaf.py });
      else if (this.hoverCatCanvas) cb.onCatClick?.(this.hoverCatCanvas.id);
      else cb.onBackgroundClick?.();
    };
    this.onResize = () => this.resize();
    window.addEventListener('pointermove', this.onWinMove);
    window.addEventListener('resize', this.onResize);
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointercancel', this.onUp);
    this.canvas.addEventListener('lostpointercapture', this.onLostCapture);
    this.canvas.addEventListener('pointerleave', this.onLeave);
    this.canvas.addEventListener('click', this.onClick);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  cancelDrag() {
    const drag = this.drag || this.pan;
    this.drag = null;
    this.pan = null;
    if (this.insight.dragged) this.insight.endDrag();
    if (drag && this.canvas.hasPointerCapture(drag.pointerId)) this.canvas.releasePointerCapture(drag.pointerId);
    this.canvas.style.cursor = 'default';
  }

  hitTest(x, y) {
    let best = null, bd = 1e9;
    for (const l of this.leaves) {
      if (l.a < 0.3 || l.ta < 0.3 || (this.mode === 'insight' && l.inView === false)) continue;
      const d = Math.hypot(l.px - x, l.py - y);
      const scale = l === this.hoverLeaf || l.id === this.activeId ? Math.max(1, this.insightZoom) : this.insightZoom;
      const titleVisible = this.insightTitleOpacity(l) > 0.1;
      const labelHit = this.mode === 'insight' && titleVisible && l.labelLines &&
        Math.abs(x - l.px) < l.labelW * scale / 2 + 5 && y >= l.py + 7 * scale && y <= l.py + (14 + l.labelLines.length * 15) * scale;
      if ((d < Math.max(10, l.r * 3.5) || labelHit) && d < bd) { bd = d; best = l; }
    }
    this.hoverLeaf = best;
    let cat = null;
    if (!best && this.mode !== 'insight') {
      const s = this.jellySize();
      for (const c of this.cats) {
        if (c.a < 0.3 || c.ta < 0.3) continue;
        if (Math.hypot(c.px - x, c.py - y) < s * 1.3 * c.s) { cat = c; break; }
      }
    }
    this.hoverCatCanvas = cat;
    this.canvas.style.cursor = this.drag?.moved || this.pan?.moved ? 'grabbing' : best ? (this.mode === 'insight' ? 'grab' : 'pointer') : cat ? 'pointer' : this.mode === 'insight' ? 'grab' : 'default';
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth, h = window.innerHeight;
    for (const c of [this.canvas, this.overlay]) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      c.style.width = w + 'px'; c.style.height = h + 'px';
    }
    this.w = w; this.h = h; this.dpr = dpr;
    const worldWidth = w * this.insightWorldScale, worldHeight = h * this.insightWorldScale;
    this.insight.resize(worldWidth, worldHeight);
    this.insightCamera.resize(w, h, worldWidth, worldHeight, { fit: !this._cameraReady });
    this._cameraReady = true;
    this.layout();
  }

  /* ----------------------------------------------------------- public API */
  setMode(mode, selId, sidebarW) {
    if (mode !== this.mode) this.cancelDrag();
    this.mode = mode;
    const oldSel = this.sel;
    this.sel = selId ? this.catMap.get(selId) : null;
    if (this.sel !== oldSel) {
      this.overlayT = 0;
    }
    this.sidebarW = sidebarW || 0;
    this.layout();
  }
  setInsightFilter(filter) {
    this.cancelDrag();
    this.insightFilter = filter;
    this.layout();
  }
  setQuery(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) { this.matches = null; return; }
    this.matches = new Set(
      this.leaves.filter((l) => l.n.title.toLowerCase().includes(q) || l.n.tags.some((t) => t.toLowerCase().includes(q)) || l.cat.c.name.toLowerCase().includes(q)).map((l) => l.id),
    );
  }
  setActive(id) { this.activeId = id; }
  setHoverAnchor(id) { this.hoverAnchor = id; }
  setHoverCat(id) { this.hoverCatDom = id ? this.catMap.get(id) : null; }
  setPaused(p) { this.paused = p; }
  get insightZoom() { return this.insightCamera?.zoom ?? 1; }
  zoomInsight(factor) {
    if (this.mode !== 'insight') return;
    this.insightCamera.zoomAt(factor, this.w / 2, this.h / 2);
    this._cameraChanged = true;
  }
  resetInsightCamera() {
    this.insightCamera.fit();
    this._cameraChanged = true;
  }
  insightTitleOpacity(leaf) {
    if (leaf === this.hoverLeaf || leaf.id === this.activeId || leaf === this.drag?.leaf) return 1;
    return this.insightWorldScale <= 1 ? 1 : smooth((this.insightZoom - 0.55) / 0.25);
  }
  setCategoryPage(page) {
    this.categoryPage = Number.isFinite(page) ? Math.floor(page) : 0;
    this.layout();
  }
  getLeafScreen(id) {
    const leaf = this.leafMap.get(id);
    if (!leaf) return null;
    if (this.mode === 'insight') {
      const node = this.insight.nodeMap.get(id);
      let point = this.insightCamera.worldToScreen(node.x, node.y);
      if (point.x < 140 || point.x > this.w - 210 || point.y < 110 || point.y > this.h - 110) {
        this.insightCamera.x = node.x;
        this.insightCamera.y = node.y;
        this._cameraChanged = true;
        point = this.insightCamera.worldToScreen(node.x, node.y);
      }
      leaf.x = leaf.tx = leaf.px = point.x;
      leaf.y = leaf.ty = leaf.py = point.y;
      return point;
    }
    return { x: leaf.px, y: leaf.py };
  }

  destroy() {
    this.cancelDrag();
    cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onWinMove);
    window.removeEventListener('resize', this.onResize);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
    this.canvas.removeEventListener('lostpointercapture', this.onLostCapture);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
    this.canvas.removeEventListener('click', this.onClick);
    this.canvas.removeEventListener('wheel', this.onWheel);
  }

  jellySize() { return clamp(Math.min(this.w, this.h) * 0.03, 18, 32); }

  /* ---------------------------------------------------------------- layout */
  layout() {
    const { w, h } = this, m = Math.min(w, h), C = this.center;
    this.branchParallaxScale = 1;
    this.categoryPageCount = this.cats.length <= 6 ? 1 : Math.max(1, Math.ceil(this.cats.length / categoryLayoutCapacity(w, h)));
    this.categoryPage = clamp(this.categoryPage, 0, this.categoryPageCount - 1);
    if (this.mode === 'galaxy' || (this.mode === 'branch' && !this.sel)) {
      const cx = w / 2, cy = h * 0.43;
      C.tx = cx; C.ty = cy; C.tR = m * 0.115;
      const scene = categoryScene(this.data.categories, w, h, 'galaxy', null, this.categoryPage);
      for (const c of this.cats) {
        const target = scene.targets.get(c.id);
        c.tx = target.x; c.ty = target.y; c.ts = target.scale; c.ta = target.alpha;
      }
      for (const l of this.leaves) {
        const c = l.cat, t = 0.3 + l.u * 0.46;
        const dx = c.tx - cx, dy = c.ty - cy, d = Math.hypot(dx, dy) || 1;
        const off = l.v * m * 0.1 * (1 - t * 0.35);
        l.tx = cx + dx * t + (-dy / d) * off;
        l.ty = cy + dy * t + (dx / d) * off;
        l.ta = c.ta;
      }
    } else if (this.mode === 'branch' && this.sel) {
      // Folder view: core far left, every root folder (jellyfish) in ONE column,
      // selected folder moved to the middle so its fan-out is symmetric.
      const S = this.sel, cy = h * 0.5;
      const metrics = branchLayoutMetrics(w, h, this.sidebarW || 452);
      C.tx = metrics.coreX; C.ty = cy; C.tR = metrics.coreRadius;
      this.branchParallaxScale = metrics.parallaxScale;
      const scene = categoryScene(this.data.categories, w, h, 'branch', S.id);
      for (const c of this.cats) {
        const target = scene.targets.get(c.id);
        c.tx = target.x; c.ty = target.y; c.ts = target.scale; c.ta = target.alpha;
      }
      for (const l of this.leaves) {
        const c = l.cat;
        if (c === S) { l.tx = S.tx; l.ty = S.ty; l.ta = 0; continue; }
        const t = 0.3 + l.u * 0.45;
        l.tx = C.tx + (c.tx - C.tx) * t + l.v * 12;
        l.ty = C.ty + (c.ty - C.ty) * t + l.v * 16;
        l.ta = c.ta > 0 ? 0.4 : 0;
      }
    } else if (this.mode === 'insight') {
      const cx = w / 2, cy = h / 2;
      C.tx = cx; C.ty = cy; C.tR = 0;
      for (const c of this.cats) {
        c.tx = cx; c.ty = cy; c.ts = 0; c.ta = 0;
      }
      for (const l of this.leaves) {
        const isVisible = !this.insightFilter || this.insightFilter === 'all' || l.n.status === this.insightFilter;
        l.ta = isVisible ? 1 : 0.05;
        const node = this.insight.nodeMap.get(l.id);
        const projected = this.insightCamera.worldToScreen(node.x, node.y);
        l.tx = projected.x;
        l.ty = projected.y;
      }
    }
    if (!this._laidOut) {
      // intro: everything bursts out of the core
      this._laidOut = true;
      C.x = C.tx; C.y = C.ty;
      for (const c of this.cats) { c.x = C.tx; c.y = C.ty; }
      for (const l of this.leaves) { l.x = C.tx; l.y = C.ty; }
    }
  }

  /* ---------------------------------------------------------------- update */
  loop(now) {
    const raw = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this._fpsAcc += raw; this._fpsN++;
    if (this._fpsAcc > 0.5) {
      if (this.fpsEl) this.fpsEl.textContent = `${Math.round(this._fpsN / this._fpsAcc)} FPS`;
      this._fpsAcc = 0; this._fpsN = 0;
    }
    const dt = this.paused ? 0 : raw;
    this.t += dt;
    this.update(raw, dt);
    this.render();
    this.renderOverlay();
    this.syncLabels();
    this.raf = requestAnimationFrame(this.loop);
  }

  update(raw, dt) {
    const { t, w, h } = this;
    const k = 1 - Math.exp(-raw * 2.8), kf = 1 - Math.exp(-raw * 4);
    const M = this.mouse;
    M.px += (M.x / w - 0.5 - M.px) * kf;
    M.py += (M.y / h - 0.5 - M.py) * kf;
    this.insightT += ((this.mode === 'insight' ? 1 : 0) - this.insightT) * k;
    const parallaxScale = this.mode === 'branch' ? this.branchParallaxScale : 1;
    const PX = -M.px * 26 * (1 - this.insightT) * parallaxScale;
    const PY = -M.py * 18 * (1 - this.insightT) * parallaxScale;

    if (this.mode === 'insight') {
      if (!this.paused || this.drag?.moved) this.insight.step(raw);
      for (const l of this.leaves) {
        const node = this.insight.nodeMap.get(l.id);
        const projected = this.insightCamera.worldToScreen(node.x, node.y);
        l.tx = projected.x; l.ty = projected.y;
        if (this._cameraChanged || (this.drag?.moved && this.drag.leaf === l)) { l.x = l.tx; l.y = l.ty; }
      }
    }

    const C = this.center;
    C.x += (C.tx - C.x) * k; C.y += (C.ty - C.y) * k; C.R += (C.tR - C.R) * k;
    C.px = C.x + PX * 0.4; C.py = C.y + PY * 0.4;

    const hovC = this.hoverCatDom || this.hoverCatCanvas;
    for (const c of this.cats) {
      c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k;
      c.s += (c.ts * (c === hovC ? 1.1 : 1) - c.s) * k; c.a += (c.ta - c.a) * k;
      c.px = c.x + Math.sin(t * 0.4 + c.phase) * 3 + PX * 0.85;
      c.py = c.y + Math.cos(t * 0.33 + c.phase) * 3 + PY * 0.85;
    }
    for (const l of this.leaves) {
      const kk = 1 - Math.exp(-raw * (1.6 + l.u * 1.8));
      l.x += (l.tx - l.x) * kk; l.y += (l.ty - l.y) * kk; l.a += (l.ta - l.a) * kk;
      l.px = l.x + Math.sin(t * 0.6 + l.phase) * 4 * (1 - this.insightT) + PX * 1.3;
      l.py = l.y + Math.cos(t * 0.5 + l.phase * 1.3) * 4 * (1 - this.insightT) + PY * 1.3;
      const margin = Math.max(80, (l.labelW || 142) * this.insightZoom);
      l.inView = this.mode !== 'insight' || (l.px > -margin && l.px < w + margin && l.py > -margin && l.py < h + margin);
    }
    this._cameraChanged = false;
    const target = this.mode === 'branch' && this.sel ? 1 : 0;
    this.branchT += (target - this.branchT) * (1 - Math.exp(-raw * 2.2));
    if (target === 1) {
      this.overlayT += (1 - this.overlayT) * (1 - Math.exp(-raw * 3.5));
    } else {
      this.overlayT = this.branchT;
    }

    for (const s of this.spikes) {
      s.d += s.sp * dt;
      if (s.d > 1) Object.assign(s, this.newSpike(0));
    }
    for (const d of this.dust) {
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.x < 0) d.x += 1; if (d.x > 1) d.x -= 1; if (d.y < 0) d.y += 1; if (d.y > 1) d.y -= 1;
    }
    this.PX = PX; this.PY = PY;
  }

  /* ---------------------------------------------------------------- render */
  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, this.w, this.h);

    this.drawDust(ctx);
    this.drawHalo(ctx);
    ctx.globalCompositeOperation = 'lighter';
    this.drawSpikes(ctx);
    this.drawCross(ctx);
    this.drawLeafLinks(ctx);
    this.drawMainLinks(ctx);
    this.drawLeaves(ctx);
    ctx.globalCompositeOperation = 'source-over';
    this.drawSphereCore(ctx);
    ctx.globalCompositeOperation = 'lighter';
    this.drawSparks(ctx);
    for (const c of this.cats) {
      const hl = c === this.hoverCatDom || c === this.hoverCatCanvas || c === this.sel;
      this.drawJelly(ctx, c.px, c.py, this.jellySize() * c.s, c.color, this.t, c.phase, c.a, hl);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    this.drawLabels(ctx);
  }

  drawDust(ctx) {
    const { w, h } = this;
    for (const d of this.dust) {
      ctx.globalAlpha = d.a;
      ctx.fillStyle = d.warm ? '#f4c069' : '#cfd3e0';
      const x = ((d.x * w + this.PX * d.d) % w + w) % w, y = ((d.y * h + this.PY * d.d) % h + h) % h;
      ctx.fillRect(x, y, d.s, d.s);
    }
    ctx.globalAlpha = 1;
  }

  drawHalo(ctx) {
    const C = this.center, R = C.R, x = C.px, y = C.py, t = this.t;
    if (R < 0.5) return;
    const pr = R * (2.4 + Math.sin(t * 1.4) * 0.08);
    const g = ctx.createRadialGradient(x, y, R * 0.2, x, y, pr);
    g.addColorStop(0, 'rgba(235,235,242,0.5)');
    g.addColorStop(0.3, 'rgba(205,205,214,0.34)');
    g.addColorStop(0.56, 'rgba(140,140,152,0.11)');
    g.addColorStop(1, 'rgba(80,80,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, pr, 0, TAU); ctx.fill();
    // pulse shock-waves
    ctx.lineWidth = 1;
    for (let k = 0; k < 2; k++) {
      const ph = (t * 0.32 + k * 0.5) % 1;
      ctx.strokeStyle = `rgba(255,255,255,${(1 - ph) * 0.16})`;
      ctx.beginPath(); ctx.arc(x, y, R * (1.05 + ph * 2.1), 0, TAU); ctx.stroke();
    }
  }

  drawSpikes(ctx) {
    const C = this.center, R = C.R, white = glow(WHITE);
    if (R < 0.5) return;
    ctx.lineWidth = 0.8;
    for (const s of this.spikes) {
      const a = Math.sin(s.d * Math.PI);
      if (a < 0.02) continue;
      const r0 = R * (1.05 + s.d * 2.9), r1 = r0 + R * s.len * (0.6 + s.d);
      const cx = Math.cos(s.ang), sy = Math.sin(s.ang);
      const x0 = C.px + cx * r0, y0 = C.py + sy * r0, x1 = C.px + cx * r1, y1 = C.py + sy * r1;
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, `rgba(255,255,255,${0.5 * a})`);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = g;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      sprite(ctx, white, x1, y1, 5, a * 0.85);
    }
    ctx.globalAlpha = 1;
  }

  drawCross(ctx) {
    if (this.mode === 'insight') { this.drawInsightLinks(ctx); return; }
    const fade = 1 - this.branchT;
    if (fade < 0.02) return;
    const dim = this.matches ? 0.35 : 1;
    ctx.globalAlpha = 1;
    ctx.lineWidth = 0.5;

    ctx.beginPath();
    for (const e of this.cross) {
      if (e.mutual) continue;
      const alpha = Math.min(e.a.a, e.b.a);
      if (alpha < 0.1) continue;
      ctx.moveTo(e.a.px, e.a.py); ctx.lineTo(e.b.px, e.b.py);
    }
    ctx.strokeStyle = `rgba(255,255,255,${0.06 * fade * dim})`;
    ctx.stroke();

    ctx.beginPath();
    for (const e of this.cross) {
      if (!e.mutual) continue;
      const alpha = Math.min(e.a.a, e.b.a);
      if (alpha < 0.1) continue;
      const mx = (e.a.px + e.b.px) / 2, my = (e.a.py + e.b.py) / 2;
      ctx.moveTo(e.a.px, e.a.py);
      ctx.quadraticCurveTo(mx + (e.b.py - e.a.py) * 0.15, my - (e.b.px - e.a.px) * 0.15, e.b.px, e.b.py);
    }
    ctx.strokeStyle = `rgba(244,192,105,${0.18 * fade * dim})`;
    ctx.stroke();
  }

  insightFocus() {
    return [this.drag?.leaf, this.hoverLeaf, this.leafMap.get(this.activeId)].find((leaf) => leaf?.ta >= 0.3);
  }

  drawInsightLinks(ctx) {
    const focus = this.insightFocus();
    const fade = 1 - this.branchT;
    for (const e of this.cross) {
      const alpha = Math.min(e.a.a, e.b.a);
      if (alpha < 0.08) continue;
      if (Math.max(e.a.px, e.b.px) < -20 || Math.min(e.a.px, e.b.px) > this.w + 20 ||
          Math.max(e.a.py, e.b.py) < -20 || Math.min(e.a.py, e.b.py) > this.h + 20) continue;
      const related = focus && (e.a === focus || e.b === focus);
      const dim = this.matches && !this.matches.has(e.a.id) && !this.matches.has(e.b.id) ? 0.25 : 1;
      ctx.globalAlpha = alpha * fade * dim;
      ctx.lineWidth = related ? 1.3 : 0.65;
      ctx.strokeStyle = related ? rgba(focus.cat.color, 0.75) : e.mutual ? rgba('#f4c069', focus ? 0.07 : 0.23) : rgba('#c4c4d0', focus ? 0.045 : 0.15);
      ctx.beginPath(); ctx.moveTo(e.a.px, e.a.py); ctx.lineTo(e.b.px, e.b.py); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  isHL(l) {
    return l === this.hoverLeaf || l.id === this.activeId || (this.matches && this.matches.has(l.id));
  }

  drawLeafLinks(ctx) {
    if (this.insightT > 0.995) return;
    const t = this.t, p = this._p;
    ctx.globalAlpha = 1;
    for (const l of this.leaves) {
      if (l.a < 0.02) continue;
      const c = l.cat, hl = this.isHL(l);
      const dim = (this.matches && !hl ? 0.25 : 1) * (1 - this.insightT);
      const a = { x: c.px, y: c.py }, b = { x: l.px, y: l.py };
      const ctl = { x: (a.x + b.x) / 2 + (b.y - a.y) * l.v * 0.18, y: (a.y + b.y) / 2 - (b.x - a.x) * l.v * 0.18 };
      ctx.lineWidth = hl ? 1 : 0.6;
      ctx.strokeStyle = rgba(c.color, (hl ? 0.55 : 0.30) * l.a * dim);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(ctl.x, ctl.y, b.x, b.y); ctx.stroke();
      // one slow packet per dendrite
      const tt = (t * 0.2 + l.lp) % 1;
      quadPt(a, ctl, b, tt, p);
      sprite(ctx, glow(c.color), p.x, p.y, hl ? 9 : 6, Math.sin(tt * Math.PI) * 0.8 * l.a * dim);
    }
  }

  drawMainLinks(ctx) {
    const C = this.center, t = this.t, p = this._p;
    for (const c of this.cats) {
      if (c.a < 0.02) continue;
      const dx = c.px - C.px, dy = c.py - C.py, d = Math.hypot(dx, dy) || 1;
      const a = { x: C.px + (dx / d) * C.R * 0.75, y: C.py + (dy / d) * C.R * 0.75 };
      const b = { x: c.px, y: c.py };
      const bend = c.bend * 0.6;
      const [c1, c2] = arcCtrl(a, b, bend);
      const hl = c === this.sel || c === this.hoverCatDom || c === this.hoverCatCanvas;
      const A = c.a * (hl ? 1.3 : 1);
      ctx.globalAlpha = 1;
      // fiber bundle: 2 side strands + glow + core
      ctx.lineWidth = 0.5;
      for (const off of [-0.027, 0.027]) {
        const [s1, s2] = arcCtrl(a, b, bend + off);
        ctx.strokeStyle = rgba(c.color, 0.16 * A);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(s1.x, s1.y, s2.x, s2.y, b.x, b.y); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
      ctx.lineWidth = 6; ctx.strokeStyle = rgba(c.color, 0.05 * A); ctx.stroke();
      ctx.lineWidth = 1.3; ctx.strokeStyle = rgba(c.color, 0.55 * A); ctx.stroke();

      // flowing light packets with comet tails
      const img = glow(c.color);
      const n = 6;
      for (let i = 0; i < n; i++) {
        const tt = (t * 0.17 + i / n + c.phase * 0.1) % 1;
        const fade = Math.sin(tt * Math.PI) * c.a;
        for (let j = 0; j < 6; j++) {
          const tj = tt - j * 0.011;
          if (tj < 0) break;
          cubicPt(a, c1, c2, b, tj, p);
          sprite(ctx, img, p.x, p.y, (hl ? 13 : 10) - j * 1.4, fade * (1 - j / 6) * 0.95);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  drawLeaves(ctx) {
    const t = this.t;
    const focus = this.mode === 'insight' ? this.insightFocus() : null;
    for (const l of this.leaves) {
      if (l.a < 0.01 || (this.mode === 'insight' && l.inView === false)) continue;
      const hl = this.isHL(l);
      let a = l.a * (0.7 + 0.3 * Math.sin(t * 2.2 + l.phase));
      if (this.matches && !hl) a *= 0.18;
      const img = glow(l.cat.color);
      const related = focus && (l === focus || this.neighbors.get(focus.id)?.has(l.id));
      const nodeScale = this.mode === 'insight' ? clamp(this.insightZoom, 0.65, 1.6) : 1;
      const size = l.r * 7 * (hl ? 1.9 : 1) * (1 - this.insightT) + (hl ? 30 : 21) * this.insightT * nodeScale;
      if (focus && !related) a *= 0.55;
      sprite(ctx, img, l.px, l.py, size, a);
      if (this.insightT > 0.01) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = l.a * this.insightT * (focus && !related ? 0.48 : 0.95) * (this.matches && !hl ? 0.3 : 1);
        ctx.fillStyle = hl ? '#ffffff' : l.cat.color;
        ctx.beginPath(); ctx.arc(l.px, l.py, (3.4 + Math.min(l.n.backlinks, 14) * 0.08 + (hl ? 1 : 0)) * nodeScale, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
      }
      if (hl) {
        ctx.globalAlpha = l.a * 0.8;
        ctx.strokeStyle = l.cat.color; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(l.px, l.py, l.r * 3.4 + Math.sin(t * 4) * 1.2, 0, TAU); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  projectSphere() {
    const C = this.center, R = C.R, t = this.t;
    const { pts, proj } = this.sphere;
    const ay = t * 0.13, ax = 0.4 + Math.sin(t * 0.11) * 0.25;
    const cY = Math.cos(ay), sY = Math.sin(ay), cX = Math.cos(ax), sX = Math.sin(ax);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], k = 1 + Math.sin(t * 0.9 + p.ph) * p.amp;
      const x = p.x * k, y = p.y * k, z = p.z * k;
      const x1 = x * cY + z * sY, z1 = -x * sY + z * cY;
      const y1 = y * cX - z1 * sX, z2 = y * sX + z1 * cX;
      const pz = 3 / (3 + z2);
      proj[i * 3] = C.px + x1 * pz * R;
      proj[i * 3 + 1] = C.py + y1 * pz * R;
      proj[i * 3 + 2] = z2;
    }
  }

  drawSphereCore(ctx) {
    const C = this.center, R = C.R;
    if (R < 0.5) return;
    const g = ctx.createRadialGradient(C.px, C.py, 0, C.px, C.py, R * 1.15);
    g.addColorStop(0, 'rgba(6,6,8,0.92)');
    g.addColorStop(0.55, 'rgba(14,14,17,0.7)');
    g.addColorStop(1, 'rgba(20,20,24,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(C.px, C.py, R * 1.15, 0, TAU); ctx.fill();

    this.projectSphere();
    const { edges, proj } = this.sphere;
    for (const front of [false, true]) {
      ctx.beginPath();
      for (const [i, j] of edges) {
        const z = proj[i * 3 + 2] + proj[j * 3 + 2];
        if (front !== z < 0) continue;
        ctx.moveTo(proj[i * 3], proj[i * 3 + 1]);
        ctx.lineTo(proj[j * 3], proj[j * 3 + 1]);
      }
      ctx.lineWidth = front ? 1.05 : 0.7;
      ctx.strokeStyle = front ? 'rgba(8,8,10,0.85)' : 'rgba(0,0,0,0.35)';
      ctx.stroke();
    }
  }

  drawSparks(ctx) {
    const C = this.center, R = C.R, t = this.t;
    if (R < 0.5) return;
    const { edges, proj, hot, embers } = this.sphere;
    const gold = glow(GOLD), ember = glow(EMBER);
    // inner fire
    sprite(ctx, gold, C.px, C.py, R * 1.7, 0.26 + 0.08 * Math.sin(t * 2));
    sprite(ctx, ember, C.px + Math.cos(t * 0.7) * R * 0.3, C.py + Math.sin(t * 0.9) * R * 0.3, R, 0.32);
    // faint front structure so the wireframe reads on the dark core
    ctx.globalAlpha = 1;
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    for (const [i, j] of edges) {
      if (proj[i * 3 + 2] + proj[j * 3 + 2] > 0) continue;
      ctx.moveTo(proj[i * 3], proj[i * 3 + 1]); ctx.lineTo(proj[j * 3], proj[j * 3 + 1]);
    }
    ctx.stroke();
    // flickering hot filaments
    ctx.lineWidth = 1.4;
    for (const hh of hot) {
      let f = Math.max(0, Math.sin(t * hh.sp + hh.ph));
      f = f * f * f;
      if (f < 0.03) continue;
      const [i, j] = hh.e;
      const x0 = proj[i * 3], y0 = proj[i * 3 + 1], x1 = proj[j * 3], y1 = proj[j * 3 + 1];
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(255,${(170 + f * 60) | 0},90,${f * 0.95})`;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      sprite(ctx, gold, x0, y0, 12 * f, f);
      sprite(ctx, gold, x1, y1, 9 * f, f * 0.8);
    }
    // embers orbiting inside
    for (const e of embers) {
      const ang = e.u + t * e.sp, rr = Math.sqrt(1 - e.v * e.v) * e.r;
      sprite(ctx, ember, C.px + Math.cos(ang) * rr * R, C.py + e.v * e.r * R * 0.9 + Math.sin(ang) * rr * R * 0.3, 3.5, 0.45 + 0.45 * Math.sin(t * 3 + e.ph));
    }
    ctx.globalAlpha = 1;
  }

  /** Procedural wireframe jellyfish: pulsing bell + undulating tentacles. */
  drawJelly(ctx, x, y, s, color, t, ph, alpha, hl) {
    if (alpha < 0.02) return;
    const pulse = Math.sin(t * 1.9 + ph);
    const bw = s * (1 + pulse * 0.08), bh = s * 0.8 * (1 - pulse * 0.07);
    sprite(ctx, glow(color), x, y - s * 0.2, s * 4.6, alpha * (hl ? 0.6 : 0.34));

    ctx.strokeStyle = color;
    ctx.lineWidth = 0.7;
    for (let k = 1; k <= 5; k++) {
      const v = (k / 5) * Math.PI * 0.5, rx = Math.sin(v) * bw;
      ctx.globalAlpha = alpha * (0.16 + k * 0.05);
      ctx.beginPath(); ctx.ellipse(x, y - Math.cos(v) * bh, rx, rx * 0.26, 0, 0, TAU); ctx.stroke();
    }
    for (let m = 0; m < 10; m++) {
      const u = (m / 10) * TAU + t * 0.35 + ph, front = Math.sin(u);
      ctx.globalAlpha = alpha * (front > 0 ? 0.45 : 0.14);
      ctx.beginPath();
      for (let q = 0; q <= 8; q++) {
        const v = (q / 8) * Math.PI * 0.5;
        const px = x + Math.sin(v) * bw * Math.cos(u), py = y - Math.cos(v) * bh + Math.sin(v) * bw * 0.26 * front;
        q ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    // tentacles
    const tg = ctx.createLinearGradient(0, y, 0, y + s * 2.3);
    tg.addColorStop(0, rgba(color, 0.6)); tg.addColorStop(1, rgba(color, 0));
    ctx.strokeStyle = tg; ctx.globalAlpha = alpha; ctx.lineWidth = 0.6;
    for (let i = 0; i < 12; i++) {
      const u = (i / 12) * TAU + ph, rx = Math.cos(u) * bw * 0.92, ry = Math.sin(u) * bw * 0.24;
      const L = s * (1.5 + 0.5 * Math.sin(i * 1.7 + ph));
      ctx.beginPath(); ctx.moveTo(x + rx, y + ry);
      for (let k = 1; k <= 14; k++) {
        const f = k / 14;
        ctx.lineTo(x + rx * (1 - f * 0.45) + Math.sin(t * 2.4 - f * 6 + i) * f * s * 0.22, y + ry + f * L);
      }
      ctx.stroke();
    }
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * s * 0.18;
      ctx.beginPath(); ctx.moveTo(x + ox, y);
      for (let k = 1; k <= 12; k++) {
        const f = k / 12;
        ctx.lineTo(x + ox + Math.sin(t * 1.8 - f * 5 + i * 2) * f * s * 0.3, y + f * s * 2.0);
      }
      ctx.stroke();
    }
    // sparkles on the bell
    const wimg = glow(WHITE);
    for (let i = 0; i < 10; i++) {
      const u = i * 2.39 + ph + t * 0.35, v = ((i * 0.37) % 1) * 1.4 + 0.1;
      const tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.3 + ph);
      sprite(ctx, wimg, x + Math.sin(v) * bw * Math.cos(u), y - Math.cos(v) * bh + Math.sin(v) * bw * 0.26 * Math.sin(u), 6, alpha * tw * 0.9);
    }
    sprite(ctx, glow(color), x, y - bh * 0.35, s * 1.3, alpha * 0.75);
    ctx.globalAlpha = 1;
  }

  drawLabels(ctx) {
    ctx.font = '500 11px Inter, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textBaseline = 'middle';
    if (this.mode === 'insight') {
      const focus = this.insightFocus();
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#0b0b0d';
      for (const l of this.leaves) {
        const opacity = this.insightTitleOpacity(l);
        if (l.a < 0.08 || l.inView === false || opacity <= 0) continue;
        if (!l.labelLines) {
          const node = this.insight.nodeMap.get(l.id);
          l.labelLines = node.labelLines;
          l.labelW = node.labelWidth;
        }
        const focused = l === this.hoverLeaf || l.id === this.activeId || l === this.drag?.leaf;
        const scale = focused ? Math.max(1, this.insightZoom) : this.insightZoom;
        ctx.font = `500 ${11 * scale}px Inter, "PingFang SC", "Microsoft YaHei", sans-serif`;
        ctx.lineWidth = 4 * scale;
        const related = focus && (l === focus || this.neighbors.get(focus.id)?.has(l.id));
        const dim = this.matches && !this.matches.has(l.id) ? 0.2 : 1;
        ctx.globalAlpha = l.a * this.insightT * dim * (focus && !related ? 0.48 : 0.92) * opacity;
        ctx.fillStyle = l === focus ? '#ffffff' : related ? '#e4e4e7' : '#b6b6c2';
        l.labelLines.forEach((text, i) => {
          const y = l.py + (17 + i * 15) * scale;
          ctx.strokeText(text, l.px, y); ctx.fillText(text, l.px, y);
        });
      }
      ctx.textAlign = 'start';
      ctx.globalAlpha = 1;
      return;
    }
    const gal = 1 - this.branchT;
    for (const l of this.leaves) {
      if (l.a < 0.05) continue;
      let a = 0;
      if (l === this.hoverLeaf || l.id === this.activeId) a = 1;
      else if (this.matches?.has(l.id)) a = 0.9;
      else if (!this.matches && l.n.backlinks >= 11) a = 0.32 * gal;
      if (a < 0.02) continue;
      ctx.globalAlpha = a * l.a;
      ctx.fillStyle = a > 0.5 ? '#f4f4f5' : '#a1a1aa';
      ctx.fillText(l.n.title, l.px + l.r * 3 + 6, l.py - 1);
    }
    ctx.globalAlpha = 1;
  }

  /* --------------------------------------------- overlay: hub → DOM rows */
  renderOverlay() {
    const o = this.octx;
    o.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    o.globalCompositeOperation = 'source-over';
    o.clearRect(0, 0, this.w, this.h);
    const reg = this.anchorReg, S = this.sel;
    if (this.branchT < 0.02 || !S || !reg || !reg.container) return;
    const cr = reg.container.getBoundingClientRect();
    const card = this.labelEls.get(S.id);
    if (!card) return;
    const lr = card.getBoundingClientRect();
    const bt = this.branchT, ot = this.overlayT, t = this.t;
    const hub = { x: lr.right + 24, y: lr.top + lr.height / 2 };
    const img = glow(S.color), wimg = glow(WHITE), gimg = glow('#f4c069');
    const p = this._p;
    o.globalCompositeOperation = 'lighter';

    // stub card → hub
    o.globalAlpha = bt;
    o.strokeStyle = rgba(S.color, 0.7); o.lineWidth = 1.2;
    o.beginPath(); o.moveTo(lr.right, hub.y); o.lineTo(hub.x, hub.y); o.stroke();

    const visibleItems = [];
    for (const [id, item] of reg.items) {
      if ((item.container && item.container !== reg.container) || item.isVisible === false) continue;
      const el = item.el;
      if (!el || !el.isConnected) continue;
      const r = el.getBoundingClientRect();
      const ax = r.left + r.width / 2, ay = r.top + r.height / 2;
      if (r.width === 0 || ay < cr.top + 4 || ay > cr.bottom - 4) continue;
      visibleItems.push({ id, item, ax, ay });
    }
    visibleItems.sort((a, b) => (a.item.visibleOrder ?? a.item.order ?? a.ay) - (b.item.visibleOrder ?? b.item.order ?? b.ay));
    let i = 0;
    for (const { id, item, ax, ay } of visibleItems) {
      const maxStagger = Math.min(0.5, visibleItems.length * 0.02);
      const stagger = (i / Math.max(1, visibleItems.length)) * maxStagger;
      const prog = smooth(clamp((ot - stagger) / (1 - stagger), 0, 1));
      if (prog <= 0) { i++; continue; }
      const b = { x: ax, y: ay }, dx = ax - hub.x;
      const c1 = { x: hub.x + dx * 0.5, y: hub.y }, c2 = { x: ax - dx * 0.5, y: ay };
      const active = id === this.activeId, hl = id === this.hoverAnchor || active;
      const col = active ? '#f4c069' : item.color;

      o.globalAlpha = 1;
      o.beginPath(); o.moveTo(hub.x, hub.y);
      const steps = 36, end = Math.ceil(steps * prog);
      for (let k = 1; k <= end; k++) {
        cubicPt(hub, c1, c2, b, Math.min(k / steps, prog), p);
        o.lineTo(p.x, p.y);
      }
      if (hl) { o.lineWidth = 5; o.strokeStyle = rgba(col, 0.12); o.stroke(); }
      o.lineWidth = hl ? 1.5 : 0.8;
      o.strokeStyle = rgba(col, hl ? 0.95 : 0.14);
      o.stroke();

      if (prog >= 1 && hl) {
        for (let n = 0; n < 3; n++) {
          const tt = (t * (hl ? 0.45 : 0.28) + i * 0.173 + n / 3) % 1;
          cubicPt(hub, c1, c2, b, tt, p);
          sprite(o, active ? gimg : img, p.x, p.y, hl ? 11 : 7, 0.95 * Math.sin(tt * Math.PI) + 0.1);
        }
        sprite(o, active ? gimg : img, ax, ay, hl ? 16 : 9, 0.9);
      } else if (prog < 1) {
        sprite(o, wimg, p.x, p.y, 8, 0.9); // growing tip
      }
      i++;
    }
    // hub splitter node
    sprite(o, img, hub.x, hub.y, 34, bt);
    sprite(o, wimg, hub.x, hub.y, 10, bt);
    o.globalAlpha = bt * 0.7;
    o.strokeStyle = S.color; o.lineWidth = 0.8;
    o.beginPath(); o.arc(hub.x, hub.y, 7 + Math.sin(t * 3) * 1.5, 0, TAU); o.stroke();
    o.globalAlpha = 1;
  }

  syncLabels() {
    const s0 = this.jellySize(), bt = this.branchT;
    for (const [id, el] of this.labelEls) {
      const c = this.catMap.get(id);
      if (!c || !el) continue;
      const s = s0 * c.s;
      const sc = clamp(c.s, 0.72, 1.05);
      // galaxy: centered under the jellyfish · folder view: vertically centered, to its right
      const x = c.px + bt * s * 1.35;
      const y = c.py + (1 - bt) * s * 1.05;
      el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(${(-50 * (1 - bt)).toFixed(1)}%, ${(-50 * bt).toFixed(1)}%) scale(${sc.toFixed(3)})`;
      el.style.transformOrigin = bt > 0.5 ? 'left center' : 'center top';
      el.style.opacity = c.a.toFixed(3);
      el.style.pointerEvents = c.a > 0.3 && c.ta > 0.3 ? 'auto' : 'none';
    }
  }
}
