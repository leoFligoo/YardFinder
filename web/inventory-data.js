import {normalizeInventory} from './data.js';

const collator = new Intl.Collator('es', {numeric: true, sensitivity: 'base'});
const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
export const DEFAULT_FILTERS = Object.freeze({scope: 'registrados', query: '', modelo: '', color: '', lote: '', estado: '', sort: 'modelo', direction: 'asc', page: 1, pageSize: 10});

export function inventoryCounts(rows) {
  const registered = rows.filter(row => row.registrado);
  return {registrados: registered.length, ubicados: registered.filter(row => row.posicion).length,
    sin_observacion: registered.filter(row => !row.posicion).length,
    sin_identificar: rows.filter(row => !row.registrado).length,
    observaciones: rows.filter(row => row.posicion).length};
}

export function normalizeRegistry(raw) {
  if (!raw || raw.fuente !== 'sqlite' || !Array.isArray(raw.filas) || !raw.conteos) {
    throw new Error('La respuesta del inventario no tiene el formato esperado.');
  }
  const keys = new Set();
  for (const row of raw.filas) {
    if (typeof row.clave !== 'string' || keys.has(row.clave) || typeof row.registrado !== 'boolean'
        || row.estado !== (row.posicion ? 'ubicado' : 'sin_observacion') || (!row.registrado && !row.posicion)) {
      throw new Error('El inventario contiene registros inconsistentes.');
    }
    keys.add(row.clave);
  }
  normalizeInventory({fuente: 'sqlite', autos: raw.filas.filter(row => row.posicion)});
  const counts = inventoryCounts(raw.filas);
  if (Object.keys(counts).some(key => counts[key] !== raw.conteos[key])) {
    throw new Error('Los conteos del inventario no coinciden con sus registros.');
  }
  return raw;
}

export async function loadRegistry() {
  const response = await fetch('/api/inventario', {cache: 'no-store'});
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `No se pudo leer el inventario (HTTP ${response.status}).`);
  }
  return normalizeRegistry(await response.json());
}

export function queryInventory(rows, options = {}) {
  const f = {...DEFAULT_FILTERS, ...options};
  const q = fold(f.query.trim());
  const filtered = rows.filter(row => {
    if (row.registrado !== (f.scope === 'registrados')) return false;
    if (f.modelo && (row.modelo || '__missing') !== f.modelo) return false;
    if (f.color && (row.color || '__missing') !== f.color) return false;
    if (f.lote && (row.posicion ? String(row.posicion.loteId) : '__missing') !== f.lote) return false;
    if (f.estado && row.estado !== f.estado) return false;
    return !q || [row.vin, row.tag, row.modelo, row.color, row.id,
      row.id == null ? '' : `#${String(row.id).padStart(3, '0')}`].some(value => fold(value).includes(q));
  });
  const sortValue = row => f.sort === 'lote' ? row.posicion?.loteId : row[f.sort];
  filtered.sort((a, b) => {
    const av = sortValue(a), bv = sortValue(b);
    // Missing data stays last in either direction. Ties have a stable unique key.
    if (av == null || av === '') return bv == null || bv === '' ? collator.compare(a.clave, b.clave) : 1;
    if (bv == null || bv === '') return -1;
    return collator.compare(String(av), String(bv)) * (f.direction === 'desc' ? -1 : 1)
      || collator.compare(a.clave, b.clave);
  });
  const pageSize = [10, 25, 50].includes(Number(f.pageSize)) ? Number(f.pageSize) : 10;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pages, Math.max(1, Math.trunc(Number(f.page) || 1)));
  const start = (page - 1) * pageSize;
  return {rows: filtered.slice(start, start + pageSize), total: filtered.length, page, pages,
    start: filtered.length ? start + 1 : 0, end: Math.min(start + pageSize, filtered.length)};
}

export function inventoryOptions(rows, field) {
  return [...new Set(rows.map(row => field === 'lote' ? row.posicion?.loteId : row[field])
    .filter(value => value != null && value !== ''))].sort((a, b) => collator.compare(String(a), String(b)));
}

export function observationDate(value) {
  // Keep the stored calendar date: never infer individual times or shift timezones.
  if (!value) return 'Sin observación';
  const match = /^(\d{4})[-:](\d{2})[-:](\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value);
}
