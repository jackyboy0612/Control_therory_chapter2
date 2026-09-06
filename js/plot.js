/* plot.js — pequeño helper de trazado en <canvas> con sistema de coordenadas cartesiano.
   Incluye zoom (rueda del mouse o botones) y arrastre (pan). Sin librerías externas. */

class CartesianPlot {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.padding = opts.padding || { left: 62, right: 20, top: 20, bottom: 46 };
    this.colors = {
      axis: 'rgba(220,225,255,0.55)',
      axisLabel: '#B7BEE8',
      axisTitle: '#ECEBF2',
      amber: '#F2A93C',
      cyan: '#57D6C7',
      rose: '#E8607A',
      dim: 'rgba(156,163,204,0.35)'
    };
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this._natural = null;
    this._dragging = false;
    this._dragMoved = false;
    this._dragStart = null;

    this._resizeObserver = new ResizeObserver(() => this._fitDPR());
    this._resizeObserver.observe(canvas);
    this._fitDPR();
    this._setupZoomPan();
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

  // set data-space bounds "naturales" (antes de aplicar zoom/pan)
  setBounds(xmin, xmax, ymin, ymax) {
    this._natural = { xmin, xmax, ymin, ymax };
    this._applyZoomPan();
  }

  _applyZoomPan() {
    if (!this._natural) return;
    const { xmin, xmax, ymin, ymax } = this._natural;
    const cx = (xmin + xmax) / 2 + this.panX;
    const cy = (ymin + ymax) / 2 + this.panY;
    const hw = (xmax - xmin) / 2 / this.zoom;
    const hh = (ymax - ymin) / 2 / this.zoom;
    this.xmin = cx - hw; this.xmax = cx + hw;
    this.ymin = cy - hh; this.ymax = cy + hh;
  }

  zoomBy(factor, pivotPx) {
    if (!this._natural) return;
    let dataBefore = null;
    if (pivotPx) dataBefore = this.toData(pivotPx.x, pivotPx.y);
    this.zoom = Math.min(Math.max(this.zoom * factor, 0.25), 25);
    this._applyZoomPan();
    if (pivotPx) {
      const dataAfter = this.toData(pivotPx.x, pivotPx.y);
      this.panX += (dataBefore[0] - dataAfter[0]);
      this.panY += (dataBefore[1] - dataAfter[1]);
      this._applyZoomPan();
    }
    if (this._lastDraw) this._lastDraw();
  }

  resetZoom() {
    this.zoom = 1; this.panX = 0; this.panY = 0;
    this._applyZoomPan();
    if (this._lastDraw) this._lastDraw();
  }

  _setupZoomPan() {
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      this.zoomBy(factor, { x: px, y: py });
    }, { passive: false });

    this.canvas.addEventListener('pointerdown', (e) => {
      this._dragging = true;
      this._dragMoved = false;
      this._dragStart = { x: e.clientX, y: e.clientY, panX: this.panX, panY: this.panY };
      this.canvas.style.cursor = 'grabbing';
    });
    window.addEventListener('pointermove', (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - this._dragStart.x, dy = e.clientY - this._dragStart.y;
      if (Math.hypot(dx, dy) > 4) this._dragMoved = true;
      if (!this._dragMoved) return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = (this.xmax - this.xmin) / rect.width;
      const scaleY = (this.ymax - this.ymin) / rect.height;
      this.panX = this._dragStart.panX - dx * scaleX;
      this.panY = this._dragStart.panY + dy * scaleY;
      this._applyZoomPan();
      if (this._lastDraw) this._lastDraw();
    });
    window.addEventListener('pointerup', () => {
      this._dragging = false;
      this.canvas.style.cursor = '';
    });
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
    ctx.lineWidth = 1;

    // zero lines si están en el rango
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

    // caja del área de trazado
    ctx.strokeStyle = 'rgba(146,163,224,0.35)';
    ctx.strokeRect(this.padding.left, this.padding.top,
      this.w - this.padding.left - this.padding.right,
      this.h - this.padding.top - this.padding.bottom);

    // marcas (ticks)
    const nTicksX = 6, nTicksY = 5;
    ctx.font = '12px "IBM Plex Mono", monospace';
    ctx.fillStyle = this.colors.axisLabel;
    ctx.textAlign = 'center';
    for (let i = 0; i <= nTicksX; i++) {
      const xv = this.xmin + (this.xmax - this.xmin) * i / nTicksX;
      const [px] = this.toPx(xv, this.ymin);
      ctx.fillText(this._fmtTick(xv), px, this.h - this.padding.bottom + 18);
    }
    ctx.textAlign = 'right';
    for (let i = 0; i <= nTicksY; i++) {
      const yv = this.ymin + (this.ymax - this.ymin) * i / nTicksY;
      const [, py] = this.toPx(this.xmin, yv);
      ctx.fillText(this._fmtTick(yv), this.padding.left - 10, py + 4);
    }

    // título del eje X: centrado bajo los números, con separación clara
    ctx.textAlign = 'center';
    ctx.font = '600 13px "IBM Plex Sans", sans-serif';
    ctx.fillStyle = this.colors.axisTitle;
    const xTitleX = this.padding.left + (this.w - this.padding.left - this.padding.right) / 2;
    ctx.fillText(xLabel, xTitleX, this.h - 6);

    // título del eje Y: rotado -90°, centrado verticalmente, separado de los números de las marcas
    ctx.save();
    ctx.translate(16, this.padding.top + (this.h - this.padding.top - this.padding.bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    ctx.restore();
  }

  _fmtTick(v) {
    if (Math.abs(v) < 1e-9) return '0';
    if (Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0)) return v.toExponential(1);
    return v.toFixed(Math.abs(v) < 10 ? 2 : 1);
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
    } else if (shape === 'ring') {
      ctx.fillStyle = '#10142E';
      ctx.beginPath();
      ctx.arc(px, py, size * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  plotCircleData(cx, cy, r, color, dash = [4, 3]) {
    const pts = [];
    for (let a = 0; a <= 64; a++) {
      const th = a / 64 * Math.PI * 2;
      pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
    }
    this.plotLine(pts, color, { width: 1.3, dash });
  }

  onClick(cb) {
    this.canvas.addEventListener('click', (e) => {
      if (this._dragMoved) { this._dragMoved = false; return; }
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
