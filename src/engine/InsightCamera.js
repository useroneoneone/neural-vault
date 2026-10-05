const MIN_ZOOM = 0.08;
const MAX_ZOOM = 2.5;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const dimension = (value, fallback) => Math.max(1, finite(value, fallback));

/** Keep the same note density as the small graph by growing its world area. */
export function insightWorldScale(count) {
  return Math.max(1, Math.sqrt(Math.max(0, finite(count, 0)) / 64));
}

/** A canvas camera whose position is the world point at the viewport center. */
export class InsightCamera {
  constructor() {
    this.viewportWidth = 1;
    this.viewportHeight = 1;
    this.worldWidth = 1;
    this.worldHeight = 1;
    this.x = 0.5;
    this.y = 0.5;
    this.zoom = 1;
    this.fitZoom = 1;
    this.minZoom = 0.5;
    this.maxZoom = MAX_ZOOM;
  }

  resize(viewportWidth, viewportHeight, worldWidth, worldHeight, { fit = true } = {}) {
    const relativeX = finite(this.x / this.worldWidth, 0.5);
    const relativeY = finite(this.y / this.worldHeight, 0.5);
    const relativeZoom = finite(this.zoom / this.fitZoom, 1);
    this.viewportWidth = dimension(viewportWidth, this.viewportWidth);
    this.viewportHeight = dimension(viewportHeight, this.viewportHeight);
    this.worldWidth = dimension(worldWidth, this.viewportWidth);
    this.worldHeight = dimension(worldHeight, this.viewportHeight);
    this.fitZoom = Math.min(
      this.maxZoom,
      this.viewportWidth / this.worldWidth,
      this.viewportHeight / this.worldHeight,
    );
    this.minZoom = Math.min(this.maxZoom, Math.max(MIN_ZOOM, this.fitZoom * 0.5));
    if (fit) return this.fit();
    this.x = finite(relativeX * this.worldWidth, this.worldWidth * 0.5);
    this.y = finite(relativeY * this.worldHeight, this.worldHeight * 0.5);
    this.zoom = clamp(finite(relativeZoom * this.fitZoom, this.fitZoom), this.minZoom, this.maxZoom);
    return this;
  }

  setViewport(width, height, { fit = false } = {}) {
    return this.resize(width, height, this.worldWidth, this.worldHeight, { fit });
  }

  fit() {
    this.x = this.worldWidth * 0.5;
    this.y = this.worldHeight * 0.5;
    this.zoom = clamp(this.fitZoom, this.minZoom, this.maxZoom);
    return this;
  }

  worldToScreen(worldX, worldY) {
    return {
      x: finite((finite(worldX, this.x) - this.x) * this.zoom + this.viewportWidth * 0.5, this.viewportWidth * 0.5),
      y: finite((finite(worldY, this.y) - this.y) * this.zoom + this.viewportHeight * 0.5, this.viewportHeight * 0.5),
    };
  }

  screenToWorld(screenX, screenY) {
    return {
      x: finite((finite(screenX, this.viewportWidth * 0.5) - this.viewportWidth * 0.5) / this.zoom + this.x, this.x),
      y: finite((finite(screenY, this.viewportHeight * 0.5) - this.viewportHeight * 0.5) / this.zoom + this.y, this.y),
    };
  }

  zoomAt(factor, screenX = this.viewportWidth * 0.5, screenY = this.viewportHeight * 0.5) {
    if (!Number.isFinite(factor) || factor <= 0) return this;
    const anchor = this.screenToWorld(screenX, screenY);
    this.zoom = clamp(finite(this.zoom * factor, this.maxZoom), this.minZoom, this.maxZoom);
    const after = this.screenToWorld(screenX, screenY);
    this.x = finite(this.x + anchor.x - after.x, this.x);
    this.y = finite(this.y + anchor.y - after.y, this.y);
    return this;
  }

  /** Screen-space dragging moves the graph with the pointer. */
  panBy(screenDX, screenDY) {
    this.x = finite(this.x - finite(screenDX, 0) / this.zoom, this.x);
    this.y = finite(this.y - finite(screenDY, 0) / this.zoom, this.y);
    return this;
  }
}
