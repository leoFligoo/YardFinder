// data.js — Orden de retiro ACTIVA de la PWA del chofer, desde el backend.
//
// Ya no hay inventario mockeado: se consume /api/despacho/orden/activa, que sale
// de inventario.db (la misma base que el panel del operador). El operador genera
// la orden desde "Planificar por chat"; acá la leemos y marcamos los retiros.

export const PATIO = {
  nombre: 'Playón Central',
  sectores: 6,            // sectores/lotes 1..6, como en la vista del operador
};

// Mapea un auto del backend al modelo que usa la UI de la PWA.
function mapAuto(a) {
  const x = a.pos ? a.pos.x : null;
  const y = a.pos ? a.pos.y : null;
  return {
    tag: a.tag,
    auto_id: a.auto_id,
    vin: a.vin || '—',
    modelo: a.modelo || `Tag #${a.tag != null ? a.tag : '—'}`,
    color: a.color || '—',
    patente: '—',                         // inventario.db no guarda patente
    sector: a.lote,                       // lote = sector
    fila: y != null ? String(y) : '—',    // usamos pos_y como "fila"
    pos: x != null ? x : '—',             // y pos_x como "posición"
    recorte: a.recorte,
    estado: a.retirado ? 'retirado' : 'a_retirar',
  };
}

// Carga la orden activa. Devuelve {autos, orden} o null si no hay ninguna.
export async function cargarOrden() {
  const resp = await fetch('/api/despacho/orden/activa', { cache: 'no-store' });
  if (!resp.ok) throw new Error(`No se pudo leer la orden (HTTP ${resp.status}).`);
  const { orden } = await resp.json();
  if (!orden) return null;
  const autos = orden.autos.map(mapAuto);
  const recorrido = orden.autos.slice()
    .sort((a, b) => a.recorrido - b.recorrido)
    .map(a => a.tag);
  return {
    autos,
    orden: {
      id: orden.codigo,
      destino: orden.destino || '—',
      transportista: orden.transportista || '—',
      estado: orden.estado,
      recorrido,
    },
  };
}

// Marca un auto como retirado en el backend (actualiza autos.retirado en inventario.db).
export async function retirarEnBackend(tag) {
  const resp = await fetch('/api/despacho/retiro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag }),
  });
  return resp.json();
}
