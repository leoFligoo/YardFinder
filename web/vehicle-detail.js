import {assetUrl, loadPatio} from './data.js';

// Explicit demo association: row-major positions map to the original observation
// IDs 1..120. This is not an inferred GPS match or a write to the real inventory.
export function demoVehicleId(position) {
  const {lotId, x, y} = position;
  if (![lotId, x, y].every(Number.isInteger) || lotId < 1 || lotId > 6
      || x < 1 || x > 4 || y < 1 || y > 5) throw new Error('Posición inválida.');
  return (lotId - 1) * 20 + (y - 1) * 4 + x;
}

export function vehicleDetailRows(position, auto = {}) {
  return [
    ['Coordenadas', `(${position.x}, ${position.y}) · Simuladas`],
    ['Sector', `Lote ${position.lotId}`],
    ['Tag', auto.tag == null ? 'No identificado' : String(auto.tag)],
    ['VIN', auto.vin || 'No identificado'],
    ['Patente', auto.patente || 'No identificada'],
    ['Modelo', auto.modelo || 'Sin datos'],
    ['Color', auto.color || 'Sin datos'],
    ['Confianza', Number.isFinite(auto.conf) && auto.conf >= 0 && auto.conf <= 1
      ? `${Math.round(auto.conf * 100)} %` : 'Sin datos'],
  ];
}

export function createVehicleDetail({onClose}) {
  const card = document.getElementById('vehicle-card');
  const layout = document.getElementById('yard-and-detail');
  const photo = document.getElementById('vehicle-photo');
  const imageStatus = document.getElementById('vehicle-image-status');
  const message = document.getElementById('vehicle-detail-message');
  const retry = document.getElementById('vehicle-detail-retry');
  let requestId = 0, snapshotPromise, lastPosition;
  const renderRows = (position, auto) => {
    document.getElementById('vehicle-info').replaceChildren(...vehicleDetailRows(position, auto).map(([label, value]) => {
      const row = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = label;
      const dd = document.createElement('dd'); dd.textContent = value;
      row.append(dt, dd); return row;
    }));
  };
  async function show(position) {
    const currentRequest = ++requestId;
    lastPosition = position;
    const id = demoVehicleId(position);
    card.hidden = false;
    layout.classList.add('has-vehicle-detail');
    document.getElementById('vehicle-title').textContent = `Auto #${String(id).padStart(3, '0')}`;
    renderRows(position);
    photo.hidden = true; photo.removeAttribute('src');
    imageStatus.hidden = false; imageStatus.textContent = 'Cargando recorte…';
    message.textContent = 'Cargando observación del ejemplo local…';
    retry.hidden = true;
    if (window.matchMedia('(max-width: 980px)').matches) card.scrollIntoView({block: 'nearest'});
    try {
      snapshotPromise ??= loadPatio().catch(error => {snapshotPromise = null; throw error;});
      const data = await snapshotPromise;
      if (currentRequest !== requestId) return;
      const auto = data.autos.find(a => a.id === id);
      renderRows(position, auto);
      if (!auto) {
        imageStatus.textContent = 'Sin observación disponible para esta posición.';
        message.textContent = 'Posición de ejemplo, sin auto identificado.';
        return;
      }
      message.textContent = `Asignación de ejemplo. Recorte y atributos de la observación original${auto.lote ? ` (${auto.lote})` : ''}; la ubicación X/Y en este plano es simulada.`;
      photo.alt = `Recorte de la observación del auto #${String(id).padStart(3, '0')}`;
      photo.onload = () => {
        if (currentRequest !== requestId) return;
        photo.hidden = false; imageStatus.hidden = true;
      };
      photo.onerror = () => {
        if (currentRequest !== requestId) return;
        photo.hidden = true;
        imageStatus.hidden = false; imageStatus.textContent = 'Recorte no disponible.';
      };
      try { photo.src = assetUrl(auto.recorte); } catch { photo.onerror(); }
    } catch {
      if (currentRequest !== requestId) return;
      imageStatus.textContent = 'No se pudo cargar la observación.';
      message.textContent = 'La consulta del plano sigue disponible. Reintentá para cargar la foto y los datos del ejemplo.';
      retry.hidden = false;
    }
  }
  function hide() {
    requestId++;
    card.hidden = true;
    layout.classList.remove('has-vehicle-detail');
  }
  document.getElementById('close-vehicle-detail').addEventListener('click', () => {
    hide(); onClose();
  });
  retry.addEventListener('click', () => {if (lastPosition) show(lastPosition);});
  return {show, hide};
}
