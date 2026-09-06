/* plot.js — pequeño helper de trazado en <canvas> con sistema de coordenadas cartesiano.
   No depende de librerías externas: sólo Canvas2D. */

class CartesianPlot {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.padding = opts.padding || { left: 46, right: 18, top: 16, bottom: 30 };
    this.colors = {
      axis: 'rgba(220,225,255,0.55)',
      axisLabel: '#9CA3CC',
      amber: '#F2A93C',
      cyan: '#57D6C7',
      rose: '#E8607A',
      dim: 'rgba(156,163,204,0.35)'
    };
    this._resizeObserver = new ResizeObserver(() => this._fitDPR());
    this._resizeObserver.observe(canvas);
    this._fitDPR();
  }

  _fitDPR() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = rect.width;
    this.h = rect.height;
    if (this._lastDraw) this._lastDraw();
  }

  // set data-space bounds
  setBounds(xmin, xmax, ymin, ymax) {
    this.xmin = xmin; this.xmax = xmax; this.ymin = ymin; this.ymax = ymax;
  }

  toPx(x, y) {
    const { left, right, top, bottom } = this.padding;
    const plotW = this.w - left - right;
    const plotH = this.h - top - bottom;
    const px = left + (x - this.xmin) / (this.xmax - this.xmin) * plotW;
    const py = top + (1 - (y - this.ymin) / (this.ymax - this.ymin)) * plotH;
    return [px, py];
  }

  toData(px, py) {
    const { left, right, top, bottom } = this.padding;
    const plotW = this.w - left - right;
    const plotH = this.h - top - bottom;
    const x = this.xmin + (px - left) / plotW * (this.xmax - this.xmin);
    const y = this.ymin + (1 - (py - top) / plotH) * (this.ymax - this.ymin);
    return [x, y];
  }

  clear() {
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  drawAxes(xLabel = 'x', yLabel = 'y') {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = this.colors.axis;
    ctx.fillStyle = this.colors.axisLabel;
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.lineWidth = 1;

    // zero lines if in range
    if (this.xmin < 0 && this.xmax > 0) {
      const [px0] = this.toPx(0, 0);
      ctx.beginPath();
      ctx.moveTo(px0, this.padding.top);
      ctx.lineTo(px0, this.h - this.padding.bottom);
      ctx.stroke();
    }
    if (this.ymin < 0 && this.ymax > 0) {
      const [, py0] = this.toPx(0, 0);
      ctx.beginPath();
      ctx.moveTo(this.padding.left, py0);
      ctx.lineTo(this.w - this.padding.right, py0);
      ctx.stroke();
    }

    // border box
    ctx.strokeStyle = 'rgba(146,163,224,0.35)';
    ctx.strokeRect(this.padding.left, this.padding.top,
      this.w - this.padding.left - this.padding.right,
      this.h - this.padding.top - this.padding.bottom);

    // ticks
    const nTicksX = 6, nTicksY = 5;
    ctx.fillStyle = this.colors.axisLabel;
    for (let i = 0; i <= nTicksX; i++) {
      const xv = this.xmin + (this.xmax - this.xmin) * i / nTicksX;
      const [px] = this.toPx(xv, this.ymin);
      ctx.fillText(xv.toFixed(1), px - 10, this.h - this.padding.bottom + 16);
    }
    for (let i = 0; i <= nTicksY; i++) {
      const yv = this.ymin + (this.ymax - this.ymin) * i / nTicksY;
      const [, py] = this.toPx(this.xmin, yv);
      ctx.fillText(yv.toFixed(1), 4, py + 3);
    }

    ctx.fillStyle = this.colors.axisLabel;
    ctx.font = '11px "IBM Plex Sans", sans-serif';
    ctx.fillText(xLabel, this.w - this.padding.right - xLabel.length * 6, this.h - 6);
    ctx.save();
    ctx.translate(12, this.padding.top + 4);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    ctx.restore();
  }

  plotLine(points, color, opts = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = opts.width || 2;
    if (opts.dash) ctx.setLineDash(opts.dash);
    ctx.beginPath();
    let started = false;
    for (const [x, y] of points) {
      if (!isFinite(y)) { started = false; continue; }
      const [px, py] = this.toPx(x, y);
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  plotMarker(x, y, color, shape = 'x', size = 6) {
    const ctx = this.ctx;
    const [px, py] = this.toPx(x, y);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    if (shape === 'x') {
      ctx.beginPath();
      ctx.moveTo(px - size, py - size); ctx.lineTo(px + size, py + size);
      ctx.moveTo(px + size, py - size); ctx.lineTo(px - size, py + size);
      ctx.stroke();
    } else if (shape === 'o') {
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape === 'dot') {
      ctx.beginPath();
      ctx.arc(px, py, size * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  plotCircleData(cx, cy, r, color, dash = [4, 3]) {
    // draws a circle defined in data-space (approx, handles non-uniform scale by sampling)
    const pts = [];
    for (let a = 0; a <= 64; a++) {
      const th = a / 64 * Math.PI * 2;
      pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
    }
    this.plotLine(pts, color, { width: 1.3, dash });
  }

  onClick(cb) {
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const [x, y] = this.toData(px, py);
      cb(x, y);
    });
  }

  redrawOn(fn) {
    this._lastDraw = fn;
  }
}
