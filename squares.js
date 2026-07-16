// square grid: idle field, pixel word/shape formations, cursor shape, click ripples

class SquareField {
  constructor(container, options = {}) {
    this.container = container;
    this.opts = Object.assign(
      {
        formations: [],
        wordChangeDelay: 4000,
        wordLerp: 0.15,
        mouseLerp: 0.3,
        rippleDuration: 900,
        rippleIntensity: 1.5,
        rippleMaxRadius: 420,
        mouseScale: 0.4,
        defaultOpacity: 0.2,
        wordOpacity: 0.85,
        mouseEnabled: !window.matchMedia('(pointer: coarse)').matches,
        theme: {},
      },
      options,
    );
    this.theme = Object.assign(
      {
        mainColor: '#0f172a',
        mouseColor: '#0f172a',
        wordColor: '#0f172a',
        rippleColor: '#3b82f6',
      },
      options.theme || {},
    );

    this.squares = [];
    this.ripples = [];
    this.mouse = null;
    this.mouseIdle = false;
    this.formationIndex = 0;
    this.rippleId = 0;
    this.colorCache = new Map();
    this.letterBounds = new Map();

    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    container.appendChild(this.canvas);
    if (this.opts.mouseEnabled) container.style.cursor = 'none';

    this.initGrid();
    this.bindEvents();
    this.startFormationCycle();
    this.raf = requestAnimationFrame(() => this.animate());
  }

  hexToRgb(hex) {
    let c = this.colorCache.get(hex);
    if (!c) {
      c = {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
      };
      this.colorCache.set(hex, c);
    }
    return c;
  }

  initGrid() {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);

    const size = Math.min(Math.max(10, rect.width / 60), 20);
    const spacing = size * 2.2;
    const cols = Math.ceil(rect.width / spacing);
    const rows = Math.ceil(rect.height / spacing);
    const main = this.hexToRgb(this.theme.mainColor);

