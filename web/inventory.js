import {DEFAULT_FILTERS, loadRegistry, queryInventory, inventoryOptions, observationDate} from './inventory-data.js';
import {patioLink} from './router.js';
import {renderIcons} from './icons.js';

export function createInventory() {
  const $ = id => document.getElementById(`inventory-${id}`);
  const root = $('page');
  let data = null, filters = {...DEFAULT_FILTERS}, request = 0, loaded = false;
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  function state(title, description, {retry = false, clear = false} = {}) {
    $('state').hidden = false;
    $('state').setAttribute('role', retry ? 'alert' : 'status');
    $('state-title').textContent = title;
    $('state-description').textContent = description;
    $('retry').hidden = !retry;
    $('empty-clear').hidden = !clear;
    $('table-wrap').hidden = true;
    $('pagination').hidden = true;
    $('body').replaceChildren();
  }
  function render() {
    if (!data) return;
    const result = queryInventory(data.filas, filters);
    filters.page = result.page;
    root.querySelectorAll('[data-scope]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scope === filters.scope)));
    root.querySelectorAll('[data-sort]').forEach(button => {
      const selected = button.dataset.sort === filters.sort;
      button.parentElement.setAttribute('aria-sort', selected ? (filters.direction === 'asc' ? 'ascending' : 'descending') : 'none');
      button.querySelector('span').textContent = selected ? (filters.direction === 'asc' ? '↑' : '↓') : '↕';
    });
    const registered = filters.scope === 'registrados';
    $('scope-note').textContent = registered
      ? 'Los vehículos registrados incluyen aquellos sin observación en el último vuelo.'
      : 'Detecciones ubicadas sin vínculo a un vehículo registrado. No se suman al catálogo.';
    const unit = registered ? (result.total === 1 ? 'registro' : 'registros') : (result.total === 1 ? 'observación' : 'observaciones');
    $('results-count').textContent = `${result.total} ${unit} en esta vista`;
    if (!result.total) {
      const scopeCount = data.conteos[filters.scope];
      state(scopeCount ? 'Sin coincidencias' : (registered ? 'Sin vehículos registrados' : 'Sin observaciones sin identificar'),
        scopeCount ? 'Probá otra búsqueda o limpiá los filtros para volver a ver los datos.' : 'No hay datos de este tipo en el inventario actual.', {clear: !!scopeCount});
      return;
    }
    $('state').hidden = true;
    $('table-wrap').hidden = false;
    $('pagination').hidden = false;
    $('body').replaceChildren(...result.rows.map(row => {
      const tr = node('tr');
      const vehicle = node('td', null, 'inventory-vehicle');
      const icon = node('span', null, 'inventory-car-icon'); icon.dataset.icon = 'car';
      const identity = node('div');
      identity.append(node('strong', row.modelo || 'Sin identificar'), node('small', row.color || 'Color sin datos'));
      if (!row.registrado) identity.append(node('small', `Observación #${String(row.id).padStart(3, '0')}`, 'observation-id'));
      vehicle.append(icon, identity);
      const location = node('td');
      if (row.posicion) {
        location.append(node('strong', `Lote ${row.posicion.loteId}`), node('small', `X ${row.posicion.x} · Y ${row.posicion.y}`));
      } else location.append(node('span', 'Sin ubicación', 'muted'));
      const status = node('td');
      const badge = node('span', null, `inventory-badge ${row.posicion ? 'located' : 'missing'}`);
      const statusIcon = node('span'); statusIcon.dataset.icon = row.posicion ? 'check' : 'alert';
      badge.append(statusIcon, node('span', row.posicion ? 'Ubicado' : 'Sin observación'));
      status.append(badge);
      const action = node('td');
      const href = patioLink(row);
      if (href) {
        const link = node('a', 'Ver en patio', 'inventory-link'); link.href = href;
        link.setAttribute('aria-label', `Ver en patio ${row.modelo || 'observación'} ${row.vin || `#${row.id}`}`);
        action.append(link);
      } else action.append(node('span', 'Sin posición', 'muted'));
      tr.append(vehicle, node('td', row.vin || 'No identificado', 'inventory-vin'),
        node('td', row.tag == null ? 'Sin tag' : String(row.tag), 'inventory-tag'), location, status,
        node('td', observationDate(row.ultima_observacion)), action);
      return tr;
    }));
    renderIcons($('body'));
    $('range').textContent = `${result.start}–${result.end} de ${result.total}`;
    $('page-number').textContent = `${result.page} / ${result.pages}`;
    $('prev').disabled = result.page === 1;
    $('next').disabled = result.page === result.pages;
  }
  function syncControls() {
    for (const field of ['query', 'modelo', 'color', 'lote', 'estado']) $(field).value = filters[field];
    $('page-size').value = filters.pageSize;
  }
  function clear() {
    filters = {...DEFAULT_FILTERS, scope: filters.scope};
    syncControls(); render();
  }
  async function refresh() {
    const current = ++request;
    data = null;
    root.setAttribute('aria-busy', 'true');
    root.querySelectorAll('input, select, [data-scope], #inventory-clear').forEach(el => {el.disabled = true;});
    root.querySelectorAll('[data-count]').forEach(el => {el.textContent = '—';});
    $('subtitle').textContent = 'Consultando registros…';
    $('results-count').textContent = '';
    $('flight-note').textContent = 'Las ubicaciones corresponden al último vuelo registrado.';
    state('Cargando inventario…', 'Consultando el catálogo y las observaciones del último vuelo.');
    try {
      const response = await loadRegistry();
      if (current !== request) return;
      data = response; loaded = true;
      root.querySelectorAll('[data-count]').forEach(el => {el.textContent = data.conteos[el.dataset.count];});
      $('subtitle').textContent = `${data.conteos.registrados} vehículos registrados`;
      $('flight-note').textContent = data.vuelo
        ? `Último vuelo: ${data.vuelo.nombre} · ${observationDate(data.vuelo.fecha)} · ${data.conteos.observaciones} observaciones. La fecha es común a todo el vuelo.`
        : 'No hay vuelos registrados. Los vehículos del catálogo aún no tienen observación.';
      for (const field of ['modelo', 'color', 'lote']) {
        const labels = {modelo: 'Todos los modelos', color: 'Todos los colores', lote: 'Todos los lotes'};
        const options = [new Option(labels[field], ''), ...inventoryOptions(data.filas, field).map(value => new Option(field === 'lote' ? `Lote ${value}` : value, value)),
          new Option(field === 'lote' ? 'Sin ubicación' : 'Sin datos', '__missing')];
        $(field).replaceChildren(...options);
        if (!options.some(option => option.value === filters[field])) filters[field] = '';
      }
      syncControls(); render();
    } catch (error) {
      if (current !== request) return;
      loaded = false;
      $('subtitle').textContent = 'Inventario no disponible';
      state('No se pudo cargar el inventario', error.message, {retry: true});
    } finally {
      if (current === request) {
        root.setAttribute('aria-busy', 'false');
        root.querySelectorAll('input, select, [data-scope], #inventory-clear').forEach(el => {el.disabled = !data;});
      }
    }
  }
  $('filters').addEventListener('submit', event => event.preventDefault());
  for (const field of ['query', 'modelo', 'color', 'lote', 'estado']) {
    $(field).addEventListener(field === 'query' ? 'input' : 'change', () => {
      filters[field] = $(field).value; filters.page = 1; render();
    });
  }
  root.querySelectorAll('[data-scope]').forEach(button => button.addEventListener('click', () => {
    filters = {...DEFAULT_FILTERS, scope: button.dataset.scope}; syncControls(); render();
  }));
  root.querySelectorAll('[data-sort]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.sort;
    filters.direction = filters.sort === key && filters.direction === 'asc' ? 'desc' : 'asc';
    filters.sort = key; filters.page = 1; render();
  }));
  $('page-size').addEventListener('change', () => {filters.pageSize = Number($('page-size').value); filters.page = 1; render();});
  for (const [id, delta] of [['prev', -1], ['next', 1]]) $(id).addEventListener('click', () => {filters.page += delta; render();});
  $('clear').addEventListener('click', clear);
  $('empty-clear').addEventListener('click', clear);
  $('retry').addEventListener('click', refresh);
  document.getElementById('refresh-inventory').addEventListener('click', refresh);
  return {show: () => {if (!loaded && !data) refresh();}};
}
