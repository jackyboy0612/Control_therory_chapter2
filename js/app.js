/* app.js — navegación entre secciones (canales) */

(function () {
  const buttons = document.querySelectorAll('.channel-btn');
  const panels = document.querySelectorAll('.panel');

  function activate(targetId) {
    buttons.forEach(b => {
      const isActive = b.dataset.target === targetId;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    panels.forEach(p => p.classList.toggle('active', p.id === targetId));

    // Forzar recálculo de tamaño de los canvas al hacerse visibles
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      if (targetId === 'panel-lin' && window.__linRender) window.__linRender();
      if (targetId === 'panel-2nd' && window.__soRender) window.__soRender();
    });
  }

  buttons.forEach(b => b.addEventListener('click', () => activate(b.dataset.target)));
})();