    this.baseSize = size;
    this.squares = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * spacing + spacing / 2;
        const y = row * spacing + spacing / 2;
        this.squares.push({
          id: row * cols + col,
          originalX: x,
          originalY: y,
          currentX: x,
          currentY: y,
          baseSize: size,
          scale: 0.6,
          opacity: this.opts.defaultOpacity,
          targetX: x,
          targetY: y,
          targetScale: 0.6,
          targetOpacity: this.opts.defaultOpacity,
          currentColor: { ...main },
          targetColor: { ...main },
          formationX: undefined,
          formationY: undefined,
          formationColor: undefined,
          rippleScale: 1,
          rippleOpacity: 0,
          tag: undefined,
        });
      }
    }
    // resize: re-apply the current formation
    if (this.opts.formations.length && this.hasAppliedFormation) {
      this.formationIndex = Math.max(0, this.formationIndex - 1);
      this.applyFormation();
    }
  }

  getLetterBounds(pattern, char) {
    if (char && this.letterBounds.has(char)) return this.letterBounds.get(char);
    let minCol = pattern[0]?.length || 0;
    let maxCol = -1;
    for (const row of pattern) {
      for (let col = 0; col < row.length; col++) {
        if (row[col] === 1) {
          minCol = Math.min(minCol, col);
          maxCol = Math.max(maxCol, col);
        }
      }
    }
    const bounds =
      maxCol === -1
        ? { minCol: 0, maxCol: 0, width: 0 }
        : { minCol, maxCol, width: maxCol - minCol + 1 };
    if (char) this.letterBounds.set(char, bounds);
    return bounds;
  }

  shapePositions(element, centerX, centerY) {
    const pattern = element.shape;
    if (!pattern || !pattern.length) return [];
    const pH = pattern.length;
    const pW = pattern[0].length;
    const margin = 0.6;
    const scaleX = (this.width * margin) / (pW * this.baseSize);
    const scaleY = (this.height * margin) / (pH * this.baseSize);
    let scale = Math.min(scaleX, scaleY, 1.5) * 0.9;
    if (element.maxScale) scale = Math.min(scale, element.maxScale);
    const cell = this.baseSize * scale;
    const startX = centerX - (pW * cell) / 2 + (element.offsetX || 0) * this.baseSize;
    const startY = centerY - (pH * cell) / 2 + (element.offsetY || 0) * this.baseSize;

    const positions = [];
    for (let row = 0; row < pH; row++) {
      for (let col = 0; col < pW; col++) {
        const v = pattern[row][col];
        if (v > 0) {
          positions.push({
            x: startX + col * cell,
            y: startY + row * cell,
            scale,
            color: element.colorMap?.[v] ?? element.color,
            opacity: element.opacity,
          });
        }
      }
    }
    return positions;
  }

  wordPositions(element, centerX, centerY) {
    const words = Array.isArray(element.words) ? element.words : [element.words];
    const layout = element.layout || 'auto';
    const letterSpacing = 1.2;
    const spaceWidth = 2.5;
    const wordSpacing = 3;
    const lineSpacing = 2;

    const dims = words.map((word, i) => {
      const chars = word.toUpperCase().split('');
      const charWidths = chars.map((ch) => {
        if (ch === ' ') return spaceWidth;
        const pattern = LETTER_PATTERNS[ch] || LETTER_PATTERNS[' '];
        return Math.max(this.getLetterBounds(pattern, ch).width, 1);
      });
      const width = charWidths.reduce(
        (t, w, idx) => t + w + (idx < chars.length - 1 ? letterSpacing : 0),
        0,
      );
      const color = Array.isArray(element.color)
        ? element.color[i] || element.color[0]
        : element.color;
      return { chars, charWidths, width, color };
    });

    let lines, totalW, totalH;
    if (layout === 'vertical' || (layout === 'auto' && words.length > 3)) {
      lines = dims.map((d) => [d]);
      totalW = Math.max(...dims.map((d) => d.width));
      totalH = dims.length * 7 + (dims.length - 1) * lineSpacing;
    } else {
      lines = [dims];
      totalW = dims.reduce((t, d, i) => t + d.width + (i > 0 ? wordSpacing : 0), 0);
      totalH = 7;
    }

    const margin = 0.8;
    const scaleX = (this.width * margin) / (totalW * this.baseSize);
    const scaleY = (this.height * margin) / (totalH * this.baseSize);
    let scale = Math.min(scaleX, scaleY, 1.0) * 0.9;
    if (element.maxScale) scale = Math.min(scale, element.maxScale);
    const cell = this.baseSize * scale;

    const startX = centerX - (totalW * cell) / 2 + (element.offsetX || 0) * this.baseSize;
    let currentY = centerY - (totalH * cell) / 2 + (element.offsetY || 0) * this.baseSize;

    const positions = [];
    for (const line of lines) {
      const lineWidth = line.reduce((t, d, i) => t + d.width + (i > 0 ? wordSpacing : 0), 0);
      let currentX = startX + ((totalW - lineWidth) * cell) / 2;

      for (const dim of line) {
        let letterX = currentX / cell;
        dim.chars.forEach((ch, ci) => {
          if (ch !== ' ') {
            const pattern = LETTER_PATTERNS[ch] || LETTER_PATTERNS[' '];
            const bounds = this.getLetterBounds(pattern, ch);
            for (let row = 0; row < pattern.length; row++) {
              for (let col = 0; col < pattern[row].length; col++) {
                if (pattern[row][col] === 1) {
                  positions.push({
                    x: (letterX + col - bounds.minCol) * cell,
                    y: currentY + row * cell,
                    scale,
                    color: dim.color,
                    opacity: element.opacity,
                  });
                }
              }
            }
          }
          letterX += dim.charWidths[ci] + letterSpacing;
        });
        currentX += (dim.width + wordSpacing) * cell;
      }
      currentY += (7 + lineSpacing) * cell;
    }
    return positions;
  }

  applyFormation() {
    const formations = this.opts.formations;
    if (!formations.length) return;
    this.hasAppliedFormation = true;
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const frame = formations[this.formationIndex % formations.length];
    this.formationIndex++;

    const elements = Array.isArray(frame) ? frame : [frame];
    const main = this.hexToRgb(this.theme.mainColor);

    // release the previous formation
    for (const sq of this.squares) {
      if (sq.tag !== 'word') continue;
      sq.targetX = sq.originalX;
      sq.targetY = sq.originalY;
      sq.targetScale = 0.6;
      sq.targetOpacity = this.opts.defaultOpacity;
      sq.formationX = undefined;
      sq.formationY = undefined;
      sq.formationColor = undefined;
      sq.targetColor = { ...main };
      sq.tag = undefined;
    }

    const positions = [];
    for (const el of elements) {
      if (el.type === 'shape') positions.push(...this.shapePositions(el, centerX, centerY));
      else if (el.type === 'word') positions.push(...this.wordPositions(el, centerX, centerY));
    }

    // nearest free square claims each position
    const claimed = new Set();
    for (const pos of positions) {
      let best = null;
      let bestDist = Infinity;
      for (const sq of this.squares) {
        if (claimed.has(sq.id)) continue;
        const dx = sq.originalX - pos.x;
        const dy = sq.originalY - pos.y;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          best = sq;
        }
      }
      if (!best) continue;
      const color = this.hexToRgb(pos.color || this.theme.wordColor);
      best.targetX = pos.x;
      best.targetY = pos.y;
      best.targetScale = pos.scale;
      best.targetOpacity = pos.opacity ?? this.opts.wordOpacity;
      best.formationX = pos.x;
      best.formationY = pos.y;
      best.formationColor = { ...color };
      best.targetColor = { ...color };
      best.tag = 'word';
      claimed.add(best.id);
    }
  }

  startFormationCycle() {
    if (!this.opts.formations.length) return;
    const tick = () => {
      this.applyFormation();
      this.cycleTimer = setTimeout(tick, this.opts.wordChangeDelay);
    };
    this.cycleTimer = setTimeout(tick, 400);
  }

  createRipple(x, y) {
    const ripple = {
      id: this.rippleId++,
      x,
      y,
      radius: 0,
      maxRadius: this.opts.rippleMaxRadius,
      intensity: this.opts.rippleIntensity,
      startTime: performance.now(),
      duration: this.opts.rippleDuration,
    };
    this.ripples.push(ripple);
    setTimeout(() => {
      this.ripples = this.ripples.filter((r) => r.id !== ripple.id);
    }, ripple.duration);
  }

  bindEvents() {
    this.resizeObserver = new ResizeObserver(() => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => this.initGrid(), 300);
    });
    this.resizeObserver.observe(this.container);

    this.container.addEventListener('pointermove', (e) => {
      if (!this.opts.mouseEnabled) return;
      const rect = this.canvas.getBoundingClientRect();
      this.mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      this.mouseIdle = false;
      clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => (this.mouseIdle = true), 5000);
    });
    this.container.addEventListener('pointerleave', () => (this.mouse = null));
    this.container.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.createRipple(e.clientX - rect.left, e.clientY - rect.top);
    });
  }

  animate() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const now = performance.now();

    for (const r of this.ripples) {
      r.radius = Math.min((now - r.startTime) / r.duration, 1) * r.maxRadius;
    }

    // squares form the cursor shape
    const mouseSquares = new Map();
    if (this.mouse && !this.mouseIdle && this.opts.mouseEnabled) {
      const cell = this.baseSize * this.opts.mouseScale;
      for (let row = 0; row < MOUSE_SHAPE.length; row++) {
        for (let col = 0; col < MOUSE_SHAPE[row].length; col++) {
          if (MOUSE_SHAPE[row][col] !== 1) continue;
          const tx = this.mouse.x + col * cell;
          const ty = this.mouse.y + row * cell;
          let best = null;
          let bestDist = Infinity;
          for (const sq of this.squares) {
            if (mouseSquares.has(sq.id)) continue;
            const sx = sq.formationX ?? sq.originalX;
            const sy = sq.formationY ?? sq.originalY;
            const d = (sx - tx) ** 2 + (sy - ty) ** 2;
            if (d < bestDist) {
              bestDist = d;
              best = sq;
            }
          }
          if (best) mouseSquares.set(best.id, { x: tx, y: ty });
        }
      }
    }

    const mainColor = this.hexToRgb(this.theme.mainColor);
    const mouseColor = this.hexToRgb(this.theme.mouseColor);
    const rippleColor = this.hexToRgb(this.theme.rippleColor);

    for (const sq of this.squares) {
      const inMouse = mouseSquares.has(sq.id);
      let targetX = sq.targetX;
      let targetY = sq.targetY;
      let targetOpacity = sq.targetOpacity;
      let targetScale = sq.targetScale;

      if (inMouse) {
        const m = mouseSquares.get(sq.id);
        targetX = m.x;
        targetY = m.y;
        targetOpacity = 1;
        targetScale = this.opts.mouseScale;
        sq.targetColor = { ...mouseColor };
        sq.rippleScale = 1;
        sq.rippleOpacity = 0;
      } else {
        let scaleBoost = 0;
        let opacityBoost = 0;
        let waveX = 0;
        let waveY = 0;

        for (const r of this.ripples) {
          const sx = sq.formationX ?? sq.originalX;
          const sy = sq.formationY ?? sq.originalY;
          const dist = Math.hypot(sx - r.x, sy - r.y);
          const thickness = 80;
          if (dist >= r.radius - thickness && dist <= r.radius + thickness) {
            const waveIntensity = 1 - Math.abs(dist - r.radius) / thickness;
            const elapsed = now - r.startTime;
            const fade = 1 - (elapsed / r.duration) ** 2;
            const intensity = waveIntensity * fade * r.intensity;
            scaleBoost = Math.max(scaleBoost, intensity);
            opacityBoost = Math.max(opacityBoost, intensity * 0.4);
            if (dist > 0) {
              const phase = (elapsed / r.duration) * Math.PI * 2;
              const offset = Math.sin(phase) * intensity * 25;
              waveX += ((sx - r.x) / dist) * offset;
              waveY += ((sy - r.y) / dist) * offset;
            }
          }
        }

        sq.rippleScale = 1 + scaleBoost;
        sq.rippleOpacity = opacityBoost;
        targetX += waveX;
        targetY += waveY;

        if (sq.rippleOpacity > 0.1) {
          sq.targetColor = { ...rippleColor };
        } else if (sq.formationX !== undefined) {
          sq.targetColor = sq.formationColor ? { ...sq.formationColor } : { ...mainColor };
        } else {
          sq.targetColor = { ...mainColor };
        }
      }

      const finalScale = targetScale * sq.rippleScale;
      const finalOpacity = Math.min(1, targetOpacity + sq.rippleOpacity);
      const lerp = inMouse ? this.opts.mouseLerp : this.opts.wordLerp;
      const speed = sq.rippleOpacity > 0.1 ? Math.min(lerp * 3, 0.3) : lerp;

      sq.currentX += (targetX - sq.currentX) * speed;
      sq.currentY += (targetY - sq.currentY) * speed;
      sq.opacity += (finalOpacity - sq.opacity) * lerp;
      sq.scale += (finalScale - sq.scale) * lerp;
      sq.currentColor.r += (sq.targetColor.r - sq.currentColor.r) * lerp;
      sq.currentColor.g += (sq.targetColor.g - sq.currentColor.g) * lerp;
      sq.currentColor.b += (sq.targetColor.b - sq.currentColor.b) * lerp;

      if (sq.opacity < 0.02) continue;

      const size = sq.baseSize * sq.scale;
      const half = size / 2;
      const { r, g, b } = sq.currentColor;
      const alpha = Math.min(0.55, sq.opacity);
      ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
      ctx.fillRect(sq.currentX - half, sq.currentY - half, size, size);
      if (sq.scale > 1.0) {
        ctx.strokeStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${sq.opacity})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(sq.currentX - half, sq.currentY - half, size, size);
      }
    }

    this.raf = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.cycleTimer);
    this.resizeObserver.disconnect();
    this.canvas.remove();
  }
}

