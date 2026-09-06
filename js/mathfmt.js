/* mathfmt.js — helper compartido para tipografía matemática con KaTeX.
   Se carga después de la librería KaTeX (CDN) y antes de linearization.js / secondorder.js / mason.js. */

window.MathFmt = (function () {

  function render(el, latex, displayMode) {
    if (!el) return;
    try {
      katex.render(latex, el, { throwOnError: false, displayMode: !!displayMode, strict: false });
    } catch (e) {
      el.textContent = latex;
    }
  }

  // Convierte tokens de texto plano típicos del editor de Mason (G1, -H1, Δ2, L3·L4)
  // a su forma LaTeX con subíndices y símbolos correctos, sin tocar identificadores libres.
  function texSym(raw) {
    if (raw == null) return '';
    let s = String(raw);
    s = s.replace(/Δ(\d+)/g, '\\Delta_{$1}');
    s = s.replace(/Δ/g, '\\Delta');
    s = s.replace(/([A-Za-z])(\d+)/g, '$1_{$2}');
    s = s.replace(/·/g, '\\cdot ');
    return s;
  }

  return { render, texSym };
})();
