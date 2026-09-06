/* mason.js — sección 3: se construye el DIAGRAMA DE BLOQUES (bloques con ganancia + señales)
   y el programa arma automáticamente el diagrama de flujo de señal equivalente para aplicar
   la fórmula de Mason. Ambas vistas comparten los mismos nodos (señales) y ramas (bloques):
   solo cambia cómo se dibujan. */

(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (id) => document.getElementById(id);

  const blockSvg = el('mason-block-svg');
  const nodeSvg = el('mason-node-svg');

  let nodes = [];   // {id, x, y}  — cada "id" es el nombre de la señal (R, E, Y, ...)
  let edges = [];   // {id, from, to, gain, bend: {x,y}|null}
  let edgeCounter = 0;
  let source = null, sink = null;
  let draggingNode = null;
  let draggingBendEdge = null;

  const fromInput = el('mason-block-from');
  const toInput = el('mason-block-to');
  const gainInput = el('mason-block-gain');
  const addBtn = el('mason-add-block');
  const sourceSel = el('mason-source');
  const sinkSel = el('mason-sink');
  const computeBtn = el('mason-compute');
  const edgeListEl = el('mason-edge-list');
  const nodeListEl = el('mason-node-list');
  const resultsEl = el('mason-results');

  function newEdgeId() { edgeCounter += 1; return 'e' + edgeCounter; }
  function findNode(id) { return nodes.find(n => n.id === id); }

  function positionNear(n, relativeTo) {
    let x = 90, y = 230;
    if (relativeTo) { x = relativeTo.x + 190; y = relativeTo.y; }
    let tries = 0;
    while (nodes.some(p => Math.hypot(p.x - x, p.y - y) < 95) && tries < 30) {
      y += 110;
      if (y > 420) { y = 90; x += 100; }
      tries++;
    }
    n.x = Math.min(Math.max(x, 60), 840);
    n.y = Math.min(Math.max(y, 60), 420);
  }

  function ensureNode(id, relativeTo) {
    let n = findNode(id);
    if (!n) {
      n = { id, x: 90, y: 230 };
      positionNear(n, relativeTo);
      nodes.push(n);
    }
    return n;
  }

  function resetAll(withNodes = [], withEdges = [], src = null, snk = null) {
    nodes = withNodes; edges = withEdges; source = src; sink = snk;
    edgeCounter = edges.length;
    refreshIOSelectors();
    renderAll();
    resultsEl.innerHTML = '<p class="hint">Presiona <span class="mono">Calcular</span> para aplicar la ley de Mason.</p>';
  }

  function removeNode(id) {
    nodes = nodes.filter(n => n.id !== id);
    edges = edges.filter(e => e.from !== id && e.to !== id);
    if (source === id) source = null;
    if (sink === id) sink = null;
    refreshIOSelectors();
    renderAll();
  }

  function removeEdge(id) {
    edges = edges.filter(e => e.id !== id);
    renderAll();
  }

  function refreshIOSelectors() {
    [sourceSel, sinkSel].forEach(sel => {
      const prev = sel.value;
      sel.innerHTML = '';
      nodes.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n.id; opt.textContent = n.id;
        sel.appendChild(opt);
      });
      if (nodes.find(n => n.id === prev)) sel.value = prev;
    });
    if (source && findNode(source)) sourceSel.value = source; else if (nodes[0]) source = nodes[0].id;
    if (sink && findNode(sink)) sinkSel.value = sink; else if (nodes.length) sink = nodes[nodes.length - 1].id;
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
      btn.title = 'Eliminar bloque';
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
      btn.title = 'Eliminar señal';
      btn.addEventListener('click', () => removeNode(n.id));
      div.appendChild(btn);
      nodeListEl.appendChild(div);
    });
  }

  /* ---------------- geometría compartida de ramas (curvas) ---------------- */

  function edgeGroups() {
    const groups = {};
    edges.forEach(e => {
      const key = [e.from, e.to].sort().join('|');
      groups[key] = groups[key] || [];
      groups[key].push(e);
    });
    return groups;
  }

  // Offset del punto de control de la curva cuadrática para "edge", en coordenadas absolutas
  // relativas al punto medio del segmento. Contempla: (a) pares de ramas en direcciones opuestas
  // (se separan a lados distintos, nunca se solapan) y (b) ramas largas que pasarían por encima
  // de otros nodos (se curvan automáticamente para esquivarlos, como el Ejemplo 3.2 / Fig. 3.20).
  function autoOffsetFor(edge, nodeA, nodeB, idA, idB, group) {
    if (group.length > 1) {
      // dirección CANÓNICA compartida por todo el par (idA -> idB), igual para ambas ramas,
      // así una nunca queda calculada con la dirección "propia" invertida de la otra.
      const canonA = findNode(idA), canonB = findNode(idB);
      const cdx = canonB.x - canonA.x, cdy = canonB.y - canonA.y;
      const cdist = Math.hypot(cdx, cdy) || 1;
      const cux = cdx / cdist, cuy = cdy / cdist;
      const cnx = -cuy, cny = cux;
      const forward = group.filter(e => e.from === idA && e.to === idB);
      const backward = group.filter(e => e.from === idB && e.to === idA);
      const BASE = 36;
      if (forward.includes(edge)) {
        const i = forward.indexOf(edge);
        const mag = BASE * (i + 1);
        return { x: cnx * mag, y: cny * mag };
      } else {
        const i = backward.indexOf(edge);
        const mag = BASE * (i + 1);
        return { x: -cnx * mag, y: -cny * mag };
      }
    }

    // rama sola: usa su propia dirección (from->to) solo para el chequeo de esquive de nodos.
    const dx = nodeB.x - nodeA.x, dy = nodeB.y - nodeA.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    const nx = -uy, ny = ux;
    let maxIntrusion = 0;
    nodes.forEach(n => {
      if (n === nodeA || n === nodeB) return;
      const t = (n.x - nodeA.x) * ux + (n.y - nodeA.y) * uy;
      if (t <= 28 || t >= dist - 28) return;
      const px = nodeA.x + ux * t, py = nodeA.y + uy * t;
      const perp = Math.hypot(n.x - px, n.y - py);
      const clearance = 56;
      if (perp < clearance) maxIntrusion = Math.max(maxIntrusion, clearance - perp + 30);
    });
    if (maxIntrusion > 0) return { x: -nx * maxIntrusion, y: -ny * maxIntrusion };
    return { x: 0, y: 0 };
  }

  function isSummingNode(nodeId) {
    return edges.filter(e => e.to === nodeId).length >= 2;
  }

  /* ---------------- vista 1: DIAGRAMA DE BLOQUES (editable) ---------------- */

  function svgEl(svg, tag, attrs, text) {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (text != null) e.textContent = text;
    svg.appendChild(e);
    return e;
  }

  function addArrowDefs(svg, id, color) {
    const defs = document.createElementNS(NS, 'defs');
    const marker = document.createElementNS(NS, 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9'); marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '7'); marker.setAttribute('markerHeight', '7');
    marker.setAttribute('orient', 'auto-start-reverse');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M0,0 L10,5 L0,10 z');
    path.setAttribute('fill', color);
    marker.appendChild(path);
    defs.appendChild(marker);
    svg.appendChild(defs);
  }

  function renderBlockDiagram() {
    blockSvg.innerHTML = '';
    addArrowDefs(blockSvg, 'blk-arrow', '#F2A93C');

    const groups = edgeGroups();
    edges.forEach(edge => {
      const nodeA = findNode(edge.from), nodeB = findNode(edge.to);
      if (!nodeA || !nodeB) return;
      const [idA, idB] = [edge.from, edge.to].sort();
      const group = groups[[idA, idB].join('|')];
      const offset = edge.bend || autoOffsetFor(edge, nodeA, nodeB, idA, idB, group);
      drawBlockEdge(edge, nodeA, nodeB, offset);
    });

    nodes.forEach(n => drawBlockNode(n));
  }

  function drawBlockEdge(edge, a, b, offset) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    const R = 20;
    const sx = a.x + ux * R, sy = a.y + uy * R;
    const ex = b.x - ux * R, ey = b.y - uy * R;
    const midX = (sx + ex) / 2, midY = (sy + ey) / 2;
    const mx = midX + offset.x, my = midY + offset.y;

    svgEl(blockSvg, 'path', {
      d: `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`,
      fill: 'none', stroke: '#F2A93C', 'stroke-width': '2',
      'marker-end': 'url(#blk-arrow)'
    });

    const summing = isSummingNode(edge.to);
    const isNeg = edge.gain.trim().startsWith('-');
    const boxLabel = summing && isNeg ? edge.gain.trim().slice(1).trim() : edge.gain;

    // caja del bloque (función de transferencia), centrada en el punto de control de la curva
    const w = Math.max(46, boxLabel.length * 11 + 20), h = 30;
    svgEl(blockSvg, 'rect', {
      x: mx - w / 2, y: my - h / 2, width: w, height: h, rx: 4,
      fill: '#1F2650', stroke: '#F2A93C', 'stroke-width': '2'
    });
    svgEl(blockSvg, 'text', {
      x: mx, y: my + 5, 'text-anchor': 'middle',
      fill: '#ECEBF2', 'font-family': 'IBM Plex Mono, monospace', 'font-size': '13.5', 'font-weight': '600'
    }, boxLabel);

    // insignia de signo (+/−) justo si el destino es un sumador real (2+ ramas entrantes)
    if (summing) {
      const tx = mx + (ex - mx) * 0.78, ty = my + (ey - my) * 0.78;
      const nx = -uy, ny = ux;
      const bx = tx + nx * 16, by = ty + ny * 16;
      svgEl(blockSvg, 'circle', { cx: bx, cy: by, r: 9, fill: '#10142E', stroke: isNeg ? '#E8607A' : '#57D6C7', 'stroke-width': '1.5' });
      svgEl(blockSvg, 'text', {
        x: bx, y: by + 4.5, 'text-anchor': 'middle',
        fill: isNeg ? '#E8607A' : '#57D6C7', 'font-family': 'IBM Plex Mono, monospace', 'font-size': '13', 'font-weight': '700'
      }, isNeg ? '−' : '+');
    }

    // manija arrastrable para ajustar la curva a mano (rombo ◇)
    const handle = svgEl(blockSvg, 'rect', {
      x: mx - 5, y: my - h / 2 - 16, width: 10, height: 10, transform: `rotate(45 ${mx} ${my - h / 2 - 11})`,
      fill: '#57D6C7', stroke: '#10142E', 'stroke-width': '1', style: 'cursor:grab', opacity: '0.85'
    });
    handle.addEventListener('pointerdown', (ev) => {
      draggingBendEdge = edge; ev.stopPropagation();
    });
    handle.addEventListener('dblclick', (ev) => {
      edge.bend = null; ev.stopPropagation(); renderBlockDiagram();
    });
  }

  function drawBlockNode(n) {
    const isSource = n.id === source, isSink = n.id === sink;
    const summing = isSummingNode(n.id);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('cursor', 'grab');
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', n.x); circle.setAttribute('cy', n.y); circle.setAttribute('r', 20);
    circle.setAttribute('fill', isSource ? 'rgba(87,214,199,0.18)' : isSink ? 'rgba(232,96,122,0.18)' :
      summing ? 'rgba(242,169,60,0.16)' : '#1F2650');
    circle.setAttribute('stroke', isSource ? '#57D6C7' : isSink ? '#E8607A' : '#F2A93C');
    circle.setAttribute('stroke-width', '2');
    g.appendChild(circle);
    const label = document.createElementNS(NS, 'text');
    label.setAttribute('x', n.x); label.setAttribute('y', n.y + 4);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', '#ECEBF2');
    label.setAttribute('font-family', 'IBM Plex Mono, monospace');
    label.setAttribute('font-size', '12'); label.setAttribute('font-weight', '600');
    label.textContent = n.id;
    g.appendChild(label);
    g.addEventListener('pointerdown', (ev) => { draggingNode = n; ev.stopPropagation(); });
    blockSvg.appendChild(g);
  }

  function svgPoint(svg, clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const scaleX = vb.width / rect.width, scaleY = vb.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  blockSvg.addEventListener('pointermove', (ev) => {
    if (draggingNode) {
      const p = svgPoint(blockSvg, ev.clientX, ev.clientY);
      draggingNode.x = p.x; draggingNode.y = p.y;
      renderAll();
    } else if (draggingBendEdge) {
      const p = svgPoint(blockSvg, ev.clientX, ev.clientY);
      const a = findNode(draggingBendEdge.from), b = findNode(draggingBendEdge.to);
      if (a && b) {
        draggingBendEdge.bend = { x: p.x - (a.x + b.x) / 2, y: p.y - (a.y + b.y) / 2 };
        renderBlockDiagram();
      }
    }
  });
  window.addEventListener('pointerup', () => { draggingNode = null; draggingBendEdge = null; });

  /* ---------------- vista 2: DIAGRAMA DE FLUJO DE SEÑAL (generado, solo lectura) ---------------- */

  function renderNodeGraph() {
    nodeSvg.innerHTML = '';
    addArrowDefs(nodeSvg, 'node-arrow', '#F2A93C');

    const groups = edgeGroups();
    edges.forEach(edge => {
      const nodeA = findNode(edge.from), nodeB = findNode(edge.to);
      if (!nodeA || !nodeB) return;
      const [idA, idB] = [edge.from, edge.to].sort();
      const group = groups[[idA, idB].join('|')];
      const offset = autoOffsetFor(edge, nodeA, nodeB, idA, idB, group);
      drawNodeEdge(edge, nodeA, nodeB, offset);
    });
    nodes.forEach(n => drawPlainNode(n));
  }

  function drawNodeEdge(e, a, b, offset) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    const R = 16;
    const sx = a.x + ux * R, sy = a.y + uy * R;
    const ex = b.x - ux * R, ey = b.y - uy * R;
    const mx = (sx + ex) / 2 + offset.x, my = (sy + ey) / 2 + offset.y;

    svgEl(nodeSvg, 'path', {
      d: `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`,
      fill: 'none', stroke: '#F2A93C', 'stroke-width': '2', 'marker-end': 'url(#node-arrow)'
    });
    const mag = Math.hypot(offset.x, offset.y);
    const labelPos = mag < 1
      ? { x: (sx + ex) / 2, y: (sy + ey) / 2 - 9 }
      : { x: mx + (offset.x / mag) * 11, y: my + (offset.y / mag) * 11 };
    svgEl(nodeSvg, 'rect', {
      x: labelPos.x - (e.gain.length * 3.5) - 4, y: labelPos.y - 10,
      width: e.gain.length * 7 + 8, height: 15, rx: 2, fill: '#10142E', stroke: '#2C3468'
    });
    svgEl(nodeSvg, 'text', {
      x: labelPos.x, y: labelPos.y + 1, 'text-anchor': 'middle',
      fill: '#57D6C7', 'font-family': 'IBM Plex Mono, monospace', 'font-size': '11.5'
    }, e.gain);
  }

  function drawPlainNode(n) {
    const isSource = n.id === source, isSink = n.id === sink;
    svgEl(nodeSvg, 'circle', {
      cx: n.x, cy: n.y, r: 16,
      fill: isSource ? 'rgba(87,214,199,0.18)' : isSink ? 'rgba(232,96,122,0.18)' : '#1F2650',
      stroke: isSource ? '#57D6C7' : isSink ? '#E8607A' : '#F2A93C', 'stroke-width': '2'
    });
    svgEl(nodeSvg, 'text', {
      x: n.x, y: n.y + 4, 'text-anchor': 'middle',
      fill: '#ECEBF2', 'font-family': 'IBM Plex Mono, monospace', 'font-size': '11', 'font-weight': '600'
    }, n.id);
  }

  function renderAll() {
    renderBlockDiagram();
    renderNodeGraph();
    renderLists();
  }

  /* ---------------- formulario "agregar bloque" ---------------- */

  addBtn.addEventListener('click', addBlockFromForm);
  [fromInput, toInput, gainInput].forEach(inp => inp.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') addBlockFromForm();
  }));

  function addBlockFromForm() {
    const fromName = fromInput.value.trim();
    const toName = toInput.value.trim();
    const gain = gainInput.value.trim() || 'G';
    if (!fromName || !toName || fromName === toName) return;

    const fromNode = ensureNode(fromName, null);
    const toNode = ensureNode(toName, fromNode);
    edges.push({ id: newEdgeId(), from: fromName, to: toName, gain, bend: null });

    if (!source) source = fromName;
    if (!sink) sink = toName;

    refreshIOSelectors();
    renderAll();

    // encadenar: la salida de este bloque suele ser la entrada del siguiente
    fromInput.value = toName;
    toInput.value = '';
    gainInput.value = 'G';
    toInput.focus();
  }

  sourceSel.addEventListener('change', () => { source = sourceSel.value; renderAll(); });
  sinkSel.addEventListener('change', () => { sink = sinkSel.value; renderAll(); });

  /* ---------------- ley de Mason (algoritmo, sin cambios respecto a antes) ---------------- */

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
    if (loopList.length === 0) return { text: '1', terms: [] };
    const combosBySize = nonTouchingCombos(loopList);
    const groupTerms = [];
    groupTerms.push({ size: 1, items: loopList.map((_, i) => [i]) });
    Object.keys(combosBySize).sort((a, b) => a - b).forEach(sizeStr => {
      groupTerms.push({ size: parseInt(sizeStr), items: combosBySize[sizeStr] });
    });

    let text = '1';
    groupTerms.forEach(group => {
      const sign = (group.size % 2 === 1) ? '-' : '+';
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
      html += `<div class="result-line"><span class="tag">${pathLabels[i]}</span>${p.nodes.join(' → ')} &nbsp; ganancia = <span class="kx">${p.gain}</span></div>`;
    });
    html += `</div>`;

    html += `<div class="result-block"><h3>Lazos individuales (${loops.length})</h3>`;
    loops.forEach((l, i) => {
      html += `<div class="result-line"><span class="tag">${loopLabels[i]}</span>${l.nodes.join(' → ')} → ${l.nodes[0]} &nbsp; ganancia = <span class="kx">${l.gain}</span></div>`;
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
      const items = combosBySize[sizeStr].map(idxArr =>
        `<span class="kx">${idxArr.map(i => loopLabels[i]).join('·')}</span>`);
      html += `<div class="result-line"><span class="tag">${label}</span>${items.join(',  ')}</div>`;
    });
    html += `</div>`;

    const delta = buildDelta(loops, loopLabels);
    html += `<div class="result-block"><h3>Determinante Δ</h3>
      <div class="result-line">Δ = <span class="kx">${delta.text}</span></div></div>`;

    html += `<div class="result-block"><h3>Cofactores Δₖ</h3>`;
    paths.forEach((p, i) => {
      const filteredIdx = loops.map((l, li) => li).filter(li => disjoint(loops[li].nodeSet, p.nodeSet));
      const filteredLoops = filteredIdx.map(li => loops[li]);
      const filteredLabels = filteredIdx.map(li => loopLabels[li]);
      const d = buildDelta(filteredLoops, filteredLabels);
      html += `<div class="result-line"><span class="tag">Δ${i + 1}</span>= <span class="kx">${d.text}</span></div>`;
    });
    html += `</div>`;

    if (paths.length > 0) {
      html += `<div class="result-block"><h3>Función de transferencia</h3>
        <div class="final-tf" id="mason-final-tf"></div>
        <p class="hint" style="margin-top:8px">
          donde ${pathLabels.map((pl, i) => `<span class="kx">${pl}=${paths[i].gain}</span>`).join(',  ')}
          ${loopLabels.length ? ' y ' + loopLabels.map((ll, i) => `<span class="kx">${ll}=${loops[i].gain}</span>`).join(',  ') : ''}.
        </p>
      </div>`;
    }

    resultsEl.innerHTML = html;

    resultsEl.querySelectorAll('.kx').forEach(span => {
      MathFmt.render(span, MathFmt.texSym(span.textContent), false);
    });

    if (paths.length > 0) {
      const numTex = paths.map((p, i) => `${MathFmt.texSym(pathLabels[i])}\\cdot ${MathFmt.texSym('Δ' + (i + 1))}`).join(' + ');
      const finalTex = `T(s)=\\dfrac{${numTex}}{\\Delta}`;
      MathFmt.render(document.getElementById('mason-final-tf'), finalTex, true);
    }
  }

  computeBtn.addEventListener('click', computeMason);

  /* ---------------- Presets ---------------- */

  function presetSeries() {
    // Figura 3.15: dos bloques en serie, sin retroalimentación.
    const withNodes = [
      { id: 'R', x: 100, y: 230 },
      { id: 'Z', x: 380, y: 230 },
      { id: 'Y', x: 660, y: 230 },
    ];
    const withEdges = [
      { id: 'e1', from: 'R', to: 'Z', gain: 'G1', bend: null },
      { id: 'e2', from: 'Z', to: 'Y', gain: 'G2', bend: null },
    ];
    resetAll(withNodes, withEdges, 'R', 'Y');
  }

  function presetFeedback() {
    // Figura 3.16: retroalimentación negativa clásica.
    const withNodes = [
      { id: 'R', x: 120, y: 230 },
      { id: 'E', x: 400, y: 230 },
      { id: 'Y', x: 680, y: 230 },
    ];
    const withEdges = [
      { id: 'e1', from: 'R', to: 'E', gain: '1', bend: null },
      { id: 'e2', from: 'E', to: 'Y', gain: 'G', bend: null },
      { id: 'e3', from: 'Y', to: 'E', gain: '-H', bend: null },
    ];
    resetAll(withNodes, withEdges, 'R', 'Y');
  }

  function presetFig320() {
    // Reproduce la Figura 3.20 del capítulo: 9 nodos, incluida la rama larga -H4.
    const withNodes = [
      { id: 'N1', x: 70, y: 230 },
      { id: 'N2', x: 190, y: 230 },
      { id: 'N3', x: 310, y: 230 },
      { id: 'N4', x: 430, y: 230 },
      { id: 'N5', x: 550, y: 230 },
      { id: 'N6', x: 670, y: 230 },
      { id: 'N7', x: 800, y: 230 },
      { id: 'N8', x: 310, y: 370 },
      { id: 'N9', x: 430, y: 370 },
    ];
    const withEdges = [
      { id: 'e1', from: 'N1', to: 'N2', gain: 'G1', bend: null },
      { id: 'e2', from: 'N2', to: 'N3', gain: 'G2', bend: null },
      { id: 'e3', from: 'N3', to: 'N2', gain: '-H1', bend: null },
      { id: 'e4', from: 'N3', to: 'N4', gain: 'G3', bend: null },
      { id: 'e5', from: 'N4', to: 'N5', gain: 'G4', bend: null },
      { id: 'e6', from: 'N5', to: 'N4', gain: '-H2', bend: null },
      { id: 'e7', from: 'N5', to: 'N2', gain: '-H4', bend: { x: 0, y: -90 } },
      { id: 'e8', from: 'N5', to: 'N6', gain: 'G5', bend: null },
      { id: 'e9', from: 'N6', to: 'N7', gain: 'G6', bend: null },
      { id: 'e10', from: 'N3', to: 'N8', gain: 'G7', bend: null },
      { id: 'e11', from: 'N8', to: 'N9', gain: 'G8', bend: null },
      { id: 'e12', from: 'N9', to: 'N8', gain: '-H3', bend: null },
      { id: 'e13', from: 'N9', to: 'N7', gain: 'G9', bend: null },
    ];
    resetAll(withNodes, withEdges, 'N1', 'N7');
  }

  el('mason-preset-series').addEventListener('click', presetSeries);
  el('mason-preset-fig320').addEventListener('click', presetFig320);
  el('mason-preset-feedback').addEventListener('click', presetFeedback);
  el('mason-preset-clear').addEventListener('click', () => resetAll([], [], null, null));

  window.addEventListener('DOMContentLoaded', presetFeedback);
})();
