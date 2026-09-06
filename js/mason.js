/* mason.js — sección 3: editor de diagrama de flujo de señal + fórmula de ganancia de Mason */

(function () {
  const svg = document.getElementById('mason-svg');
  const NS = 'http://www.w3.org/2000/svg';

  let nodes = [];   // {id, x, y}
  let edges = [];   // {id, from, to, gain}
  let nodeCounter = 0;
  let edgeCounter = 0;
  let source = null, sink = null;
  let addNodeMode = false;
  let dragging = null;

  const el = (id) => document.getElementById(id);
  const fromSel = el('mason-edge-from');
  const toSel = el('mason-edge-to');
  const gainInput = el('mason-edge-gain');
  const sourceSel = el('mason-source');
  const sinkSel = el('mason-sink');
  const addNodeBtn = el('mason-add-node-mode');
  const addEdgeBtn = el('mason-add-edge');
  const computeBtn = el('mason-compute');
  const edgeListEl = el('mason-edge-list');
  const nodeListEl = el('mason-node-list');
  const resultsEl = el('mason-results');

  function newNodeId() { nodeCounter += 1; return 'N' + nodeCounter; }
  function newEdgeId() { edgeCounter += 1; return 'e' + edgeCounter; }

  function resetAll(withNodes = [], withEdges = [], src = null, snk = null) {
    nodes = withNodes; edges = withEdges; source = src; sink = snk;
    nodeCounter = nodes.length ? Math.max(...nodes.map(n => parseInt(n.id.slice(1)))) : 0;
    edgeCounter = edges.length;
    refreshSelects();
    renderSVG();
    renderLists();
    resultsEl.innerHTML = '<p class="hint">Presiona <span class="mono">Calcular</span> para aplicar la ley de Mason.</p>';
  }

  function addNodeAt(x, y) {
    const id = newNodeId();
    nodes.push({ id, x, y });
    refreshSelects();
    renderSVG();
    renderLists();
  }

  function removeNode(id) {
    nodes = nodes.filter(n => n.id !== id);
    edges = edges.filter(e => e.from !== id && e.to !== id);
    if (source === id) source = null;
    if (sink === id) sink = null;
    refreshSelects();
    renderSVG();
    renderLists();
  }

  function addEdge(from, to, gain) {
    if (!from || !to || from === to) return;
    edges.push({ id: newEdgeId(), from, to, gain: gain || 'G' });
    renderSVG();
    renderLists();
  }

  function removeEdge(id) {
    edges = edges.filter(e => e.id !== id);
    renderSVG();
    renderLists();
  }

  function refreshSelects() {
    [fromSel, toSel, sourceSel, sinkSel].forEach(sel => {
      const prev = sel.value;
      sel.innerHTML = '';
      nodes.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n.id; opt.textContent = n.id;
        sel.appendChild(opt);
      });
      if (nodes.find(n => n.id === prev)) sel.value = prev;
    });
    if (source && nodes.find(n => n.id === source)) sourceSel.value = source; else if (nodes[0]) source = nodes[0].id;
    if (sink && nodes.find(n => n.id === sink)) sinkSel.value = sink; else if (nodes.length) sink = nodes[nodes.length - 1].id;
    if (source) sourceSel.value = source;
    if (sink) sinkSel.value = sink;
  }

  function renderLists() {
    edgeListEl.innerHTML = '';
    edges.forEach(e => {
      const div = document.createElement('div');
      div.className = 'mini-list-item';
      div.innerHTML = `<span>${e.from} → ${e.to} &nbsp; (<span style="color:#F2A93C">${e.gain}</span>)</span>`;
      const btn = document.createElement('button');
      btn.textContent = '✕';
      btn.title = 'Eliminar rama';
      btn.addEventListener('click', () => removeEdge(e.id));
      div.appendChild(btn);
      edgeListEl.appendChild(div);
    });
    nodeListEl.innerHTML = '';
    nodes.forEach(n => {
      const div = document.createElement('div');
      div.className = 'mini-list-item';
      div.innerHTML = `<span>${n.id}</span>`;
      const btn = document.createElement('button');
      btn.textContent = '✕';
      btn.title = 'Eliminar nodo';
      btn.addEventListener('click', () => removeNode(n.id));
      div.appendChild(btn);
      nodeListEl.appendChild(div);
    });
  }

  /* ---------------- SVG rendering ---------------- */

  function svgEl(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  }

  function edgeGroups() {
    // group edges sharing the same unordered node pair, to offset curves
    const groups = {};
    edges.forEach(e => {
      const key = [e.from, e.to].sort().join('|');
      groups[key] = groups[key] || [];
      groups[key].push(e);
    });
    return groups;
  }

  function renderSVG() {
    svg.innerHTML = '';
    // arrow marker
    const defs = svgEl('defs', {});
    const marker = svgEl('marker', {
      id: 'arrow', viewBox: '0 0 10 10', refX: '9', refY: '5',
      markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse'
    });
    marker.appendChild(svgEl('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#F2A93C' }));
    defs.appendChild(marker);
    svg.appendChild(defs);

    const groups = edgeGroups();
    Object.values(groups).forEach(group => {
      const n = group.length;
      group.forEach((e, i) => {
        const offset = n === 1 ? 0 : (i - (n - 1) / 2) * 34;
        drawEdge(e, offset);
      });
    });

    nodes.forEach(n => drawNode(n));
  }

  function drawEdge(e, offset) {
    const a = nodes.find(n => n.id === e.from);
    const b = nodes.find(n => n.id === e.to);
    if (!a || !b) return;
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    const nx = -uy, ny = ux; // normal
    const R = 22; // node radius
    const sx = a.x + ux * R, sy = a.y + uy * R;
    const ex = b.x - ux * R, ey = b.y - uy * R;
    const mx = (sx + ex) / 2 + nx * offset;
    const my = (sy + ey) / 2 + ny * offset;

    const path = svgEl('path', {
      d: `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`,
      fill: 'none',
      stroke: '#F2A93C',
      'stroke-width': '2',
      'marker-end': 'url(#arrow)'
    });
    svg.appendChild(path);

    const labelPos = offset === 0
      ? { x: (sx + ex) / 2, y: (sy + ey) / 2 - 8 }
      : { x: mx, y: my - Math.sign(offset || 1) * 2 };

    const labelBg = svgEl('rect', {
      x: labelPos.x - (e.gain.length * 3.6) - 4, y: labelPos.y - 11,
      width: e.gain.length * 7.2 + 8, height: 16, rx: 2,
      fill: '#10142E', stroke: '#2C3468'
    });
    svg.appendChild(labelBg);
    const label = svgEl('text', {
      x: labelPos.x, y: labelPos.y, 'text-anchor': 'middle',
      fill: '#57D6C7', 'font-family': 'IBM Plex Mono, monospace', 'font-size': '12'
    });
    label.textContent = e.gain;
    svg.appendChild(label);
  }

  function drawNode(n) {
    const isSource = n.id === source, isSink = n.id === sink;
    const g = svgEl('g', { cursor: 'grab' });
    const circle = svgEl('circle', {
      cx: n.x, cy: n.y, r: 20,
      fill: isSource ? 'rgba(87,214,199,0.18)' : isSink ? 'rgba(232,96,122,0.18)' : '#1F2650',
      stroke: isSource ? '#57D6C7' : isSink ? '#E8607A' : '#F2A93C',
      'stroke-width': '2'
    });
    g.appendChild(circle);
    const label = svgEl('text', {
      x: n.x, y: n.y + 4, 'text-anchor': 'middle',
      fill: '#ECEBF2', 'font-family': 'IBM Plex Mono, monospace', 'font-size': '12', 'font-weight': '600'
    });
    label.textContent = n.id;
    g.appendChild(label);

    g.addEventListener('pointerdown', (ev) => {
      dragging = n;
      ev.stopPropagation();
    });
    svg.appendChild(g);
  }

  svg.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const scaleX = vb.width / rect.width, scaleY = vb.height / rect.height;
    dragging.x = (ev.clientX - rect.left) * scaleX;
    dragging.y = (ev.clientY - rect.top) * scaleY;
    renderSVG();
  });
  window.addEventListener('pointerup', () => { dragging = null; });

  svg.addEventListener('click', (ev) => {
    if (!addNodeMode) return;
    if (ev.target !== svg) return; // ignore clicks that landed on a node/edge
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const scaleX = vb.width / rect.width, scaleY = vb.height / rect.height;
    const x = (ev.clientX - rect.left) * scaleX;
    const y = (ev.clientY - rect.top) * scaleY;
    addNodeAt(x, y);
  });

  addNodeBtn.addEventListener('click', () => {
    addNodeMode = !addNodeMode;
    addNodeBtn.classList.toggle('active-mode', addNodeMode);
    addNodeBtn.textContent = addNodeMode ? 'Modo activo: clic en el lienzo' : 'Haz clic en el lienzo →';
  });

  addEdgeBtn.addEventListener('click', () => {
    addEdge(fromSel.value, toSel.value, gainInput.value.trim() || 'G');
  });

  sourceSel.addEventListener('change', () => { source = sourceSel.value; renderSVG(); });
  sinkSel.addEventListener('change', () => { sink = sinkSel.value; renderSVG(); });

  /* ---------------- Mason's gain formula algorithm ---------------- */

  function fmtGain(g) {
    return g.trim().startsWith('-') ? `(${g.trim()})` : g.trim();
  }
  function joinGains(arr) {
    return arr.map(fmtGain).join('·');
  }

  function findAllPaths(src, snk) {
    const results = [];
    function dfs(node, visited, pathNodes, gains) {
      if (node === snk && pathNodes.length > 1) {
        results.push({ nodes: [...pathNodes], gain: joinGains(gains), nodeSet: new Set(pathNodes) });
        return;
      }
      edges.filter(e => e.from === node).forEach(e => {
        if (!visited.has(e.to)) {
          visited.add(e.to);
          pathNodes.push(e.to);
          gains.push(e.gain);
          dfs(e.to, visited, pathNodes, gains);
          gains.pop();
          pathNodes.pop();
          visited.delete(e.to);
        }
      });
    }
    dfs(src, new Set([src]), [src], []);
    return results;
  }

  function findAllLoops() {
    const order = {};
    nodes.forEach((n, i) => { order[n.id] = i; });
    const results = [];
    const seen = new Set();

    nodes.forEach(startNode => {
      const start = startNode.id;
      function dfs(current, visited, pathNodes, gains) {
        edges.filter(e => e.from === current).forEach(e => {
          if (e.to === start && pathNodes.length >= 1) {
            const cycleNodes = [...pathNodes];
            const key = [...cycleNodes].sort().join(',') + '|' + joinGains(gains.concat(e.gain));
            if (!seen.has(key)) {
              seen.add(key);
              results.push({
                nodes: cycleNodes,
                gain: joinGains(gains.concat(e.gain)),
                nodeSet: new Set(cycleNodes)
              });
            }
          } else if (order[e.to] > order[start] && !visited.has(e.to)) {
            visited.add(e.to);
            pathNodes.push(e.to);
            gains.push(e.gain);
            dfs(e.to, visited, pathNodes, gains);
            gains.pop();
            pathNodes.pop();
            visited.delete(e.to);
          }
        });
      }
      dfs(start, new Set([start]), [start], []);
    });
    return results;
  }

  function disjoint(setA, setB) {
    for (const x of setA) if (setB.has(x)) return false;
    return true;
  }

  function nonTouchingCombos(loopList) {
    // returns { 2: [[idx,idx],...], 3: [...], ... } (indices into loopList), sizes >= 2
    const bySize = {};
    function backtrack(startIdx, combo) {
      if (combo.length >= 2) {
        bySize[combo.length] = bySize[combo.length] || [];
        bySize[combo.length].push([...combo]);
      }
      for (let i = startIdx; i < loopList.length; i++) {
        const candidate = loopList[i];
        const ok = combo.every(idx => disjoint(loopList[idx].nodeSet, candidate.nodeSet));
        if (ok) {
          combo.push(i);
          backtrack(i + 1, combo);
          combo.pop();
        }
      }
    }
    backtrack(0, []);
    return bySize;
  }

  function buildDelta(loopList, labels) {
    // loopList: array of loop objects (subset relevant); labels: array of same length with 'Lk' names
    if (loopList.length === 0) return { text: '1', terms: [] };
    const combosBySize = nonTouchingCombos(loopList);
    const groupTerms = [];
    // size 1
    groupTerms.push({ size: 1, items: loopList.map((_, i) => [i]) });
    Object.keys(combosBySize).sort((a, b) => a - b).forEach(sizeStr => {
      groupTerms.push({ size: parseInt(sizeStr), items: combosBySize[sizeStr] });
    });

    let text = '1';
    groupTerms.forEach(group => {
      const sign = (group.size % 2 === 1) ? '−' : '+';
      const productStrings = group.items.map(idxArr => idxArr.map(i => labels[i]).join('·'));
      text += ` ${sign} (${productStrings.join(' + ')})`;
    });
    return { text, groupTerms };
  }

  function computeMason() {
    if (!source || !sink) {
      resultsEl.innerHTML = '<p class="hint">Define un nodo de entrada y uno de salida.</p>';
      return;
    }
    const paths = findAllPaths(source, sink);
    const loops = findAllLoops();
    const loopLabels = loops.map((_, i) => 'L' + (i + 1));
    const pathLabels = paths.map((_, i) => 'P' + (i + 1));

    let html = '';

    html += `<div class="result-block"><h3>Trayectos directos (${paths.length})</h3>`;
    if (paths.length === 0) {
      html += `<div class="result-line">No existe un trayecto directo entre ${source} y ${sink}.</div>`;
    }
    paths.forEach((p, i) => {
      html += `<div class="result-line"><span class="tag">${pathLabels[i]}</span>${p.nodes.join(' → ')} &nbsp; ganancia = ${p.gain}</div>`;
    });
    html += `</div>`;

    html += `<div class="result-block"><h3>Lazos individuales (${loops.length})</h3>`;
    loops.forEach((l, i) => {
      html += `<div class="result-line"><span class="tag">${loopLabels[i]}</span>${l.nodes.join(' → ')} → ${l.nodes[0]} &nbsp; ganancia = ${l.gain}</div>`;
    });
    if (loops.length === 0) html += `<div class="result-line">Este diagrama no tiene lazos.</div>`;
    html += `</div>`;

    const combosBySize = nonTouchingCombos(loops);
    html += `<div class="result-block"><h3>Lazos disjuntos (no se tocan)</h3>`;
    if (Object.keys(combosBySize).length === 0) {
      html += `<div class="result-line">No hay combinaciones de lazos disjuntos.</div>`;
    }
    Object.keys(combosBySize).sort((a, b) => a - b).forEach(sizeStr => {
      const nameBySize = { 2: 'pares', 3: 'tríos', 4: 'cuartetos' };
      const label = nameBySize[sizeStr] || (sizeStr + '-tuplas');
      const items = combosBySize[sizeStr].map(idxArr => idxArr.map(i => loopLabels[i]).join('·'));
      html += `<div class="result-line"><span class="tag">${label}</span>${items.join(',  ')}</div>`;
    });
    html += `</div>`;

    const delta = buildDelta(loops, loopLabels);
    html += `<div class="result-block"><h3>Determinante Δ</h3><div class="result-line">Δ = ${delta.text}</div></div>`;

    html += `<div class="result-block"><h3>Cofactores Δₖ</h3>`;
    const pathDeltas = paths.map((p, i) => {
      const filteredIdx = loops.map((l, li) => li).filter(li => disjoint(loops[li].nodeSet, p.nodeSet));
      const filteredLoops = filteredIdx.map(li => loops[li]);
      const filteredLabels = filteredIdx.map(li => loopLabels[li]);
      const d = buildDelta(filteredLoops, filteredLabels);
      html += `<div class="result-line"><span class="tag">Δ${i + 1}</span>= ${d.text}</div>`;
      return d.text;
    });
    html += `</div>`;

    if (paths.length > 0) {
      const numerator = paths.map((p, i) => `${pathLabels[i]}·Δ${i + 1}`).join(' + ');
      html += `<div class="result-block"><h3>Función de transferencia</h3>
        <div class="final-tf">T(s) = (${numerator}) / Δ</div>
        <p class="hint" style="margin-top:8px">
          donde ${pathLabels.map((pl, i) => `${pl} = ${paths[i].gain}`).join(',  ')}
          ${loopLabels.length ? ' y ' + loopLabels.map((ll, i) => `${ll} = ${loops[i].gain}`).join(',  ') : ''}.
        </p>
      </div>`;
    }

    resultsEl.innerHTML = html;
  }

  computeBtn.addEventListener('click', computeMason);

  /* ---------------- Presets ---------------- */

  function presetFig320() {
    // Reproduce exactamente la Figura 3.20 del capítulo: R=N1 ... Y=N7, rama G7-G8-G9 por N8-N9.
    const withNodes = [
      { id: 'N1', x: 70, y: 230 },   // R (fuente)
      { id: 'N2', x: 190, y: 230 },
      { id: 'N3', x: 310, y: 230 },
      { id: 'N4', x: 430, y: 230 },
      { id: 'N5', x: 550, y: 230 },
      { id: 'N6', x: 670, y: 230 },
      { id: 'N7', x: 800, y: 230 },  // Y (sumidero)
      { id: 'N8', x: 310, y: 370 },
      { id: 'N9', x: 430, y: 370 },
    ];
    const withEdges = [
      { id: 'e1', from: 'N1', to: 'N2', gain: 'G1' },
      { id: 'e2', from: 'N2', to: 'N3', gain: 'G2' },
      { id: 'e3', from: 'N3', to: 'N2', gain: '-H1' },
      { id: 'e4', from: 'N3', to: 'N4', gain: 'G3' },
      { id: 'e5', from: 'N4', to: 'N5', gain: 'G4' },
      { id: 'e6', from: 'N5', to: 'N4', gain: '-H2' },
      { id: 'e7', from: 'N5', to: 'N2', gain: '-H4' },
      { id: 'e8', from: 'N5', to: 'N6', gain: 'G5' },
      { id: 'e9', from: 'N6', to: 'N7', gain: 'G6' },
      { id: 'e10', from: 'N3', to: 'N8', gain: 'G7' },
      { id: 'e11', from: 'N8', to: 'N9', gain: 'G8' },
      { id: 'e12', from: 'N9', to: 'N8', gain: '-H3' },
      { id: 'e13', from: 'N9', to: 'N7', gain: 'G9' },
    ];
    resetAll(withNodes, withEdges, 'N1', 'N7');
  }

  function presetFeedback() {
    const withNodes = [
      { id: 'N1', x: 140, y: 230 },
      { id: 'N2', x: 420, y: 230 },
      { id: 'N3', x: 700, y: 230 },
    ];
    const withEdges = [
      { id: 'e1', from: 'N1', to: 'N2', gain: '1' },
      { id: 'e2', from: 'N2', to: 'N3', gain: 'G' },
      { id: 'e3', from: 'N3', to: 'N2', gain: '-H' },
    ];
    resetAll(withNodes, withEdges, 'N1', 'N3');
  }

  el('mason-preset-fig320').addEventListener('click', presetFig320);
  el('mason-preset-feedback').addEventListener('click', presetFeedback);
  el('mason-preset-clear').addEventListener('click', () => resetAll([], [], null, null));

  window.addEventListener('DOMContentLoaded', presetFeedback);
})();
