/* linearization.js — sección 1: linealización de sistemas no lineales ẋ = f(x,u) */

(function () {
  const PRESETS = {
    taylor: {
      expr: 'x*sqrt(x^2+5*x)',
      xRange: [-1, 12],
      xbar: 5, u: 1, uRange: null,
      xLabel: 'x', yLabel: 'ẋ = f(x)'
    },
    reactor: {
      // dx/dt = -k x^2 + (u/V)(c - x), k=1, V=1, c=2 (ejemplo del capítulo)
      expr: '-1*x^2 + (u/1)*(2-x)',
      xRange: [-0.5, 4],
      xbar: 1, u: 1, uRange: [0, 3],
      xLabel: 'x (concentración, mol/L)', yLabel: 'ẋ = f(x,u)'
    },
    tank: {
      // dh/dt = (q - c*sqrt(h))/A, A=2, c=0.5 (ejercicio de repaso)
      expr: '(u - 0.5*sqrt(x))/2',
      xRange: [0, 10],
      xbar: 4, u: 1, uRange: [0, 3],
      xLabel: 'h (nivel, m)', yLabel: 'ḣ = f(h,q)'
    },
    custom: {
      expr: 'x*sqrt(x^2+5*x)',
      xRange: [-2, 12],
      xbar: 5, u: 1, uRange: [0, 5],
      xLabel: 'x', yLabel: 'ẋ = f(x,u)'
    }
  };

  const el = (id) => document.getElementById(id);
  const presetSel = el('lin-preset');
  const customWrap = el('lin-custom-wrap');
  const customInput = el('lin-custom-fn');
  const uWrap = el('lin-u-wrap');
  const xbarSlider = el('lin-xbar');
  const uSlider = el('lin-u');
  const windowSlider = el('lin-window');

  const canvas = el('lin-canvas');
  const plot = new CartesianPlot(canvas);

  let state = Object.assign({}, PRESETS.taylor);
  let compiledF = null, compiledDfdx = null, compiledDfdu = null;

  function compile() {
    try {
      const node = math.parse(state.expr);
      compiledF = node.compile();
      compiledDfdx = math.derivative(node, 'x').compile();
      // dfdu may fail if u not present; guard it
      try {
        compiledDfdu = math.derivative(node, 'u').compile();
      } catch (e) {
        compiledDfdu = { evaluate: () => 0 };
      }
      try {
        MathFmt.render(el('lin-fx-tex'), `f(x,u) = ${node.toTex()}`, true);
      } catch (e) { /* ignore tex conversion issues */ }
      return true;
    } catch (e) {
      compiledF = null;
      return false;
    }
  }

  function renderTaylorFormula() {
    MathFmt.render(el('lin-taylor-formula'),
      `f(x) \\approx f(\\bar{x}) + \\left.\\frac{\\partial f}{\\partial x}\\right|_{\\bar{x}}\\big(x-\\bar{x}\\big) \\;=\\; f(\\bar{x}) + \\left.\\frac{\\partial f}{\\partial x}\\right|_{\\bar{x}}\\hat{x}(t)`,
      true);
  }

  function f(x, u) {
    try { return compiledF.evaluate({ x, u }); } catch (e) { return NaN; }
  }
  function dfdx(x, u) {
    try { return compiledDfdx.evaluate({ x, u }); } catch (e) { return NaN; }
  }
  function dfdu(x, u) {
    try { return compiledDfdu.evaluate({ x, u }); } catch (e) { return 0; }
  }

  function applyPreset(name) {
    const p = PRESETS[name];
    state = Object.assign({}, p);
    customWrap.style.display = name === 'custom' ? 'flex' : 'none';
    uWrap.style.display = p.uRange ? 'flex' : 'none';
    if (name === 'custom') state.expr = customInput.value;

    xbarSlider.min = p.xRange[0];
    xbarSlider.max = p.xRange[1];
    xbarSlider.value = p.xbar;
    if (p.uRange) {
      uSlider.min = p.uRange[0]; uSlider.max = p.uRange[1]; uSlider.value = p.u;
    }
    compile();
    render();
  }

  function currentExpr() {
    return presetSel.value === 'custom' ? customInput.value : PRESETS[presetSel.value].expr;
  }

  function render() {
    const xbar = parseFloat(xbarSlider.value);
    const u = parseFloat(uSlider.value);
    const win = parseFloat(windowSlider.value);
    el('lin-xbar-readout').textContent = xbar.toFixed(2);
    el('lin-u-readout').textContent = u.toFixed(2);
    el('lin-window-readout').textContent = win.toFixed(1);

    if (!compiledF) { compile(); }
    if (!compiledF) return;

    const [xr0, xr1] = state.xRange;
    const pad = (xr1 - xr0) * 0.06;
    plot.setBounds(xr0 - pad, xr1 + pad, 0, 1); // ymin/ymax placeholder, fixed below

    // sample f over range to find y bounds
    const N = 240;
    const curve = [];
    let ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i <= N; i++) {
      const x = xr0 - pad + (xr1 - xr0 + 2 * pad) * i / N;
      const y = f(x, u);
      curve.push([x, y]);
      if (isFinite(y)) { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
    }
    if (!isFinite(ymin) || !isFinite(ymax)) { ymin = -1; ymax = 1; }
    const ypad = (ymax - ymin) * 0.12 || 1;
    plot.setBounds(xr0 - pad, xr1 + pad, ymin - ypad, ymax + ypad);

    const slope = dfdx(xbar, u);
    const fxbar = f(xbar, u);
    const dU = dfdu(xbar, u);

    // tangent line over the analysis window
    const tangent = [];
    const lo = Math.max(xr0 - pad, xbar - win), hi = Math.min(xr1 + pad, xbar + win);
    for (let i = 0; i <= 40; i++) {
      const x = lo + (hi - lo) * i / 40;
      const y = fxbar + slope * (x - xbar);
      tangent.push([x, y]);
    }

    const draw = () => {
      plot.clear();
      plot.drawAxes(state.xLabel, state.yLabel);
      plot.plotLine(curve, '#F2A93C', { width: 2.2 });
      plot.plotLine(tangent, '#57D6C7', { width: 2.4 });
      plot.plotMarker(xbar, fxbar, '#57D6C7', 'dot', 5);
      // shade window boundary as vertical dashed guides
      const ctx = plot.ctx;
      [lo, hi].forEach((xv) => {
        const [px] = plot.toPx(xv, 0);
        ctx.save();
        ctx.strokeStyle = 'rgba(232,96,122,0.5)';
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(px, plot.padding.top);
        ctx.lineTo(px, plot.h - plot.padding.bottom);
        ctx.stroke();
        ctx.restore();
      });
    };
    plot.redrawOn(draw);
    draw();

    // error metric over window
    let maxRelErr = 0;
    for (let i = 0; i <= 60; i++) {
      const x = lo + (hi - lo) * i / 60;
      const yTrue = f(x, u);
      const yLin = fxbar + slope * (x - xbar);
      if (Math.abs(yTrue) > 1e-6) {
        const err = Math.abs((yTrue - yLin) / yTrue);
        if (isFinite(err)) maxRelErr = Math.max(maxRelErr, err);
      }
    }

    el('lin-dfdx').textContent = isFinite(slope) ? slope.toFixed(4) : '—';
    el('lin-dfdu').textContent = state.uRange ? (isFinite(dU) ? dU.toFixed(4) : '—') : 'n/a';
    el('lin-fxbar').textContent = isFinite(fxbar) ? fxbar.toFixed(4) : '—';
    el('lin-error').textContent = isFinite(maxRelErr) ? (maxRelErr * 100).toFixed(1) + ' %' : '—';

    const term2 = state.uRange && Math.abs(dU) > 1e-9
      ? ` + (${dU.toFixed(3)})\\,\\hat{u}(t)` : '';
    MathFmt.render(el('lin-equation'),
      `\\dot{\\hat{x}}(t) \\approx (${slope.toFixed(3)})\\,\\hat{x}(t)${term2}`,
      true);
  }

  presetSel.addEventListener('change', () => applyPreset(presetSel.value));
  customInput.addEventListener('input', () => { state.expr = customInput.value; if (compile()) render(); });
  xbarSlider.addEventListener('input', render);
  uSlider.addEventListener('input', render);
  windowSlider.addEventListener('input', render);
  plot.onClick((x) => {
    const [xr0, xr1] = state.xRange;
    const clamped = Math.min(Math.max(x, parseFloat(xbarSlider.min)), parseFloat(xbarSlider.max));
    xbarSlider.value = clamped.toFixed(2);
    render();
  });

  window.addEventListener('DOMContentLoaded', () => {
    renderTaylorFormula();
    applyPreset('taylor');
  });
  // In case app.js triggers visibility change, replot to fix canvas sizing
  window.__linRender = render;
})();
