#!/usr/bin/env node
/**
 * Yard Finder · Optimizador del itinerario del camión.
 *
 * Flujo previsto:  pedido en lenguaje natural → modelo de lenguaje → consulta a inventario.db
 *                  → posiciones de los vehículos pedidos → ESTE SCRIPT → hoja de ruta del camión.
 *
 * Entrada: los vehículos a cargar, cada uno con su posición en el yard. Se aceptan las dos formas que
 * circulan en el proyecto (ver inventario_ui.py y las columnas de la tabla `autos`):
 *     {"vin": "...", "posicion": {"loteId": 3, "x": 2, "y": 4}}
 *     {"vin": "...", "lote": 3, "pos_x": 2, "pos_y": 4}          (también "Lote 3" como texto)
 * como lista, o dentro de un objeto {"vehiculos": [...]}. Los demás campos (vin, modelo, color, tag…)
 * se devuelven sin cambios.
 *
 * Método: el plano sale de web/yard-geometry.js (calles, nodos, puertas de entrada/salida). Las distancias
 * se miden por las calles (Dijkstra), no en línea recta. El camión sale de la ENTRADA, pasa por la parada
 * de cada vehículo y termina en la SALIDA. Con capacidad ≤ 8 el orden de paradas es el ÓPTIMO exacto
 * (Held-Karp). Si se piden más autos que la capacidad, se reparten en varios viajes.
 *
 * Las distancias están en unidades del plano (coordenadas de dibujo), no en metros.
 *
 * Uso:   node optimizar_ruta.js vehiculos.json [--capacidad 8] [--json]       ("-" lee de stdin)
 */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {generateYard} from './web/yard-layout.js';
import {buildYardGeometry} from './web/yard-geometry.js';

export const CAPACIDAD_CAMION = 8;     // restricción del camión mosquito
const MAX_CAPACIDAD_EXACTA = 15;       // Held-Karp: 2^15 · 15 estados, instantáneo

// ── plano ──────────────────────────────────────────────────────────────────────────────────────────

export function construirGrafo(geometry = buildYardGeometry(generateYard())) {
  const nodos = new Map(geometry.nodes.map(n => [n.id, n]));
  const ady = new Map(geometry.nodes.map(n => [n.id, []]));
  for (const e of geometry.edges) {
    ady.get(e.from).push({a: e.to, costo: e.cost});
    if (e.bidirectional) ady.get(e.to).push({a: e.from, costo: e.cost});
  }
  return {geometry, nodos, ady, posiciones: new Map(geometry.positions.map(p => [p.id, p]))};
}

/** Distancias mínimas por calle desde `origen` a todos los nodos alcanzables. */
export function dijkstra(grafo, origen) {
  const dist = new Map([[origen, 0]]);
  const previo = new Map();
  const hechos = new Set();
  const pendientes = new Set([origen]);
  while (pendientes.size) {
    let u = null;
    for (const id of pendientes) if (u === null || dist.get(id) < dist.get(u)) u = id;
    pendientes.delete(u);
    hechos.add(u);
    for (const {a, costo} of grafo.ady.get(u)) {
      if (hechos.has(a)) continue;
      const d = dist.get(u) + costo;
      if (d < (dist.get(a) ?? Infinity)) {
        dist.set(a, d);
        previo.set(a, u);
        pendientes.add(a);
      }
    }
  }
  return {dist, previo};
}

function caminoHasta({previo}, origen, destino) {
  const ids = [destino];
  while (ids[0] !== origen) ids.unshift(previo.get(ids[0]));
  return ids;
}

// ── entrada ────────────────────────────────────────────────────────────────────────────────────────

function entero(valor) {
  const n = typeof valor === 'string' ? Number(valor.match(/(\d+)\s*$/)?.[1]) : valor;   // "Lote 3" → 3
  return Number.isInteger(n) ? n : NaN;
}

/** Valida y ubica cada vehículo en el plano. Falla con un mensaje claro si algo no corresponde al yard. */
export function normalizarVehiculos(entrada, grafo) {
  const lista = Array.isArray(entrada) ? entrada : (entrada?.vehiculos ?? entrada?.autos ?? entrada?.resultados);
  if (!Array.isArray(lista)) throw new Error('La entrada debe ser una lista de vehículos o un objeto con "vehiculos".');
  const vistos = new Set();
  return lista.map((vehiculo, i) => {
    const p = vehiculo?.posicion ?? vehiculo ?? {};
    const lote = entero(p.loteId ?? p.lote), x = entero(p.x ?? p.pos_x), y = entero(p.y ?? p.pos_y);
    const etiqueta = `Vehículo #${i + 1}${vehiculo?.vin ? ` (${vehiculo.vin})` : ''}`;
    if ([lote, x, y].some(Number.isNaN)) throw new Error(`${etiqueta}: falta una posición válida (lote, x, y).`);
    const posicion = grafo.posiciones.get(`L${lote}-X${x}-Y${y}`);
    if (!posicion) throw new Error(`${etiqueta}: la posición lote ${lote}, X${x}, Y${y} no existe (lotes 1-6, X 1-4, Y 1-5).`);
    if (vistos.has(posicion.id)) throw new Error(`${etiqueta}: la posición ${posicion.id} aparece repetida.`);
    vistos.add(posicion.id);
    return {vehiculo, posicion};
  });
}

