import {loadPatio} from './data.js';
import {renderIcons} from './icons.js';
import {renderYardLayout} from './yard-layout.js';
import {createVehicleDetail} from './vehicle-detail.js';
import {createInventory} from './inventory.js';
import {parseRoute} from './router.js';

const $ = id => document.getElementById(id);
const text = (id, value) => { $(id).textContent = value; };
renderIcons();
let board, loadId = 0;
const inventory = createInventory();
const vehicleDetail = createVehicleDetail({onClose: () => board?.clearSelection()});
async function refreshPatio() {
  const currentLoad = ++loadId;
  board = null;
  vehicleDetail.hide();
  $('patio-route-message').hidden = true;
  $('yard-layout').textContent = 'Cargando inventario…';
  text('available-count', '—');
  try {
    const data = await loadPatio();
    if (currentLoad !== loadId) return;
    board = renderYardLayout($('yard-layout'), {
      autos: data.autos,
      onSelect: position => vehicleDetail.show(position),
      onClear: () => vehicleDetail.hide(),
    });
    const {yard, geometry} = board;
    text('available-count', geometry.positions.filter(p => p.auto).length);
    text('lot-count', yard.lots.length);
    text('per-lot-count', yard.lots[0].capacity);
    text('access-count', geometry.gates.length);
    const target = parseRoute(location.hash);
    if (target.page === 'patio' && target.auto !== null && target.vuelo !== null) {
      if (!board.selectAuto(target.vuelo, target.auto)) {
        text('patio-route-message', 'Esta observación ya no pertenece al último vuelo. Volvé a Inventario y actualizá los datos para consultar su ubicación actual.');
        $('patio-route-message').hidden = false;
      }
    }
  } catch (error) {
    if (currentLoad !== loadId) return;
    const message = document.createElement('p');
    message.className = 'load-state'; message.setAttribute('role', 'alert');
    message.textContent = `No se pudo cargar la distribución. ${error.message}`;
    const retry = document.createElement('button');
    retry.className = 'button outline'; retry.textContent = 'Reintentar';
    retry.addEventListener('click', refreshPatio);
    $('yard-layout').replaceChildren(message, retry);
  }
}
$('refresh-patio').addEventListener('click', refreshPatio);

const dialog = $('pending-dialog');
document.querySelectorAll('[data-pending]').forEach(button => button.addEventListener('click', () => {
  text('pending-title', `${button.dataset.pending} · Próximamente`);
  text('pending-description', button.dataset.pending === 'Despacho'
    ? 'Primero ingresá tu búsqueda en el chat, por ejemplo: «Buscame los 5 Fiat Cronos blancos». Después podrás seleccionar hasta 8 autos entre las coincidencias y generar el recorrido. Despacho todavía no está disponible en esta demo.'
    : 'Esta sección todavía no está disponible en la demo. Podés seguir explorando la distribución y las posiciones del patio.');
  dialog.showModal();
}));
$('close-dialog').addEventListener('click', () => dialog.close());
function route() {
  const target = parseRoute(location.hash);
  if (!target.page) return;
  const isInventory = target.page === 'inventario';
  $('patio-page').hidden = isInventory;
  $('inventory-page').hidden = !isInventory;
  document.title = `${isInventory ? 'Inventario' : 'Patio'} · Yard Finder`;
  document.querySelectorAll('.nav-item[href]').forEach(link => {
    const active = link.getAttribute('href') === `#/${target.page}`;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (isInventory) {
    loadId++; vehicleDetail.hide(); inventory.show();
  } else refreshPatio();
  $('contenido').focus({preventScroll: true});
  window.scrollTo({top: 0, left: 0, behavior: 'instant'});
}
window.addEventListener('hashchange', route);
route();
