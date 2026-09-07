/* secondorder.js — sección 2: forma estándar de segundo orden, respuesta al escalón y plano-s */

(function () {
  const el = (id) => document.getElementById(id);
  const kSlider = el('so-k'), zSlider = el('so-z'), wSlider = el('so-w');
  const showEnvelope = el('so-show-envelope');
  const showZetaLine = el('so-show-zeta-line');
  const showWnCircle = el('so-show-wn-circle');
  const showSigmaLine = el('so-show-sigma-line');
  const stepYScaleSlider = el('so-step-yscale');
  const pzScaleSlider = el('so-pz-scale');

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

  // Mide t_r (10-90%) directamente sobre la curva muestreada, igual a como lo hace stepinfo() en Matlab.
  function measureRiseTime10to90(tArr, yArr, yFinal) {
    const y10 = 0.1 * yFinal, y90 = 0.9 * yFinal;
    function crossTime(target) {
      for (let i = 1; i < yArr.length; i++) {
        const a = yArr[i - 1] - target, b = yArr[i] - target;
        if (a === 0) return tArr[i - 1];
        if (a * b < 0) {
          return tArr[i - 1] + (target - yArr[i - 1]) * (tArr[i] - tArr[i - 1]) / (yArr[i] - yArr[i - 1]);
        }
      }
      return null;
    }
    const t10 = crossTime(y10), t90 = crossTime(y90);
    if (t10 == null || t90 == null) return null;
    return t90 - t10;
  }

  function renderFormulaPanel(container, blocks) {
    container.innerHTML = '';
    blocks.forEach((b) => {
      const card = document.createElement('div');
      card.className = 'equation-card';
      const title = document.createElement('div');
      title.className = 'equation-title';
      title.textContent = b.title;
      card.appendChild(title);
      const mathDiv = document.createElement('div');
      mathDiv.className = 'equation';
      card.appendChild(mathDiv);
      MathFmt.render(mathDiv, b.tex, true);
      if (b.note) {
        const note = document.createElement('p');
        note.className = 'hint';
        note.style.marginTop = '8px';
        note.textContent = b.note;
        card.appendChild(note);
      }
      container.appendChild(card);
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

    const wn2 = wn * wn, twoZetaWn = 2 * zeta * wn;
    MathFmt.render(el('so-equation'),
      `T(s)=K\\dfrac{\\omega_n^2}{s^2+2\\zeta\\omega_n s+\\omega_n^2}=${K.toFixed(2)}\\dfrac{${wn2.toFixed(2)}}{s^2+${twoZetaWn.toFixed(2)}s+${wn2.toFixed(2)}}`,
      true);

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

    const stepYScale = parseFloat(stepYScaleSlider.value);
    el('so-step-yscale-readout').textContent = `×${stepYScale.toFixed(1)}`;
    const yCenter = (ymin + ymax) / 2;
    const yHalf = (ymax - ymin) / 2 * stepYScale;
    ymin = yCenter - yHalf; ymax = yCenter + yHalf;

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

    // ---- Panel de fórmulas de la respuesta transitoria ----
    const trMeasured = measureRiseTime10to90(tArr, yArr, yFinal);
    const blocks = [];

    if (zeta <= 0) {
      blocks.push({
        title: 'Caso: no amortiguado (ζ = 0)',
        tex: `p_{1,2} = \\pm j\\omega_n = \\pm j${wn.toFixed(2)}`,
        note: 'Oscilación permanente: la respuesta nunca se asienta, tp = π/ωₙ, y MP y tₛ no están definidos (footnote del capítulo).'
      });
    } else if (zeta < 1) {
      const wd = wn * Math.sqrt(1 - zeta * zeta);
      blocks.push({
        title: 'Polos complejos conjugados',
        tex: `p_{1,2} = -\\zeta\\omega_n \\pm j\\omega_n\\sqrt{1-\\zeta^2} = ${(-zeta * wn).toFixed(2)} \\pm j${wd.toFixed(2)}`
      });
    } else if (Math.abs(zeta - 1) < 1e-6) {
      blocks.push({
        title: 'Polo real doble',
        tex: `p_{1,2} = -\\omega_n = ${(-wn).toFixed(2)}\\ \\text{(raíz repetida)}`
      });
    } else {
      const s1 = zeta * wn + wn * Math.sqrt(zeta * zeta - 1);
      const s2 = zeta * wn - wn * Math.sqrt(zeta * zeta - 1);
      blocks.push({
        title: 'Polos reales distintos',
        tex: `p_{1,2} = -\\zeta\\omega_n \\pm \\omega_n\\sqrt{\\zeta^2-1} = ${(-s1).toFixed(2)},\\ ${(-s2).toFixed(2)}`
      });
    }

    blocks.push({
      title: 'Tiempo de subida tᵣ (10–90 %)',
      tex: `t_r=\\dfrac{1}{\\omega_n}\\left(2.3\\zeta^2-0.078\\zeta+1.12\\right)` +
        (zeta < 1 ? `=\\dfrac{1}{${wn.toFixed(2)}}\\left(2.3(${zeta.toFixed(2)})^2-0.078(${zeta.toFixed(2)})+1.12\\right)=${m.tr.toFixed(3)}\\text{ s}` : ''),
      note: zeta < 1
        ? `Medido directamente sobre la curva (como stepinfo de Matlab): ${trMeasured != null ? trMeasured.toFixed(3) + ' s' : '—'}.`
        : `Fórmula empírica válida solo para 0 ≤ ζ < 1. Para ζ = ${zeta.toFixed(2)}, tᵣ medido numéricamente sobre la curva: ${trMeasured != null ? trMeasured.toFixed(3) + ' s' : '—'}.`
    });

    if (zeta < 1) {
      const wd = wn * Math.sqrt(1 - zeta * zeta);
      blocks.push({
        title: 'Tiempo de pico t_p',
        tex: `t_p=\\dfrac{\\pi}{\\omega_d}=\\dfrac{\\pi}{${wd.toFixed(2)}}=${m.tp.toFixed(3)}\\text{ s}`,
        note: `ωd = ωₙ√(1−ζ²) = ${wd.toFixed(2)} rad/s.`
      });
      blocks.push({
        title: 'Máximo pico porcentual MP',
        tex: `MP=e^{-\\zeta\\pi/\\sqrt{1-\\zeta^2}}\\times100\\%=${m.mp.toFixed(2)}\\%`
      });
    } else {
      blocks.push({
        title: 'Tiempo de pico t_p y sobrepaso MP',
        tex: `t_p:\\ \\text{no definido} \\qquad MP=0\\%`,
        note: 'Sistema sin oscilación: no hay overshoot ni un primer pico que medir (nota al pie del capítulo sobre sistemas sobreamortiguados).'
      });
    }

    if (zeta > 0) {
      blocks.push({
        title: 'Tiempo de asentamiento tₛ',
        tex: `t_s\\big|_{2\\%}=\\dfrac{4}{\\zeta\\omega_n}=${m.ts2.toFixed(3)}\\text{ s}\\qquad t_s\\big|_{5\\%}=\\dfrac{3}{\\zeta\\omega_n}=${m.ts5.toFixed(3)}\\text{ s}`
      });
    } else {
      blocks.push({
        title: 'Tiempo de asentamiento tₛ',
        tex: `t_s:\\ \\text{no definido (sin amortiguamiento, la oscilación nunca decae)}`
      });
    }

    renderFormulaPanel(el('so-formula-panel'), blocks);

    // ---- Pole-zero plot ----
    const maxPoleMag = Math.max(...m.poles.map(p => Math.hypot(p.re, p.im)), wn) * 1.3 || 1;
    const pzScale = parseFloat(pzScaleSlider.value);
    el('so-pz-scale-readout').textContent = `×${pzScale.toFixed(1)}`;
    const viewMag = maxPoleMag * pzScale;
    pzPlot.setBounds(-viewMag, viewMag * 0.35, -viewMag, viewMag);

    const drawPZ = () => {
      pzPlot.clear();
      pzPlot.drawAxes('σ', 'jω');

      if (showWnCircle.checked) {
        pzPlot.plotCircleData(0, 0, wn, 'rgba(87,214,199,0.45)');
      }
      if (showZetaLine.checked && zeta > 0 && zeta < 1) {
        const beta = Math.acos(zeta);
        const L = viewMag;
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

  [kSlider, zSlider, wSlider, showEnvelope, showZetaLine, showWnCircle, showSigmaLine, stepYScaleSlider, pzScaleSlider]
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
