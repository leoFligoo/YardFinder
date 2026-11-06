import {TRUCK_CAPACITY} from './data.js';

export function changeSelection(vehicles, selectedIds, id, checked) {
  const next = new Set(selectedIds);
  if (!checked) {next.delete(id); return {ids: [...next]};}
  if (!vehicles.some(auto => auto.id === id)) return {error: 'Ese auto ya no está en la lista de encontrados.'};
  if (!next.has(id) && next.size >= TRUCK_CAPACITY) {
    return {error: `El camión admite hasta ${TRUCK_CAPACITY} autos. Quitá uno antes de agregar otro.`};
  }
  next.add(id);
  return {ids: [...next]};
}

export function coordinatesLabel(auto) {
  const position = auto.posicion;
  if (position && Number.isInteger(position.loteId) && position.loteId >= 1 && position.loteId <= 6
      && Number.isInteger(position.x) && position.x >= 1 && position.x <= 4
      && Number.isInteger(position.y) && position.y >= 1 && position.y <= 5) {
    return `Lote ${position.loteId} · (${position.x},${position.y})`;
  }
  return 'Posición X/Y sin vincular';
}

export function createVehicleList({state, onChange, onInspect}) {
  const body = document.getElementById('vehicle-list-body');
  const status = document.getElementById('dispatch-selection-status');
  const chosen = document.getElementById('dispatch-selected');
  const clear = document.getElementById('clear-dispatch-selection');
  let shown = [];
  const label = auto => `Auto #${String(auto.id).padStart(3, '0')}`;
  function setChecked(id, checked) {
    const result = changeSelection(state.data.autos, state.dispatchIds, id, checked);
    if (result.error) {
      sync(); status.textContent = result.error; return;
    }
    state.dispatchIds = result.ids;
    sync(); onChange();
  }
  function sync() {
    const ids = new Set(state.dispatchIds);
    body.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.checked = ids.has(Number(input.value));
      input.closest('tr').classList.toggle('for-dispatch', input.checked);
    });
    const hidden = state.dispatchIds.filter(id => !shown.some(auto => auto.id === id)).length;
    status.textContent = `${ids.size} de ${TRUCK_CAPACITY} autos seleccionados${hidden ? ` · ${hidden} fuera del filtro actual` : ''}${ids.size === TRUCK_CAPACITY ? ' · Capacidad completa' : ''}`;
    clear.disabled = ids.size === 0;
    chosen.replaceChildren(...state.dispatchIds.map(id => {
      const button = document.createElement('button');
      button.className = 'selected-auto-chip';
      button.textContent = `#${String(id).padStart(3, '0')} ×`;
      button.setAttribute('aria-label', `Quitar auto #${String(id).padStart(3, '0')} del despacho`);
      button.addEventListener('click', () => setChecked(id, false));
      return button;
    }));
  }
  function show(autos) {
    shown = autos;
    body.replaceChildren();
    document.getElementById('vehicle-list-count').textContent = `${autos.length} encontrados en la vista`;
    for (const auto of autos) {
      const row = document.createElement('tr');
      const pick = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox'; checkbox.value = auto.id;
      checkbox.setAttribute('aria-label', `Seleccionar ${label(auto)} para despacho`);
      checkbox.addEventListener('change', () => setChecked(auto.id, checkbox.checked));
      pick.append(checkbox); row.append(pick);
      const name = document.createElement('th'); name.scope = 'row';
      const inspect = document.createElement('button');
      inspect.className = 'vehicle-inspect'; inspect.textContent = label(auto);
      inspect.setAttribute('aria-label', `Ver ${label(auto)} en el mapa`);
      inspect.addEventListener('click', () => onInspect(auto.id));
      name.append(inspect); row.append(name);
      const coords = document.createElement('td');
      coords.textContent = coordinatesLabel(auto);
      if (Number.isFinite(auto.lat) && Number.isFinite(auto.lon)) {
        const gps = document.createElement('small');
        gps.textContent = `GPS: ${auto.lat.toFixed(6)}, ${auto.lon.toFixed(6)}`;
        coords.append(gps);
      }
      row.append(coords);
      for (const value of [auto.modelo, auto.color, auto.vin, auto.tag, auto.patente]) {
        const cell = document.createElement('td');
        cell.textContent = value === null || value === undefined || value === '' ? 'Sin identificar' : String(value);
        row.append(cell);
      }
      body.append(row);
    }
    if (!autos.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td'); cell.colSpan = 8;
      cell.textContent = 'No hay autos que coincidan con los filtros.';
      row.append(cell); body.append(row);
    }
    sync();
  }
  clear.addEventListener('click', () => {state.dispatchIds = []; sync(); onChange();});
  return {show, sync};
}
