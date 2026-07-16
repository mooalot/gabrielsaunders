// buttons whose surface is a grid of squares. hover dissolves them in a wave
// from the center, press condenses, leave reassembles.

const CONDENSE_FACTOR = 0.9;
const BORDER_WIDTH = 4;
const DELAY_PER_UNIT = 30;

function sbClamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function sbLighten(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  l = sbClamp(l + amount, 0, 1);
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r2, g2, b2;
  if (s === 0) {
    r2 = g2 = b2 = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r2 = hue2rgb(p, q, h + 1 / 3);
    g2 = hue2rgb(p, q, h);
    b2 = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
}

function sbRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// pick rows/cols/size that best fit the requested box
function findBestSquareGrid(x, y, maxSquares) {
  let best = null;
  const error = (xp, yp) => {
    const dx = xp - x;
    const dy = yp - y;
    return Math.sqrt(dx * dx + dy * dy * 4); // height matters 2x
  };
  const maxRows = Math.min(Math.floor(Math.sqrt(maxSquares)), Math.ceil(y / 10));

  for (let r = 1; r <= maxRows; r++) {
    for (const s of new Set([Math.round(y / r), Math.floor(y / r), Math.ceil(y / r)])) {
      if (s < 5) continue;
      const c = Math.round(x / s);
      if (c < 1 || r * c > maxSquares) continue;
      const xPrime = c * s;
      const yPrime = r * s;
      const err = error(xPrime, yPrime);
      if (best === null || err < best.error) best = { r, c, s, xPrime, yPrime, error: err };
    }
  }
  if (best === null) {
    const s = Math.max(5, Math.round(Math.min(x, y) / 4));
    const c = Math.max(1, Math.round(x / s));
    const r = Math.max(1, Math.round(y / s));
    best = { r, c, s, xPrime: c * s, yPrime: r * s, error: 0 };
  }
  return best;
}

class SquareButton {
  constructor(el, options = {}) {
    this.el = el;
    this.color = options.color || el.dataset.color || '#0f172a';
    this.variant = options.variant || el.dataset.variant || 'contained';
    this.borderRadius = Number(options.borderRadius ?? el.dataset.radius ?? 8);
    this.maxSquares = Number(options.maxSquares ?? el.dataset.maxSquares ?? 100);
    const width = Number(options.width ?? el.dataset.width ?? 200);
    const height = Number(options.height ?? el.dataset.height ?? 52);

    this.grid = findBestSquareGrid(width, height, this.maxSquares);
    this.overflowX = Math.round(this.grid.xPrime * 0.1);
    this.overflowY = Math.round(this.grid.yPrime * 0.1);

    const label = document.createElement('span');
    label.className = 'sb-label';
    while (el.firstChild) label.appendChild(el.firstChild);
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sb-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(this.canvas);
    el.appendChild(label);
    el.classList.add('sq-btn-ready', `sb-${this.variant}`);
    el.style.width = `${this.grid.xPrime}px`;
    el.style.height = `${this.grid.yPrime}px`;

    this.squares = [];
    this.raf = null;
    this.initSquares();
    this.bindEvents();
    this.ensureAnimating();
  }

  initSquares() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.grid.xPrime + this.overflowX * 2;
    const h = this.grid.yPrime + this.overflowY * 2;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
    this.canvasW = w;
    this.canvasH = h;

    const { r: rows, c: cols, s: size } = this.grid;
    const startX = w / 2 - this.grid.xPrime / 2;
    const startY = h / 2 - this.grid.yPrime / 2;

    this.squares = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * size + size / 2;
        const y = startY + row * size + size / 2;
        this.squares.push({
          gridX: col,
          gridY: row,
          originalX: x,
          originalY: y,
          currentX: x,
          currentY: y,
          targetX: x,
          targetY: y,
          size,
          opacity: 1,
          targetOpacity: 1,
          scale: 1,
          targetScale: 1,
          delay: 0,
        });
      }
    }
  }

  waveDelay(sq, reverse = false) {
    const { r: rows, c: cols } = this.grid;
    const maxDist = Math.abs(cols / 2) + Math.abs(rows / 2);
    const dist = Math.abs(sq.gridX - cols / 2) + Math.abs(sq.gridY - rows / 2);
    return (reverse ? maxDist - dist : dist) * DELAY_PER_UNIT;
  }

  shrink() {
    for (const sq of this.squares) {
      sq.targetScale = CONDENSE_FACTOR;
      sq.targetOpacity = 0.05;
      sq.targetX = sq.originalX;
      sq.targetY = sq.originalY;
      sq.delay = this.waveDelay(sq);
    }
    this.el.classList.add('sb-dissolved');
    this.ensureAnimating();
  }

  condense() {
    const { r: rows, c: cols } = this.grid;
    for (const sq of this.squares) {
      sq.targetScale = CONDENSE_FACTOR;
      sq.targetOpacity = 0.05;
      sq.targetX = sq.originalX - sq.size * (1 - CONDENSE_FACTOR) * (sq.gridX - cols / 2);
      sq.targetY = sq.originalY - sq.size * (1 - CONDENSE_FACTOR) * (sq.gridY - rows / 2);
      sq.delay = 0;
    }
    this.ensureAnimating();
  }

  reset() {
    for (const sq of this.squares) {
      sq.targetScale = 1;
      sq.targetOpacity = 1;
      sq.targetX = sq.originalX;
      sq.targetY = sq.originalY;
      sq.delay = this.waveDelay(sq, true);
    }
    this.el.classList.remove('sb-dissolved');
    this.ensureAnimating();
  }

  bindEvents() {
    const el = this.el;
    el.addEventListener('mouseenter', () => this.shrink());
    el.addEventListener('mouseleave', () => this.reset());
    el.addEventListener('mousedown', () => this.condense());
    el.addEventListener('mouseup', () => this.shrink());
    el.addEventListener('touchstart', () => this.shrink(), { passive: true });
    el.addEventListener('touchend', () => this.reset());
    el.addEventListener('focus', () => this.shrink());
    el.addEventListener('blur', () => this.reset());
  }

  ensureAnimating() {
    if (this.raf === null) this.raf = requestAnimationFrame(() => this.animate());
  }

  animate() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvasW, this.canvasH);

    const fillBase = this.variant === 'outlined' ? sbLighten(this.color, 0.62) : this.color;
    const { r: rows, c: cols } = this.grid;
    const radius = this.borderRadius;
    let animating = false;

    for (const sq of this.squares) {
      const lerp = 0.3;
      const dx = sq.targetX - sq.currentX;
      const dy = sq.targetY - sq.currentY;
      const dOpacity = sq.targetOpacity - sq.opacity;
      const dScale = sq.targetScale - sq.scale;

      if (
        Math.abs(dx) > 0.01 ||
        Math.abs(dy) > 0.01 ||
        Math.abs(dOpacity) > 0.01 ||
        Math.abs(dScale) > 0.01 ||
        sq.delay > 0
      ) {
        animating = true;
      }
      const delayed = sq.delay > 0;
      sq.delay = Math.max(0, sq.delay - 16);
      if (!delayed) {
        sq.currentX += dx * lerp;
        sq.currentY += dy * lerp;
        sq.opacity += dOpacity * lerp;
        sq.scale += dScale * lerp;
      }

      const half = (sq.size / 2) * sq.scale;
      ctx.save();
      ctx.translate(sq.currentX, sq.currentY);
      ctx.fillStyle = sbRgba(fillBase, sq.opacity);
      ctx.strokeStyle = sbRgba(this.color, sq.opacity);
      ctx.lineWidth = BORDER_WIDTH;

      const topLeft = sq.gridX === 0 && sq.gridY === 0;
      const topRight = sq.gridX === cols - 1 && sq.gridY === 0;
      const bottomLeft = sq.gridX === 0 && sq.gridY === rows - 1;
      const bottomRight = sq.gridX === cols - 1 && sq.gridY === rows - 1;
      const isCorner = topLeft || topRight || bottomLeft || bottomRight;

      if (isCorner) {
        // corner squares carry their rounded corner + border segments
        ctx.beginPath();
        if (topLeft) {
          ctx.moveTo(-half, -half + radius);
          ctx.arcTo(-half, -half, -half + radius, -half, radius);
        } else ctx.moveTo(-half, -half);
        if (topRight) {
          ctx.lineTo(half - radius, -half);
          ctx.arcTo(half, -half, half, -half + radius, radius);
        } else ctx.lineTo(half, -half);
        if (bottomRight) {
          ctx.lineTo(half, half - radius);
          ctx.arcTo(half, half, half - radius, half, radius);
        } else ctx.lineTo(half, half);
        if (bottomLeft) {
          ctx.lineTo(-half + radius, half);
          ctx.arcTo(-half, half, -half, half - radius, radius);
        } else ctx.lineTo(-half, half);
        ctx.closePath();
        ctx.clip();
        ctx.fill();

        if (topLeft) {
          ctx.beginPath();
          ctx.moveTo(-half, half);
          ctx.lineTo(-half, -half + radius);
          ctx.arcTo(-half, -half, -half + radius, -half, radius);
          ctx.lineTo(half, -half);
          ctx.stroke();
        }
        if (topRight) {
          ctx.beginPath();
          ctx.moveTo(-half, -half);
          ctx.lineTo(half - radius, -half);
          ctx.arcTo(half, -half, half, -half + radius, radius);
          ctx.lineTo(half, half);
          ctx.stroke();
        }
        if (bottomRight) {
          ctx.beginPath();
          ctx.moveTo(half, -half);
          ctx.lineTo(half, half - radius);
          ctx.arcTo(half, half, half - radius, half, radius);
          ctx.lineTo(-half, half);
          ctx.stroke();
        }
        if (bottomLeft) {
          ctx.beginPath();
          ctx.moveTo(half, half);
          ctx.lineTo(-half + radius, half);
          ctx.arcTo(-half, half, -half, half - radius, radius);
          ctx.lineTo(-half, -half);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.rect(-half, -half, sq.size * sq.scale, sq.size * sq.scale);
        ctx.clip();
        ctx.fill();
        // edge squares draw their share of the border
        if (sq.gridX === 0) {
          ctx.beginPath();
          ctx.moveTo(-half, -half);
          ctx.lineTo(-half, half);
          ctx.stroke();
        }
        if (sq.gridX === cols - 1) {
          ctx.beginPath();
          ctx.moveTo(half, -half);
          ctx.lineTo(half, half);
          ctx.stroke();
        }
        if (sq.gridY === 0) {
          ctx.beginPath();
          ctx.moveTo(-half, -half);
          ctx.lineTo(half, -half);
          ctx.stroke();
        }
        if (sq.gridY === rows - 1) {
          ctx.beginPath();
          ctx.moveTo(-half, half);
          ctx.lineTo(half, half);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    if (animating) {
      this.raf = requestAnimationFrame(() => this.animate());
    } else {
      this.raf = null; // stop when settled
    }
  }
}

function initSquareButtons(root = document) {
  const instances = [];
  root.querySelectorAll('[data-sq-btn]').forEach((el) => instances.push(new SquareButton(el)));
  return instances;
}
