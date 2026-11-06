import {inventoryImageUrl} from './data.js';

export function vehicleDetailRows(position, auto = {}) {
  return [
    ['Coordenadas', `(${position.x}, ${position.y})`],
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
  let requestId = 0;
  function show(position) {
    const auto = position.auto;
    if (!auto) return;
    const currentRequest = ++requestId;
    card.hidden = false;
    layout.classList.add('has-vehicle-detail');
    document.getElementById('vehicle-title').textContent = `Auto #${String(auto.id).padStart(3, '0')}`;
    document.getElementById('vehicle-info').replaceChildren(...vehicleDetailRows(position, auto).map(([label, value]) => {
      const row = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = label;
      const dd = document.createElement('dd'); dd.textContent = value;
      row.append(dt, dd); return row;
    }));
    photo.hidden = true; photo.removeAttribute('src');
    imageStatus.hidden = false; imageStatus.textContent = 'Cargando recorte…';
    message.textContent = 'Ubicación del último vuelo registrado. Consultar este auto no lo reserva para despacho.';
    photo.alt = `Recorte del auto #${String(auto.id).padStart(3, '0')}`;
    photo.onload = () => {
      if (currentRequest !== requestId) return;
      photo.hidden = false; imageStatus.hidden = true;
    };
    photo.onerror = () => {
      if (currentRequest !== requestId) return;
      photo.hidden = true;
      imageStatus.hidden = false; imageStatus.textContent = 'Recorte no disponible.';
    };
    try { photo.src = inventoryImageUrl(auto); } catch { photo.onerror(); }
    if (window.matchMedia('(max-width: 980px)').matches) card.scrollIntoView({block: 'nearest'});
  }
  function hide() {
    requestId++;
    photo.onload = photo.onerror = null;
    photo.removeAttribute('src');
    card.hidden = true;
    layout.classList.remove('has-vehicle-detail');
  }
  document.getElementById('close-vehicle-detail').addEventListener('click', () => {
    hide(); onClose();
  });
  return {show, hide};
}