// ── optimización ──────────────────────────────────────────────────────────────────────────────────

/** Orden de visita de costo mínimo inicio → todas las paradas → fin (Held-Karp, exacto). */
function ordenOptimo(dInicio, d, dFin) {
  const m = dInicio.length;
  if (m === 1) return [0];
  const N = 1 << m;
  const costo = Array.from({length: N}, () => new Float64Array(m).fill(Infinity));
  const padre = Array.from({length: N}, () => new Int8Array(m).fill(-1));
  for (let j = 0; j < m; j++) costo[1 << j][j] = dInicio[j];
  for (let mask = 1; mask < N; mask++) {
    for (let j = 0; j < m; j++) {
      if (!(mask & (1 << j)) || costo[mask][j] === Infinity) continue;
      for (let k = 0; k < m; k++) {
        if (mask & (1 << k)) continue;
        const siguiente = mask | (1 << k), c = costo[mask][j] + d[j][k];
        if (c < costo[siguiente][k]) {
          costo[siguiente][k] = c;
          padre[siguiente][k] = j;
        }
      }
    }
  }
  let ultimo = 0, mejor = Infinity;
  for (let j = 0; j < m; j++) {
    const c = costo[N - 1][j] + dFin[j];
    if (c < mejor) { mejor = c; ultimo = j; }
  }
  const orden = [];
  for (let mask = N - 1, j = ultimo; j !== -1; ) {
    orden.unshift(j);
    const previo = padre[mask][j];
    mask ^= 1 << j;
    j = previo;
  }
  return orden;
}

/**
 * Planifica el itinerario.
 * @param entrada  vehículos con posición (ver cabecera)
 * @param opciones {capacidad, inicio, fin, grafo}  inicio/fin: id de nodo; por defecto ENTRADA y SALIDA del plano
 */
export function planificarRuta(entrada, {capacidad = CAPACIDAD_CAMION, inicio, fin, grafo = construirGrafo()} = {}) {
  if (!Number.isInteger(capacidad) || capacidad < 2 || capacidad > MAX_CAPACIDAD_EXACTA) {
    throw new Error(`La capacidad debe ser un entero entre 2 y ${MAX_CAPACIDAD_EXACTA}.`);
  }
  inicio ??= grafo.geometry.entryNodeId;
  fin ??= grafo.geometry.exitNodeId;
  for (const id of [inicio, fin]) if (!grafo.nodos.has(id)) throw new Error(`El nodo "${id}" no existe en el plano.`);

  const cache = new Map();
  const desde = id => cache.get(id) ?? cache.set(id, dijkstra(grafo, id)).get(id);
  const distancia = (a, b) => {
    const d = desde(a).dist.get(b);
    if (d === undefined) throw new Error(`No hay camino por las calles entre ${a} y ${b}.`);
    return d;
  };

  // una parada por nodo de acceso (dos autos de la misma fila, columnas 2 y 3, se cargan desde el mismo punto)
  const porNodo = new Map();
  for (const item of normalizarVehiculos(entrada, grafo)) {
    const nodo = item.posicion.accessNodeId;
    if (!porNodo.has(nodo)) porNodo.set(nodo, {nodo, items: []});
    porNodo.get(nodo).items.push(item);
  }
  const paradas = [...porNodo.values()];
  const solicitados = paradas.reduce((n, p) => n + p.items.length, 0);

  const viajes = repartir(paradas, capacidad, inicio, distancia)
    .map((grupo, i) => resolverViaje(grupo, i + 1, {grafo, inicio, fin, desde, distancia}));
  return {
    capacidad, solicitados,
    distanciaTotal: viajes.reduce((s, v) => s + v.distanciaTotal, 0),
    distanciaOrdenOriginal: viajes.reduce((s, v) => s + v.distanciaOrdenOriginal, 0),
    viajes,
  };
}

/** Si hay más autos que capacidad: recorrido goloso por las calles y corte en tramos de a lo sumo `capacidad` autos. */
function repartir(paradas, capacidad, inicio, distancia) {
  if (paradas.reduce((n, p) => n + p.items.length, 0) <= capacidad) return paradas.length ? [paradas] : [];
  const pendientes = [...paradas], recorrido = [];
  let actual = inicio;
  while (pendientes.length) {
    let mejor = 0;
    pendientes.forEach((p, i) => { if (distancia(actual, p.nodo) < distancia(actual, pendientes[mejor].nodo)) mejor = i; });
    recorrido.push(...pendientes.splice(mejor, 1));
    actual = recorrido.at(-1).nodo;
  }
  const grupos = [[]];
  let cargados = 0;
  for (const p of recorrido) {
    if (cargados + p.items.length > capacidad) { grupos.push([]); cargados = 0; }
    grupos.at(-1).push(p);
    cargados += p.items.length;
  }
  return grupos;
}

