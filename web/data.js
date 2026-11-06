// The rest of the UI only consumes this normalized snapshot. A live adapter can
// replace loadPatio later without coupling screen components to API response shapes.
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
export async function loadPatio() {
  const response = await fetch('/ui/data/patio.json', {cache: 'no-store'});
  if (!response.ok) throw new Error(`No se pudo leer el ejemplo local (HTTP ${response.status}).`);
  return normalizePatio(await response.json());
}
