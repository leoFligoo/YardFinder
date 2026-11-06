import {renderIcons} from './icons.js';
import {loadPatio, summarize, filterVehicles, assetUrl, hasLocation} from './data.js';
import {state} from './state.js';
import {createPatioMap} from './map.js';
import {renderYardLayout} from './yard-layout.js';
import {coordinatesLabel} from './vehicle-list.js';

const $ = id => document.getElementById(id);
const text = (id, value) => { $(id).textContent = value; };
let patioMap;
let imageFailed = false;
renderIcons();
renderYardLayout($('yard-layout'));


const dialog = $('pending-dialog');
document.querySelectorAll('[data-pending]').forEach(button => button.addEventListener('click', () => {
  text('pending-title', `${button.dataset.pending} · Próximamente`);
  text('pending-description', button.dataset.pending === 'Despacho'
    ? 'Primero ingresá tu búsqueda en el chat, por ejemplo: «Buscame los 5 Fiat Cronos blancos». Después podrás seleccionar hasta 8 autos entre las coincidencias y generar el recorrido. Despacho todavía no está disponible en esta demo.'
    : 'Esta sección todavía no está disponible en la demo. Podés seguir explorando los vehículos y sus observaciones en el mapa del patio.');
  dialog.showModal();
}));
$('close-dialog').addEventListener('click', () => dialog.close());
function route() {
  if (location.hash && location.hash !== '#/patio' && location.hash !== '#contenido') {
    history.replaceState(null, '', '#/patio');
  }
}
window.addEventListener('hashchange', route);
route();

function selectVehicle(id, focus = false) {
  const auto = state.data.autos.find(a => a.id === id);
  state.selectedId = auto?.id ?? null;
  patioMap.select(state.selectedId, focus);
  $('vehicle-card').hidden = !auto;
  if (!auto) return;
  text('vehicle-title', `Auto #${String(auto.id).padStart(3, '0')}`);
  const photo = $('vehicle-photo');
  photo.hidden = false;
  $('vehicle-image-error').hidden = true;
  photo.onerror = () => {photo.hidden = true; $('vehicle-image-error').hidden = false;};
  try { photo.src = assetUrl(auto.recorte); } catch { photo.removeAttribute('src'); photo.onerror(); }
  const rows = [
    ['Coordenadas', coordinatesLabel(auto)],
    ['Sector', auto.lote || (hasLocation(auto) ? 'Fuera de sector' : 'Sin ubicación')],
    ['Tag', auto.tag == null ? 'No identificado' : `#${auto.tag}`],
    ['VIN', auto.vin || 'No identificado'],
    ['Patente', auto.patente || 'No identificada'],
    ['Modelo', auto.modelo || 'Sin datos'],
    ['Color', auto.color || 'Sin datos'],
    ['Confianza', Number.isFinite(auto.conf) ? `${Math.round(auto.conf * 100)} %` : 'Sin datos'],
  ];
  $('vehicle-info').replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement('div');
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd'); dd.textContent = value;
    row.append(dt, dd); return row;
  }));
}
function update() {
  const autos = filterVehicles(state.data.autos, state);
  if (state.selectedId !== null && !autos.some(a => a.id === state.selectedId)) selectVehicle(null);
  patioMap.show(autos);
  text('result-count', `${autos.length} de ${state.data.autos.length} vehículos`);
  const message = $('map-message');
  message.hidden = autos.length > 0 && !imageFailed;
  message.textContent = imageFailed ? 'No se pudo cargar una imagen cenital. Revisá los archivos de ejemplo y recargá la página.' :
    state.data.autos.length ? 'No hay vehículos que coincidan. Probá otro VIN, tag o sector.' : 'No hay vehículos en este ejemplo.';
  const results = $('search-results');
  results.hidden = !state.query.trim() && !state.sector;
  results.replaceChildren();
  autos.forEach(auto => {
    const button = document.createElement('button');
    button.className = 'result-item';
    button.textContent = `#${String(auto.id).padStart(3, '0')} · ${auto.lote || 'Sin sector'}${auto.tag == null ? '' : ` · Tag ${auto.tag}`}`;
    button.addEventListener('click', () => selectVehicle(auto.id, true));
    results.append(button);
  });
}
$('search').addEventListener('input', e => {state.query = e.target.value; update();});
$('sector-filter').addEventListener('change', e => {state.sector = e.target.value; update();});
$('review-outside').addEventListener('click', () => {
  state.sector = '__outside'; state.query = '';
  $('sector-filter').value = state.sector; $('search').value = '';
  update(); patioMap.fit(); $('sector-filter').focus();
});
$('reset').addEventListener('click', () => {
  state.query = ''; state.sector = '';
  $('search').value = ''; $('sector-filter').value = '';
  $('show-sectors').checked = $('show-vehicles').checked = true;
  patioMap.toggleSectors(true); patioMap.toggleVehicles(true);
  selectVehicle(null); update(); patioMap.fit();
});
$('close-selection').addEventListener('click', () => selectVehicle(null));
$('show-sectors').addEventListener('change', e => patioMap.toggleSectors(e.target.checked));
$('show-vehicles').addEventListener('change', e => patioMap.toggleVehicles(e.target.checked));
document.addEventListener('keydown', e => {
  if (e.key === '/' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName) && !dialog.open && state.data) {
    e.preventDefault(); $('search').focus();
  }
});

async function start() {
  $('patio-content').hidden = true;
  $('load-state').hidden = false;
  $('load-state').replaceChildren(document.createTextNode('Cargando el ejemplo local…'));
  try {
    state.data = await loadPatio();
    const data = state.data;
    const stats = summarize(data);
    for (const [id, value] of Object.entries({
      'total-count': stats.total, 'located-count': stats.located, 'missing-count': stats.missing,
      'sector-count': stats.sectors, 'attention-missing': stats.missing, 'outside-count': stats.outside,
      'image-count': data.huellas.length, 'tag-count': stats.tags,
    })) text(id, value);
    const date = new Date(data.meta?.date);
    text('flight-date', Number.isNaN(date.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es-AR', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}).format(date));
    const options = [new Option('Todos los sectores', ''), ...data.lotes.map(l => new Option(l.nombre, l.nombre)), new Option('Fuera de sector', '__outside')];
    $('sector-filter').replaceChildren(...options);
    $('patio-content').hidden = false;
    patioMap?.destroy();
    imageFailed = false;
    patioMap = createPatioMap(data, id => selectVehicle(id), () => {imageFailed = true; update();});
    update();
    $('load-state').hidden = true;
  } catch (error) {
    patioMap?.destroy(); patioMap = null;
    $('patio-content').hidden = true;
    const message = document.createElement('p');
    message.textContent = `No pudimos abrir el patio. ${error.message}`;
    const retry = document.createElement('button');
    retry.className = 'button primary'; retry.textContent = 'Reintentar';
    retry.addEventListener('click', start);
    $('load-state').replaceChildren(message, retry);
  }
}
start();