// static pixel icons
function drawPixelIcon(canvas, pattern, colorMap, cellSize = 6, gap = 1) {
  const rows = pattern.length;
  const cols = pattern[0].length;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = cols * cellSize * dpr;
  canvas.height = rows * cellSize * dpr;
  canvas.style.width = `${cols * cellSize}px`;
  canvas.style.height = `${rows * cellSize}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const v = pattern[row][col];
      if (v > 0) {
        ctx.fillStyle = colorMap[v] || '#0f172a';
        ctx.fillRect(col * cellSize + gap / 2, row * cellSize + gap / 2, cellSize - gap, cellSize - gap);
      }
    }
  }
}

// pixel word (nav logo)
function drawPixelWord(canvas, word, color = '#0f172a', cellSize = 3, gap = 0.6) {
  const chars = word.toUpperCase().split('');
  const letterSpacing = 1;
  let totalCols = 0;
  const patterns = chars.map((ch) => {
    const p = LETTER_PATTERNS[ch] || LETTER_PATTERNS[' '];
    let minCol = p[0].length;
    let maxCol = -1;
    for (const row of p)
      for (let c = 0; c < row.length; c++)
        if (row[c] === 1) {
          minCol = Math.min(minCol, c);
          maxCol = Math.max(maxCol, c);
        }
    const width = maxCol === -1 ? 2 : maxCol - minCol + 1;
    totalCols += width + letterSpacing;
    return { p, minCol, width };
  });
  totalCols -= letterSpacing;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = totalCols * cellSize * dpr;
  canvas.height = 7 * cellSize * dpr;
  canvas.style.width = `${totalCols * cellSize}px`;
  canvas.style.height = `${7 * cellSize}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = color;

  let x = 0;
  for (const { p, minCol, width } of patterns) {
    for (let row = 0; row < p.length; row++) {
      for (let col = 0; col < p[row].length; col++) {
        if (p[row][col] === 1) {
          ctx.fillRect(
            (x + col - minCol) * cellSize + gap / 2,
            row * cellSize + gap / 2,
            cellSize - gap,
            cellSize - gap,
          );
        }
      }
    }
    x += width + letterSpacing;
  }
}
