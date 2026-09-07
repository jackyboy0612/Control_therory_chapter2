/* linearization.js — sección 1: linealización de sistemas no lineales ẋ = f(x,u)
   Restringida a puntos de equilibrio: f(x̄,ū) = 0. Los equilibrios se detectan
   numéricamente (barrido + bisección) y se ofrecen como las únicas opciones válidas. */

(function () {
  const PRESETS = {
    eq1a: {
      // Ejercicio 1(a) de "Ejercicios de Repaso": ẋ = -x + 2√x + u, alrededor de ū=0, x̄>0.
      expr: '-x + 2*sqrt(x) + u',
      xRange: [0, 10],
      u: 0, uRange: null,
      xLabel: 'x', yLabel: 'ẋ = f(x,u)'
    },
    bistable: {
      // ẋ = x - x^3 : tres equilibrios en x = -1, 0, 1 (uno inestable, dos estables)
      expr: 'x - x^3',
      xRange: [-2, 2],
      u: 0, uRange: null,
      xLabel: 'x', yLabel: 'ẋ = f(x)'
    },
    reactor: {
      // dx/dt = -k x^2 + (u/V)(c - x), k=1, V=1, c=2 (ejemplo del capítulo)
      expr: '-1*x^2 + (u/1)*(2-x)',
      xRange: [-0.5, 4],
      u: 1, uRange: [0, 3],
      xLabel: 'x (concentración, mol/L)', yLabel: 'ẋ = f(x,u)'
    },
    tank: {
      // dh/dt = (q - c*sqrt(h))/A, A=2, c=0.5 (ejercicio de repaso). Equilibrio en h̄=4q̄² (visible para q̄≤1.5).
      expr: '(u - 0.5*sqrt(x))/2',
      xRange: [0, 10],
      u: 1, uRange: [0, 1.5],
      xLabel: 'h (nivel, m)', yLabel: 'ḣ = f(h,q)'
    },
    custom: {
      expr: 'x*sqrt(x^2+5*x)',
      xRange: [0, 12],
      u: 1, uRange: [0, 5],
      xLabel: 'x', yLabel: 'ẋ = f(x,u)'
    }
  };

  const el = (id) => document.getElementById(id);
  const presetSel = el('lin-preset');
  const customWrap = el('lin-custom-wrap');
  const customInput = el('lin-custom-fn');
  const uWrap = el('lin-u-wrap');
  const uSlider = el('lin-u');
  const windowSlider = el('lin-window');
  const eqSelect = el('lin-equilibria');
  const rangeScaleSlider = el('lin-range-scale');
  const rangeReadout = el('lin-range-readout');
  const rangeValuesEl = el('lin-range-values');

  const canvas = el('lin-canvas');
  const plot = new CartesianPlot(canvas);

  let state = Object.assign({}, PRESETS.eq1a, { baseXRange: PRESETS.eq1a.xRange.slice() });
  let compiledF = null, compiledDfdx = null, compiledDfdu = null;
  let equilibria = [];
  let selectedEq = null; // valor x̄ actualmente seleccionado
  let yBounds = [-1, 1]; // límites fijos del eje Y — solo se recalculan al cambiar de función o de rango de x

  function compile() {
    try {
      const node = math.parse(state.expr);
      compiledF = node.compile();
      compiledDfdx = math.derivative(node, 'x').compile();
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
    try { const v = compiledF.evaluate({ x, u }); return typeof v === 'number' ? v : NaN; }
    catch (e) { return NaN; }
  }
  function dfdx(x, u) {
    try { const v = compiledDfdx.evaluate({ x, u }); return typeof v === 'number' ? v : NaN; }
    catch (e) { return NaN; }
  }
  function dfdu(x, u) {
    try { const v = compiledDfdu.evaluate({ x, u }); return typeof v === 'number' ? v : 0; }
    catch (e) { return 0; }
  }

  // Busca todos los ceros de f(x,u)=0 en xRange: barrido + detección de cambio de signo + bisección.
  function findEquilibria(u, xRange) {
    if (!compiledF) return [];
    const [x0, x1] = xRange;
    const N = 800;
    const xs = new Array(N + 1), ys = new Array(N + 1);
    for (let i = 0; i <= N; i++) {
      xs[i] = x0 + (x1 - x0) * i / N;
      ys[i] = f(xs[i], u);
    }
    const roots = [];
    for (let i = 0; i <= N; i++) {
      if (isFinite(ys[i]) && Math.abs(ys[i]) < 1e-7) roots.push(xs[i]);
    }
    for (let i = 1; i <= N; i++) {
      const a = ys[i - 1], b = ys[i];
      if (!isFinite(a) || !isFinite(b)) continue;
      if (a * b < 0) {
        let lo = xs[i - 1], hi = xs[i], flo = a;
        for (let k = 0; k < 50; k++) {
          const mid = (lo + hi) / 2, fm = f(mid, u);
          if (!isFinite(fm)) break;
          if (Math.abs(fm) < 1e-12) { lo = hi = mid; break; }
          if ((flo < 0) === (fm < 0)) { lo = mid; flo = fm; } else { hi = mid; }
        }
        roots.push((lo + hi) / 2);
      }
    }
    const eps = (x1 - x0) * 0.008;
    const sorted = roots.sort((a, b) => a - b);
    const deduped = [];
    sorted.forEach((r) => {
      if (!deduped.length || Math.abs(r - deduped[deduped.length - 1]) > eps) deduped.push(r);
    });
    return deduped;
  }

  function refreshEquilibriaSelect(preferredValue) {
    const u = parseFloat(uSlider.value);
    equilibria = findEquilibria(u, state.xRange);
    eqSelect.innerHTML = '';
    equilibria.forEach((eqVal, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `x̄ = ${eqVal.toFixed(4)}`;
      eqSelect.appendChild(opt);
    });
    if (equilibria.length === 0) {
      const opt = document.createElement('option');
      opt.textContent = 'Sin equilibrios en el rango mostrado';
      eqSelect.appendChild(opt);
      selectedEq = null;
      return;
    }
    // preservar el equilibrio más parecido al anterior (para continuidad al mover u)
    let idx = 0;
    if (preferredValue != null) {
      let best = Infinity;
      equilibria.forEach((v, i) => {
        const d = Math.abs(v - preferredValue);
        if (d < best) { best = d; idx = i; }
      });
    }
    eqSelect.value = String(idx);
    selectedEq = equilibria[idx];
  }

  // Calcula los límites del eje Y muestreando f sobre TODO el rango posible de u (no solo el valor
  // actual), para que el eje quede fijo y no "tiemble" cada vez que se mueve el slider de u o se
  // cambia de equilibrio. Solo debe llamarse al cambiar de función, de preset o de rango de x.
  function computeStableYBounds() {
    if (!compiledF) return [-1, 1];
    const [xr0, xr1] = state.xRange;
    const pad = (xr1 - xr0) * 0.06;
    const uSamples = state.uRange
      ? Array.from({ length: 9 }, (_, i) => state.uRange[0] + (state.uRange[1] - state.uRange[0]) * i / 8)
      : [parseFloat(uSlider.value)];
    let ymin = Infinity, ymax = -Infinity;
    const N = 140;
    uSamples.forEach((u) => {
      for (let i = 0; i <= N; i++) {
        const x = xr0 - pad + (xr1 - xr0 + 2 * pad) * i / N;
        const y = f(x, u);
        if (isFinite(y)) { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
      }
    });
    if (!isFinite(ymin) || !isFinite(ymax)) return [-1, 1];
    const ypad = (ymax - ymin) * 0.12 || 1;
    return [ymin - ypad, ymax + ypad];
  }

  function applyPreset(name) {
    const p = PRESETS[name];
    state = Object.assign({}, p, { baseXRange: p.xRange.slice() });
    customWrap.style.display = name === 'custom' ? 'flex' : 'none';
    uWrap.style.display = p.uRange ? 'flex' : 'none';
    if (name === 'custom') state.expr = customInput.value;

    rangeScaleSlider.value = 1;
    rangeReadout.textContent = '×1.0';
    rangeValuesEl.textContent = `${p.xRange[0].toFixed(2)}, ${p.xRange[1].toFixed(2)}`;

    if (p.uRange) {
      uSlider.min = p.uRange[0]; uSlider.max = p.uRange[1]; uSlider.value = p.u;
    } else {
      uSlider.value = p.u;
    }
    compile();
    yBounds = computeStableYBounds();
    refreshEquilibriaSelect(null);
    render();
  }

  function applyRangeScale() {
    const scale = parseFloat(rangeScaleSlider.value);
    const [b0, b1] = state.baseXRange;
    const center = (b0 + b1) / 2;
    const half = (b1 - b0) / 2 * scale;
    state.xRange = [center - half, center + half];
    rangeReadout.textContent = `×${scale.toFixed(1)}`;
    rangeValuesEl.textContent = `${state.xRange[0].toFixed(2)}, ${state.xRange[1].toFixed(2)}`;
    yBounds = computeStableYBounds();
    refreshEquilibriaSelect(selectedEq);
    render();
  }

  function render() {
    const u = parseFloat(uSlider.value);
    const win = parseFloat(windowSlider.value);
    el('lin-u-readout').textContent = u.toFixed(2);
    el('lin-window-readout').textContent = win.toFixed(1);

    if (!compiledF) { compile(); }
    if (!compiledF) return;

    const [xr0, xr1] = state.xRange;
    const pad = (xr1 - xr0) * 0.06;

    // muestreo de f(x,u) para graficar — SIEMPRE, haya o no equilibrio.
    // El eje Y usa `yBounds` (fijo, calculado sobre todo el rango de u) y NO se recalcula aquí,
    // para que el marco no "tiemble" al mover u o cambiar de equilibrio.
    const N = 260;
    const curve = [];
    for (let i = 0; i <= N; i++) {
      const x = xr0 - pad + (xr1 - xr0 + 2 * pad) * i / N;
      const y = f(x, u);
      curve.push([x, y]);
    }
    plot.setBounds(xr0 - pad, xr1 + pad, yBounds[0], yBounds[1]);

    if (selectedEq == null || equilibria.length === 0) {
      const drawCurveOnly = () => {
        plot.clear();
        plot.drawAxes(state.xLabel, state.yLabel);
        plot.plotLine(curve, '#F2A93C', { width: 2.2 });
      };
      plot.redrawOn(drawCurveOnly);
      drawCurveOnly();

      el('lin-xbar-readout').textContent = '—';
      el('lin-dfdx').textContent = '—';
      el('lin-dfdu').textContent = '—';
      el('lin-fxbar').textContent = '—';
      el('lin-stability').textContent = '—';
      el('lin-error').textContent = '—';
      MathFmt.render(el('lin-equation'), `\\text{Sin punto de equilibrio en este rango: } f(x,\\bar{u}) \\neq 0`, true);
      return;
    }

    const xbar = selectedEq;
    el('lin-xbar-readout').textContent = xbar.toFixed(4);

    const slope = dfdx(xbar, u);
    const fxbar = f(xbar, u);
    const dU = dfdu(xbar, u);

    if (!isFinite(slope)) {
      const drawSingular = () => {
        plot.clear();
        plot.drawAxes(state.xLabel, state.yLabel);
        plot.plotLine(curve, '#F2A93C', { width: 2.2 });
        equilibria.forEach((eqVal) => {
          plot.plotMarker(eqVal, f(eqVal, u), Math.abs(eqVal - xbar) < 1e-9 ? '#E8607A' : '#9CA3CC',
            Math.abs(eqVal - xbar) < 1e-9 ? 'dot' : 'ring', 5.5);
        });
      };
      plot.redrawOn(drawSingular);
      drawSingular();
      el('lin-dfdx').textContent = '∂f/∂x → ∞';
      el('lin-dfdu').textContent = '—';
      el('lin-fxbar').textContent = isFinite(fxbar) ? fxbar.toFixed(4) : '—';
      el('lin-stability').textContent = 'No linealizable (derivada no acotada)';
      el('lin-error').textContent = '—';
      MathFmt.render(el('lin-equation'),
        `\\text{La derivada diverge en } \\bar{x}=${xbar.toFixed(3)} \\text{ (frontera singular del dominio).}`,
        true);
      return;
    }

    // recta tangente sobre la ventana de análisis
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

      // marcar TODOS los equilibrios detectados (anillo tenue), y resaltar el seleccionado
      equilibria.forEach((eqVal) => {
        if (Math.abs(eqVal - xbar) < 1e-9) return;
        plot.plotMarker(eqVal, f(eqVal, u), '#9CA3CC', 'ring', 5);
      });
      plot.plotMarker(xbar, fxbar, '#57D6C7', 'dot', 5.5);

      // ventana de análisis (guías verticales punteadas)
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

    // error relativo máximo de la aproximación dentro de la ventana
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

    let stabilityText = '—';
    if (isFinite(slope)) {
      if (slope < -1e-6) stabilityText = 'Estable (∂f/∂x < 0)';
      else if (slope > 1e-6) stabilityText = 'Inestable (∂f/∂x > 0)';
      else stabilityText = 'Marginal (∂f/∂x ≈ 0)';
    }
    el('lin-stability').textContent = stabilityText;

    const term2 = state.uRange && Math.abs(dU) > 1e-9
      ? ` + (${dU.toFixed(3)})\\,\\hat{u}(t)` : '';
    MathFmt.render(el('lin-equation'),
      `\\dot{\\hat{x}}(t) \\approx (${slope.toFixed(3)})\\,\\hat{x}(t)${term2}`,
      true);
  }

  presetSel.addEventListener('change', () => applyPreset(presetSel.value));
  customInput.addEventListener('input', () => {
    state.expr = customInput.value;
    if (compile()) { yBounds = computeStableYBounds(); refreshEquilibriaSelect(null); render(); }
  });
  rangeScaleSlider.addEventListener('input', applyRangeScale);
  uSlider.addEventListener('input', () => {
    refreshEquilibriaSelect(selectedEq);
    render();
  });
  windowSlider.addEventListener('input', render);
  eqSelect.addEventListener('change', () => {
    const idx = parseInt(eqSelect.value, 10);
    if (!isNaN(idx) && equilibria[idx] != null) selectedEq = equilibria[idx];
    render();
  });

  // clic sobre la curva = seleccionar el equilibrio más cercano (no cualquier punto libre)
  plot.onClick((x) => {
    if (!equilibria.length) return;
    let bestIdx = 0, bestDist = Infinity;
    equilibria.forEach((eqVal, i) => {
      const d = Math.abs(eqVal - x);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    eqSelect.value = String(bestIdx);
    selectedEq = equilibria[bestIdx];
    render();
  });

  window.addEventListener('DOMContentLoaded', () => {
    renderTaylorFormula();
    applyPreset('eq1a');
  });
  window.__linRender = render;
})();
