import {renderIcons} from './icons.js';
import {renderYardLayout} from './yard-layout.js';
import {createVehicleDetail} from './vehicle-detail.js';

const $ = id => document.getElementById(id);
const text = (id, value) => { $(id).textContent = value; };
renderIcons();
let board;
const vehicleDetail = createVehicleDetail({onClose: () => board?.clearSelection()});
try {
  board = renderYardLayout($('yard-layout'), {
    onSelect: position => vehicleDetail.show(position),
    onClear: () => vehicleDetail.hide(),
  });
  const {yard, geometry} = board;
  text('available-count', geometry.positions.filter(p => p.available).length);
  text('lot-count', yard.lots.length);
  text('per-lot-count', yard.lots[0].capacity);
  text('access-count', geometry.gates.length);
} catch (error) {
  const message = document.createElement('p');
  message.className = 'load-state'; message.setAttribute('role', 'alert');
  message.textContent = `No se pudo cargar la distribución. ${error.message}`;
  $('yard-layout').replaceChildren(message);
}

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
  if (location.hash && location.hash !== '#/patio' && location.hash !== '#contenido') {
    history.replaceState(null, '', '#/patio');
  }
}
window.addEventListener('hashchange', route);
route();