function resolverViaje(paradas, numero, {grafo, inicio, fin, desde, distancia}) {
  const nodos = paradas.map(p => p.nodo);
  const orden = ordenOptimo(
    nodos.map(n => distancia(inicio, n)),
    nodos.map(a => nodos.map(b => distancia(a, b))),
    nodos.map(n => distancia(n, fin)));
  const costoDe = indices => [inicio, ...indices.map(i => nodos[i]), fin]
    .reduce((s, id, k, ids) => (k ? s + distancia(ids[k - 1], id) : 0), 0);

  const recorrido = [inicio, ...orden.map(i => nodos[i]), fin];
  const camino = [];
  for (let k = 1; k < recorrido.length; k++) {
    for (const id of caminoHasta(desde(recorrido[k - 1]), recorrido[k - 1], recorrido[k])) {
      if (camino.at(-1)?.id !== id) camino.push({id, x: grafo.nodos.get(id).x, y: grafo.nodos.get(id).y});
    }
  }
  let acumulada = 0;
  const salida = orden.map((i, k) => {
    const tramo = distancia(recorrido[k], nodos[i]);
    acumulada += tramo;
    const {x, y} = grafo.nodos.get(nodos[i]);
    return {
      orden: k + 1, nodoAcceso: nodos[i], acceso: {x, y},
      distanciaTramo: tramo, distanciaAcumulada: acumulada,
      vehiculos: paradas[i].items
        .sort((a, b) => a.posicion.id.localeCompare(b.posicion.id))
        .map(({vehiculo, posicion: p}) => ({
          ...vehiculo,
          posicion: {id: p.id, loteId: p.lotId, x: p.x, y: p.y, cx: p.cx, cy: p.cy},
        })),
    };
  });
  const distanciaTotal = costoDe(orden);
  const distanciaOrdenOriginal = costoDe(nodos.map((_, i) => i));
  return {
    numero, vehiculos: paradas.reduce((n, p) => n + p.items.length, 0),
    distanciaTotal, distanciaOrdenOriginal, ahorro: distanciaOrdenOriginal - distanciaTotal,
    paradas: salida,
    salida: {distanciaTramo: distancia(nodos[orden.at(-1)], fin), distanciaAcumulada: distanciaTotal},
    camino,
  };
}

// ── presentación ──────────────────────────────────────────────────────────────────────────────────

export function formatearHojaDeRuta(plan) {
  const u = n => `${Math.round(n)} u`;
  if (!plan.viajes.length) return 'No hay vehículos para cargar.';
  const lineas = [`HOJA DE RUTA · ${plan.solicitados} vehículo(s) · capacidad del camión ${plan.capacidad} · ${plan.viajes.length} viaje(s)`];
  for (const viaje of plan.viajes) {
    lineas.push('', `Viaje ${viaje.numero}/${plan.viajes.length} · ${viaje.vehiculos} vehículo(s) · ${u(viaje.distanciaTotal)} `
      + `(orden original: ${u(viaje.distanciaOrdenOriginal)}, ahorro ${u(viaje.ahorro)})`, '  ENTRADA');
    for (const p of viaje.paradas) {
      lineas.push(`  ${p.orden}. +${u(p.distanciaTramo)}  nodo ${p.nodoAcceso}`);
      for (const v of p.vehiculos) {
        const detalle = [v.modelo, v.color, v.vin && `VIN ${v.vin}`, v.tag != null && `tag ${v.tag}`].filter(Boolean).join(' · ');
        lineas.push(`       Lote ${v.posicion.loteId} · (${v.posicion.x},${v.posicion.y})  ${v.posicion.id}${detalle ? `  ${detalle}` : ''}`);
      }
    }
    lineas.push(`  SALIDA   +${u(viaje.salida.distanciaTramo)}`);
  }
  lineas.push('', `Distancia total: ${u(plan.distanciaTotal)} (unidades del plano)`);
  return lineas.join('\n');
}

function main(argv) {
  const args = argv.slice(2);
  const bandera = nombre => args.indexOf(nombre);
  const iCap = bandera('--capacidad');
  const capacidad = iCap === -1 ? CAPACIDAD_CAMION : Number(args[iCap + 1]);
  const archivo = args.find((a, i) => !a.startsWith('--') && (iCap === -1 || i !== iCap + 1));
  if (!archivo) {
    console.error('Uso: node optimizar_ruta.js vehiculos.json [--capacidad 8] [--json]   ("-" lee de stdin)');
    return 2;
  }
  try {
    const plan = planificarRuta(JSON.parse(readFileSync(archivo === '-' ? 0 : archivo, 'utf8')), {capacidad});
    console.log(bandera('--json') !== -1 ? JSON.stringify(plan, null, 2) : formatearHojaDeRuta(plan));
    return 0;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv);
