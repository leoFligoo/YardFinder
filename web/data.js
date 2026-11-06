// The patio loads SQLite through the local API. Legacy export helpers remain
// available for the original photographic example, never as a fallback.
export const TRUCK_CAPACITY = 8;
export function hasLocation(auto) {
  return Number.isFinite(auto.lat) && Number.isFinite(auto.lon)
    && Math.abs(auto.lat) <= 90 && Math.abs(auto.lon) <= 180;
}
export function summarize(data) {
  return {
    total: data.autos.length,
    located: data.autos.filter(hasLocation).length,
    missing: data.autos.filter(a => !hasLocation(a)).length,
    outside: data.autos.filter(a => hasLocation(a) && !a.lote).length,
    sectors: data.lotes.length,
    tags: data.autos.filter(a => a.tag !== null && a.tag !== undefined).length,
  };
}
export function filterVehicles(autos, {query = '', sector = ''} = {}) {
  const q = query.trim().toLocaleLowerCase('es');
  return autos.filter(a => {
    const sectorMatch = !sector || (sector === '__outside' ? hasLocation(a) && !a.lote : a.lote === sector);
    const searchMatch = !q || [a.vin, a.tag, a.patente, a.modelo, a.color, a.id, `#${String(a.id).padStart(3, '0')}`]
      .some(value => value != null && String(value).toLocaleLowerCase('es').includes(q));
    return sectorMatch && searchMatch;
  });
}
export function normalizePatio(raw) {
  if (!raw || !['autos', 'lotes', 'huellas'].every(k => Array.isArray(raw[k]))) {
    throw new Error('El archivo local no tiene el formato esperado.');
  }
  const ids = new Set();
  for (const auto of raw.autos) {
    if (!Number.isInteger(auto.id) || ids.has(auto.id)) throw new Error('Los vehículos necesitan IDs únicos.');
    ids.add(auto.id);
  }
  const point = p => Array.isArray(p) && p.length === 2 && hasLocation({lat: p[0], lon: p[1]});
  if (raw.lotes.some(l => typeof l.nombre !== 'string' || !Array.isArray(l.anillo) || l.anillo.length < 3 || !l.anillo.every(point))) {
    throw new Error('La geometría de los sectores es inválida.');
  }
  if (raw.huellas.some(h => !h.orto || !point(h.orto.sw) || !point(h.orto.ne))) {
    throw new Error('Faltan los límites de las imágenes cenitales.');
  }
  raw.huellas.forEach(h => assetUrl(h.orto.archivo));
  return {...raw, meta: {...raw.meta, assetBase: '/demo-assets/'}};
}
export function assetUrl(path) {
  if (typeof path !== 'string' || !/^(ortofotos|recortes)\/[\w.-]+\.(png|jpe?g)$/i.test(path)) {
    throw new Error('Referencia de imagen local inválida.');
  }
  return `/demo-assets/${path}`;
}
export function normalizeInventory(raw) {
  if (!raw || raw.fuente !== 'sqlite' || !Array.isArray(raw.autos)) {
    throw new Error('La respuesta del inventario no tiene el formato esperado.');
  }
  const ids = new Set(), positions = new Set();
  for (const auto of raw.autos) {
    const p = auto.posicion;
    if (!Number.isInteger(auto.id) || ids.has(auto.id)) throw new Error('Identificador de auto inválido o duplicado.');
    if (!p || ![p.loteId, p.x, p.y].every(Number.isInteger)
        || p.loteId < 1 || p.loteId > 6 || p.x < 1 || p.x > 4 || p.y < 1 || p.y > 5) {
      throw new Error('El auto no tiene una posición válida de lote/X/Y.');
    }
    const key = `${p.loteId}:${p.x}:${p.y}`;
    if (positions.has(key)) throw new Error('Dos autos ocupan la misma posición.');
    ids.add(auto.id); positions.add(key);
  }
  return raw;
}
export function inventoryImageUrl(auto) {
  const expected = `/api/patio/recortes/${auto.vuelo_id}/${auto.id}`;
  if (!Number.isInteger(auto.vuelo_id) || !Number.isInteger(auto.id) || auto.recorte !== expected) {
    throw new Error('Referencia de recorte inválida.');
  }
  return expected;
}
export async function fetchInventory(path) {
  const response = await fetch(path, {cache: 'no-store'});
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `No se pudo leer el inventario (HTTP ${response.status}).`);
  }
  return response.json();
}
export function formatFlightDate(value) {
  if (typeof value !== 'string') return 'fecha no disponible';
  const match = value.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return 'fecha no disponible';
  const [, year, month, day, hour, minute, second] = match;
  if (+hour > 23 || +minute > 59 || +second > 59) return 'fecha no disponible';
  const date = new Date(+year, +month - 1, +day, +hour, +minute, +second);
  if (date.getFullYear() !== +year || date.getMonth() !== +month - 1 || date.getDate() !== +day) {
    return 'fecha no disponible';
  }
  return new Intl.DateTimeFormat('es-AR', {dateStyle: 'medium', timeStyle: 'short'}).format(date);
}
export const loadPatio = async () => normalizeInventory(await fetchInventory('/api/patio'));
