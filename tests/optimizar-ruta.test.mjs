import {test} from 'node:test';
import assert from 'node:assert/strict';
import {construirGrafo, dijkstra, normalizarVehiculos, planificarRuta, formatearHojaDeRuta} from '../optimizar_ruta.js';

const grafo = construirGrafo();
const todas = [...grafo.posiciones.values()];
const auto = (id, extra = {}) => {
  const p = grafo.posiciones.get(id);
  return {vin: `VIN-${id}`, posicion: {loteId: p.lotId, x: p.x, y: p.y}, ...extra};
};
// generador pseudoaleatorio con semilla fija: los tests son deterministas
const rng = (semilla) => () => (semilla = (semilla * 1664525 + 1013904223) % 4294967296) / 4294967296;
const elegir = (n, semilla) => {
  const r = rng(semilla), pool = [...todas];
  return Array.from({length: n}, () => pool.splice(Math.floor(r() * pool.length), 1)[0]);
};
const permutaciones = (a) => a.length <= 1 ? [a] : a.flatMap((x, i) => permutaciones([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));

test('el plano es conexo: entrada y salida alcanzan las 120 posiciones', () => {
  const {entryNodeId, exitNodeId} = grafo.geometry;
  const {dist} = dijkstra(grafo, entryNodeId);
  assert.ok(dist.has(exitNodeId));
  assert.equal(todas.filter(p => !dist.has(p.accessNodeId)).length, 0);
});

test('un solo auto: entrada → calle del auto → salida, con distancia calculada a mano', () => {
  // L1-X1-Y1 se carga desde la calle x=70, y=190. 80 (puerta→calle sur) + 570 (subir) + 570 (bajar)
  // + 1108 (calle sur hasta x=1178) + 80 (puerta de salida) = 2408
  const plan = planificarRuta([auto('L1-X1-Y1')]);
  assert.equal(plan.viajes.length, 1);
  assert.equal(plan.distanciaTotal, 2408);
  assert.equal(plan.viajes[0].paradas[0].nodoAcceso, 'road-70-190');
  const ids = plan.viajes[0].camino.map(n => n.id);
  assert.equal(ids[0], grafo.geometry.entryNodeId);
  assert.equal(ids.at(-1), grafo.geometry.exitNodeId);
});

test('el orden es óptimo: coincide con la mejor permutación por fuerza bruta', () => {
  for (const semilla of [1, 2, 3, 4, 5]) {
    const posiciones = elegir(6, semilla);
    const plan = planificarRuta(posiciones.map(p => auto(p.id)));
    const nodos = [...new Set(posiciones.map(p => p.accessNodeId))];
    const d = (a, b) => dijkstra(grafo, a).dist.get(b);
    const costo = ord => [grafo.geometry.entryNodeId, ...ord, grafo.geometry.exitNodeId]
      .reduce((s, id, k, ids) => (k ? s + d(ids[k - 1], id) : 0), 0);
    const mejor = Math.min(...permutaciones(nodos).map(costo));
    assert.equal(plan.distanciaTotal, mejor, `semilla ${semilla}`);
  }
});

test('nunca es peor que visitar en el orden recibido, y suele mejorarlo', () => {
  let ahorros = 0;
  for (const semilla of [11, 12, 13, 14, 15, 16]) {
    const plan = planificarRuta(elegir(8, semilla).map(p => auto(p.id)));
    assert.ok(plan.distanciaTotal <= plan.distanciaOrdenOriginal);
    ahorros += plan.viajes[0].ahorro;
  }
  assert.ok(ahorros > 0);
});

test('dos autos de la misma fila, columnas 2 y 3, se cargan en una sola parada', () => {
  const plan = planificarRuta([auto('L1-X2-Y3'), auto('L1-X3-Y3')]);
  const [parada, ...resto] = plan.viajes[0].paradas;
  assert.equal(resto.length, 0);
  assert.equal(parada.vehiculos.length, 2);
  assert.equal(plan.viajes[0].vehiculos, 2);
});

test('más autos que la capacidad: varios viajes, cada auto una sola vez, ninguno sobrecargado', () => {
  const pedidos = elegir(19, 7).map(p => auto(p.id));
  const plan = planificarRuta(pedidos, {capacidad: 8});
  assert.ok(plan.viajes.length >= 3);
  for (const v of plan.viajes) assert.ok(v.vehiculos <= 8);
  const cargados = plan.viajes.flatMap(v => v.paradas.flatMap(p => p.vehiculos.map(a => a.vin)));
  assert.deepEqual([...cargados].sort(), pedidos.map(a => a.vin).sort());
  assert.equal(plan.distanciaTotal, plan.viajes.reduce((s, v) => s + v.distanciaTotal, 0));
});

test('acepta la forma de la UI, las columnas de la base y "Lote N" como texto, y conserva los demás campos', () => {
  const items = normalizarVehiculos({vehiculos: [
    {vin: 'A', modelo: 'Corolla', posicion: {loteId: 3, x: 2, y: 4}},
    {vin: 'B', lote: 3, pos_x: 1, pos_y: 1},
    {vin: 'C', lote: 'Lote 5', pos_x: '4', pos_y: '5'},
  ]}, grafo);
  assert.deepEqual(items.map(i => i.posicion.id), ['L3-X2-Y4', 'L3-X1-Y1', 'L5-X4-Y5']);
  const plan = planificarRuta([{vin: 'A', modelo: 'Corolla', color: 'blanco', lote: 3, pos_x: 2, pos_y: 4}]);
  const v = plan.viajes[0].paradas[0].vehiculos[0];
  assert.equal(v.modelo, 'Corolla');
  assert.equal(v.color, 'blanco');
  assert.equal(v.posicion.id, 'L3-X2-Y4');
});

test('rechaza posiciones inexistentes, repetidas o ausentes y capacidades inválidas', () => {
  assert.throws(() => planificarRuta([{vin: 'X', lote: 7, pos_x: 1, pos_y: 1}]), /no existe/);
  assert.throws(() => planificarRuta([{vin: 'X', lote: 1, pos_x: 5, pos_y: 1}]), /no existe/);
  assert.throws(() => planificarRuta([auto('L1-X1-Y1'), auto('L1-X1-Y1', {vin: 'otro'})]), /repetida/);
  assert.throws(() => planificarRuta([{vin: 'X', modelo: 'Corolla'}]), /posición válida/);
  assert.throws(() => planificarRuta({sinLista: true}), /lista de vehículos/);
  assert.throws(() => planificarRuta([auto('L1-X1-Y1')], {capacidad: 1}), /capacidad/);
});

test('sin vehículos no hay viajes, y la hoja de ruta lo dice', () => {
  const plan = planificarRuta([]);
  assert.deepEqual(plan.viajes, []);
  assert.match(formatearHojaDeRuta(plan), /No hay vehículos/);
});

test('la hoja de ruta lista cada auto con su lote y posición', () => {
  const texto = formatearHojaDeRuta(planificarRuta([auto('L3-X2-Y4', {modelo: 'Corolla', color: 'blanco'})]));
  assert.match(texto, /Lote 3 · \(2,4\)/);
  assert.match(texto, /L3-X2-Y4/);
  assert.match(texto, /Corolla · blanco/);
});
