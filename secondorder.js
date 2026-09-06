/* secondorder.js — sección 2: forma estándar de segundo orden, respuesta al escalón y plano-s */

(function () {
  const el = (id) => document.getElementById(id);
  const kSlider = el('so-k'), zSlider = el('so-z'), wSlider = el('so-w');
  const showEnvelope = el('so-show-envelope');
  const showZetaLine = el('so-show-zeta-line');
  const showWnCircle = el('so-show-wn-circle');
  const showSigmaLine = el('so-show-sigma-line');

  const stepPlot = new CartesianPlot(el('so-step-canvas'));
  const pzPlot = new CartesianPlot(el('so-pz-canvas'));

  function stepResponse(K, zeta, wn, tArr) {
    return tArr.map((t) => {
      let y;
      if (zeta <= 0) {
        y = 1 - Math.cos(wn * t); // zeta = 0: no amortiguado
      } else if (zeta < 1) {
        const wd = wn * Math.sqrt(1 - zeta * zeta);
        y = 1 - (1 / Math.sqrt(1 - zeta * zeta)) * Math.exp(-zeta * wn * t) *
          Math.sin(wd * t + Math.atan2(Math.sqrt(1 - zeta * zeta), zeta));
      } else if (Math.abs(zeta - 1) < 1e-6) {
        y = 1 - Math.exp(-wn * t) * (1 + wn * t);
      } else {
        const s1 = zeta * wn + wn * Math.sqrt(zeta * zeta - 1);
        const s2 = zeta * wn - wn * Math.sqrt(zeta * zeta - 1);
        y = 1 + (wn / (2 * Math.sqrt(zeta * zeta - 1))) * (Math.exp(-s1 * t) / s1 - Math.exp(-s2 * t) / s2);
      }
      return K * y;
    });
  }

  function metrics(K, zeta, wn) {
    const out = { case: '', tr: null, tp: null, mp: null, ts2: null, ts5: null, poles: [], dc: K };
    if (zeta <= 0) {
      out.case = 'No amortiguado (ζ = 0)';
      out.poles = [{ re: 0, im: wn }, { re: 0, im: -wn }];
      out.tp = Math.PI / wn;
    } else if (zeta < 1) {
      out.case = 'Subamortiguado (0 < ζ < 1)';
      const wd = wn * Math.sqrt(1 - zeta * zeta);
      out.poles = [{ re: -zeta * wn, im: wd }, { re: -zeta * wn, im: -wd }];
      out.tr = (1 / wn) * (2.3 * zeta * zeta - 0.078 * zeta + 1.12);
      out.tp = Math.PI / wd;
      out.mp = Math.exp(-zeta * Math.PI / Math.sqrt(1 - zeta * zeta)) * 100;
      out.ts2 = 4 / (zeta * wn);
      out.ts5 = 3 / (zeta * wn);
    } else if (Math.abs(zeta - 1) < 1e-6) {
      out.case = 'Críticamente amortiguado (ζ = 1)';
      out.poles = [{ re: -wn, im: 0 }, { re: -wn, im: 0 }];
      out.ts2 = 4 / wn; out.ts5 = 3 / wn;
    } else {
      out.case = 'Sobreamortiguado (ζ > 1)';
      const s1 = zeta * wn + wn * Math.sqrt(zeta * zeta - 1);
      const s2 = zeta * wn - wn * Math.sqrt(zeta * zeta - 1);
      out.poles = [{ re: -s1, im: 0 }, { re: -s2, im: 0 }];
      out.ts2 = 4 / (zeta * wn); out.ts5 = 3 / (zeta * wn);
    }
    return out;
  }

  function render() {
    const K = parseFloat(kSlider.value);
    const zeta = parseFloat(zSlider.value);
    const wn = parseFloat(wSlider.value);
    el('so-k-readout').textContent = K.toFixed(2);
    el('so-z-readout').textContent = zeta.toFixed(2);
    el('so-w-readout').textContent = wn.toFixed(2);

    el('so-equation').textContent =
      `T(s) = ${K.toFixed(2)}·${(wn * wn).toFixed(2)} / (s² + ${(2 * zeta * wn).toFixed(2)}s + ${(wn * wn).toFixed(2)})`;

    const m = metrics(K, zeta, wn);
    el('so-case').textContent = m.case;
    el('so-poles').textContent = m.poles.map(p =>
      `${p.re.toFixed(2)} ${p.im >= 0 ? '+' : '−'} j${Math.abs(p.im).toFixed(2)}`).join('  ,  ');
    el('so-tr').textContent = m.tr != null ? m.tr.toFixed(3) + ' s' : 'no definido';
    el('so-tp').textContent = m.tp != null ? m.tp.toFixed(3) + ' s' : 'no definido (sin oscilación)';
    el('so-mp').textContent = m.mp != null ? m.mp.toFixed(2) + ' %' : '0 %';
    el('so-ts').textContent = (m.ts2 != null) ? `${m.ts2.toFixed(3)} s / ${m.ts5.toFixed(3)} s` : '—';
    el('so-dc').textContent = m.dc.toFixed(3);

    // ---- Step response plot ----
    const tMax = (m.ts2 != null) ? Math.max(m.ts2 * 1.8, (m.tp || 0) * 2.2, 1) : (10 / wn + 1);
    const N = 400;
    const tArr = Array.from({ length: N + 1 }, (_, i) => tMax * i / N);
    const yArr = stepResponse(K, zeta, wn, tArr);
    const curve = tArr.map((t, i) => [t, yArr[i]]);
    const yFinal = K;
    let ymax = Math.max(...yArr.filter(isFinite), yFinal) * 1.15;
    let ymin = Math.min(0, Math.min(...yArr.filter(isFinite)) * 1.1);

    stepPlot.setBounds(0, tMax, ymin, ymax);

    const envelope = [];
    if (zeta > 0 && zeta < 1) {
      for (let i = 0; i <= N; i++) {
        const t = tArr[i];
        const e = Math.exp(-zeta * wn * t) / Math.sqrt(1 - zeta * zeta);
        envelope.push([t, K * (1 + e), K * (1 - e)]);
      }
    }

    const drawStep = () => {
      stepPlot.clear();
      stepPlot.drawAxes('t (s)', 'y(t)');
      // DC gain reference line
      const ctx = stepPlot.ctx;
      const [, pyDC] = stepPlot.toPx(0, yFinal);
      ctx.save();
      ctx.strokeStyle = 'rgba(156,163,204,0.5)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(stepPlot.padding.left, pyDC); ctx.lineTo(stepPlot.w - stepPlot.padding.right, pyDC);
      ctx.stroke(); ctx.restore();

      if (showEnvelope.checked && envelope.length) {
        stepPlot.plotLine(envelope.map(([t, hi]) => [t, hi]), 'rgba(87,214,199,0.6)', { width: 1.2, dash: [4, 3] });
        stepPlot.plotLine(envelope.map(([t, , lo]) => [t, lo]), 'rgba(87,214,199,0.6)', { width: 1.2, dash: [4, 3] });
      }
      stepPlot.plotLine(curve, '#F2A93C', { width: 2.3 });

      if (m.tp != null && m.tp <= tMax) {
        const yAtTp = stepResponse(K, zeta, wn, [m.tp])[0];
        stepPlot.plotMarker(m.tp, yAtTp, '#E8607A', 'dot', 4);
      }
    };
    stepPlot.redrawOn(drawStep);
    drawStep();

    // ---- Pole-zero plot ----
    const maxPoleMag = Math.max(...m.poles.map(p => Math.hypot(p.re, p.im)), wn) * 1.3 || 1;
    pzPlot.setBounds(-maxPoleMag, maxPoleMag * 0.35, -maxPoleMag, maxPoleMag);

    const drawPZ = () => {
      pzPlot.clear();
      pzPlot.drawAxes('σ', 'jω');

      if (showWnCircle.checked) {
        pzPlot.plotCircleData(0, 0, wn, 'rgba(87,214,199,0.45)');
      }
      if (showZetaLine.checked && zeta > 0 && zeta < 1) {
        const beta = Math.acos(zeta);
        const L = maxPoleMag;
        pzPlot.plotLine([[0, 0], [-L * Math.cos(beta), L * Math.sin(beta)]], 'rgba(242,169,60,0.5)', { width: 1.2, dash: [5, 3] });
        pzPlot.plotLine([[0, 0], [-L * Math.cos(beta), -L * Math.sin(beta)]], 'rgba(242,169,60,0.5)', { width: 1.2, dash: [5, 3] });
      }
      if (showSigmaLine.checked && m.poles[0]) {
        const sigma = m.poles[0].re;
        const [px] = pzPlot.toPx(sigma, 0);
        const ctx = pzPlot.ctx;
        ctx.save();
        ctx.strokeStyle = 'rgba(232,96,122,0.5)';
        ctx.setLineDash([5, 3]);
        ctx.beginPath(); ctx.moveTo(px, pzPlot.padding.top); ctx.lineTo(px, pzPlot.h - pzPlot.padding.bottom);
        ctx.stroke(); ctx.restore();
      }

      m.poles.forEach(p => pzPlot.plotMarker(p.re, p.im, '#F2A93C', 'x', 7));
    };
    pzPlot.redrawOn(drawPZ);
    drawPZ();
  }

  [kSlider, zSlider, wSlider, showEnvelope, showZetaLine, showWnCircle, showSigmaLine]
    .forEach(inp => inp.addEventListener('input', render));

  document.querySelectorAll('.chip-btn[data-k]').forEach(btn => {
    btn.addEventListener('click', () => {
      kSlider.value = btn.dataset.k;
      zSlider.value = btn.dataset.z;
      wSlider.value = btn.dataset.w;
      render();
    });
  });

  window.addEventListener('DOMContentLoaded', render);
  window.__soRender = render;
})();
