import {buildYardGeometry} from './yard-geometry.js';

// Logical positions are local to each lot, never latitude/longitude or image pixels.
export const YARD_LAYOUT = Object.freeze({lotCount: 6, columns: 4, rows: 5});

export function generateYard({lotCount, columns, rows} = YARD_LAYOUT) {
  if (![lotCount, columns, rows].every(n => Number.isSafeInteger(n) && n > 0)
      || lotCount * columns * rows > 10000) {
    throw new Error('La distribución debe tener dimensiones enteras positivas y hasta 10.000 posiciones.');
  }
  const lots = Array.from({length: lotCount}, (_, index) => ({
    id: index + 1,
    name: `Lote ${index + 1}`,
    columns,
    rows,
    capacity: columns * rows,
    positions: Array.from({length: columns * rows}, (_, position) => {
      const x = position % columns + 1;
      const y = Math.floor(position / columns) + 1;
      return {id: `L${index + 1}-X${x}-Y${y}`, lotId: index + 1, x, y};
    }),
  }));
  return {lots, capacity: lotCount * columns * rows};
}

export function findPosition(yard, lotId, x, y) {
  return yard.lots.find(lot => lot.id === lotId)?.positions.find(p => p.x === x && p.y === y) ?? null;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgNode(name, attributes = {}, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderYardLayout(container, {onSelect = () => {}, onClear = () => {}} = {}) {
  const yard = generateYard();
  const geometry = buildYardGeometry(yard);
  container.innerHTML = `
    <section class="panel yard-board" aria-labelledby="yard-title">
      <div class="yard-board-heading">
        <div><h2 id="yard-title">Distribución del patio</h2><p>6 lotes <span>·</span> 4 columnas × 5 filas por lote</p></div>
        <div class="yard-controls" aria-label="Controles de la distribución">
          <button type="button" id="yard-zoom-out" aria-label="Alejar distribución">−</button>
          <output id="yard-zoom" aria-live="polite">100%</output>
          <button type="button" id="yard-zoom-in" aria-label="Acercar distribución">+</button>
          <button type="button" id="yard-reset" class="yard-fit">Ver todo</button>
        </div>
      </div>
      <div class="yard-viewport" aria-label="Plano interactivo del patio"></div>
      <div class="yard-board-footer">
        <div class="yard-legend"><span><i class="green-bg"></i>Disponible</span><span><i class="yellow-bg"></i>En consulta</span><span><i class="road-key"></i>Calle de circulación</span></div>
        <span>Usá + / − para acercarte · Arrastrá para mover</span>
      </div>
      <div class="yard-inspection" role="status" aria-live="polite"><span class="inspection-icon">↖</span><div><strong id="yard-position-title">Consultá una posición</strong><p id="yard-position-description">Seleccioná un auto del plano para ver su lote y coordenadas.</p></div><button id="yard-clear" type="button" aria-label="Cerrar consulta de posición" hidden>×</button></div>
    </section>`;
  const viewport = container.querySelector('.yard-viewport');
  const svg = svgNode('svg', {viewBox: `0 0 ${geometry.width} ${geometry.height}`, class: 'yard-plan',
    'aria-label': 'Seis lotes con autos horizontales, calles laterales y centrales, entrada y salida', role: 'group'});
  const defs = svgNode('defs');
  // Reusable code-native car, viewed from above and oriented horizontally.
  const car = svgNode('g', {id: 'yard-car-shape'});
  car.append(
    svgNode('rect', {x: 7, y: 0, width: 10, height: 4, rx: 2, fill: '#070c11'}),
    svgNode('rect', {x: 37, y: 0, width: 10, height: 4, rx: 2, fill: '#070c11'}),
    svgNode('rect', {x: 7, y: 22, width: 10, height: 4, rx: 2, fill: '#070c11'}),
    svgNode('rect', {x: 37, y: 22, width: 10, height: 4, rx: 2, fill: '#070c11'}),
    svgNode('rect', {x: 1, y: 3, width: 52, height: 20, rx: 7, fill: 'currentColor', stroke: '#acffd0', 'stroke-width': .8}),
    svgNode('path', {d: 'M15 5H35L40 9V17L35 21H15L12 17V9Z', fill: '#162c2a'}),
    svgNode('rect', {x: 20, y: 6, width: 13, height: 14, rx: 3, fill: 'currentColor', opacity: .9}),
    svgNode('path', {d: 'M16 7L13 10V16L16 19M36 7L39 10V16L36 19', fill: 'none', stroke: '#799690', 'stroke-width': 1.2}),
    svgNode('path', {d: 'M49 7V10M49 16V19', stroke: '#f2ffe8', 'stroke-width': 2}),
    svgNode('path', {d: 'M4 8V10M4 16V18', stroke: '#38564a', 'stroke-width': 2}),
  );
  defs.append(car); svg.append(defs);
  svg.append(svgNode('rect', {x: 31, y: 61, width: 1186, height: 739, rx: 22, class: 'yard-perimeter'}));
  const roadLayer = svgNode('g', {class: 'yard-road-layer', 'aria-hidden': 'true'});
  for (const road of geometry.roads) {
    const d = `M${road.x1} ${road.y1}L${road.x2} ${road.y2}`;
    roadLayer.append(svgNode('path', {d, stroke: '#3d4651', 'stroke-width': road.width + 2, 'stroke-linecap': 'round'}));
    roadLayer.append(svgNode('path', {d, stroke: '#252e39', 'stroke-width': road.width, 'stroke-linecap': 'round'}));
  }
  for (const road of geometry.roads) {
    roadLayer.append(svgNode('path', {d: `M${road.x1} ${road.y1}L${road.x2} ${road.y2}`, class: 'yard-road-center'}));
  }
  svg.append(roadLayer);
  for (const lot of geometry.lots) {
    const layer = svgNode('g', {'data-lot-id': lot.id, class: 'yard-lot'});
    layer.append(svgNode('rect', {x: lot.left + 26, y: lot.top + 124, width: 298, height: 269, rx: 9, class: 'yard-lot-outline'}));
    layer.append(svgNode('text', {x: lot.left + 34, y: lot.top + 147, class: 'yard-lot-title'}, `LOTE ${String(lot.id).padStart(2, '0')}`));
    layer.append(svgNode('text', {x: lot.left + 204, y: lot.top + 147, class: 'yard-lot-count'}, `${lot.positions.filter(p => p.available).length} disponibles`));
    for (const position of lot.positions) {
      const group = svgNode('g', {class: 'yard-car', transform: `translate(${position.cx - 27} ${position.cy - 13})`,
        role: 'button', tabindex: '0', 'aria-pressed': 'false', 'data-position-id': position.id,
        'aria-label': `Lote ${lot.id}, columna ${position.x}, fila ${position.y}, disponible`});
      group.append(svgNode('rect', {x: -4, y: -5, width: 62, height: 40, rx: 4, class: 'yard-bay'}));
      group.append(svgNode('use', {href: '#yard-car-shape'}));
      group.append(svgNode('text', {x: 27, y: 36, 'text-anchor': 'middle', class: 'yard-coordinate'}, `${position.x},${position.y}`));
      const select = () => {
        svg.querySelectorAll('.yard-car[aria-pressed="true"]').forEach(el => el.setAttribute('aria-pressed', 'false'));
        group.setAttribute('aria-pressed', 'true');
        container.querySelector('#yard-position-title').textContent = `Lote ${lot.id} · (${position.x}, ${position.y})`;
        container.querySelector('#yard-position-description').textContent = `Disponible · Columna ${position.x}, fila ${position.y} · ${position.id}`;
        container.querySelector('#yard-clear').hidden = false;
        onSelect(position);
      };
      group.addEventListener('click', select);
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); select();}
      });
      layer.append(group);
    }
    svg.append(layer);
  }
  // Future routes can be drawn here using geometry.nodes/edges and each position's accessNodeId.
  svg.append(svgNode('g', {id: 'yard-route-layer', 'aria-hidden': 'true', 'pointer-events': 'none'}));
  for (const gate of geometry.gates) {
    const group = svgNode('g', {class: `yard-gate ${gate.id}`, 'aria-label': gate.label});
    const y = 817;
    const arrow = gate.direction < 0 ? `M${gate.x} ${y+10}V${y-10}m-6 6 6-6 6 6` : `M${gate.x} ${y-10}V${y+10}m-6-6 6 6 6-6`;
    group.append(svgNode('path', {d: arrow, fill: 'none', stroke: gate.id === 'entry' ? '#50df91' : '#ffc928', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'}));
    group.append(svgNode('rect', {x: gate.x - 48, y: 848, width: 96, height: 28, rx: 5, class: 'yard-gate-label'}));
    group.append(svgNode('text', {x: gate.x, y: 867, 'text-anchor': 'middle'}, gate.label));
    svg.append(group);
  }
  svg.append(svgNode('text', {x: 624, y: 816, 'text-anchor': 'middle', class: 'yard-street-caption'}, 'ACCESO PRINCIPAL'));
  viewport.append(svg);
  let view = {x: 0, y: 0, width: geometry.width, height: geometry.height};
  let zoom = 1;
  const applyView = () => {
    view.x = Math.max(0, Math.min(geometry.width - view.width, view.x));
    view.y = Math.max(0, Math.min(geometry.height - view.height, view.y));
    svg.style.touchAction = zoom > 1 ? 'none' : 'pan-y';
    svg.style.cursor = zoom > 1 ? 'grab' : 'default';
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`);
    container.querySelector('#yard-zoom').textContent = `${Math.round(zoom * 100)}%`;
    container.querySelector('#yard-zoom-out').disabled = zoom <= 1;
    container.querySelector('#yard-zoom-in').disabled = zoom >= 3;
  };
  const setZoom = next => {
    const centerX = view.x + view.width / 2, centerY = view.y + view.height / 2;
    zoom = Math.max(1, Math.min(3, next));
    view = {width: geometry.width / zoom, height: geometry.height / zoom,
      x: centerX - geometry.width / zoom / 2, y: centerY - geometry.height / zoom / 2};
    applyView();
  };
  container.querySelector('#yard-zoom-in').addEventListener('click', () => setZoom(zoom + .5));
  container.querySelector('#yard-zoom-out').addEventListener('click', () => setZoom(zoom - .5));
  container.querySelector('#yard-reset').addEventListener('click', () => setZoom(1));
  const clearSelection = () => {
    const selected = svg.querySelector('.yard-car[aria-pressed="true"]');
    svg.querySelectorAll('.yard-car[aria-pressed="true"]').forEach(el => el.setAttribute('aria-pressed', 'false'));
    container.querySelector('#yard-position-title').textContent = 'Consultá una posición';
    container.querySelector('#yard-position-description').textContent = 'Seleccioná un auto del plano para ver su lote y coordenadas.';
    container.querySelector('#yard-clear').hidden = true;
    onClear();
    selected?.focus({preventScroll: true});
  };
  container.querySelector('#yard-clear').addEventListener('click', clearSelection);
  let drag = null;
  svg.addEventListener('pointerdown', event => {
    if (zoom === 1 || event.button !== 0 || event.target.closest('.yard-car')) return;
    drag = {x: event.clientX, y: event.clientY, originX: view.x, originY: view.y};
    svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove', event => {
    if (!drag) return;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / view.width, rect.height / view.height);
    view.x = drag.originX - (event.clientX - drag.x) / scale;
    view.y = drag.originY - (event.clientY - drag.y) / scale;
    applyView();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) svg.addEventListener(type, () => {drag = null;});
  svg.addEventListener('focusin', event => {
    const position = geometry.positions.find(p => p.id === event.target.dataset.positionId);
    if (position && zoom > 1) {
      view.x = position.cx - view.width / 2;
      view.y = position.cy - view.height / 2;
      applyView();
    }
  });
  applyView();
  return {yard, geometry, clearSelection};
}
