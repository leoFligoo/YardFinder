import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_FILTERS, inventoryCounts, normalizeRegistry, queryInventory, inventoryOptions, observationDate, loadRegistry} from '../web/inventory-data.js';
import {parseRoute, patioLink} from '../web/router.js';
import {loadPatio} from '../web/data.js';

const located = {clave:'vehiculo:261', registrado:true, id:62, vuelo_id:1, tag:261,
  modelo:'Fiat Cronos Drive', color:'Beige', vin:'VIN62', posicion:{loteId:1,x:4,y:5},
  estado:'ubicado', ultima_observacion:'2026:10:14 10:00:00'};
const missing = {...located, clave:'vehiculo:0', id:null, vuelo_id:null, tag:0, modelo:'Ágil', color:'Blanco',
  posicion:null, estado:'sin_observacion', ultima_observacion:null};
const unidentified = {...located, clave:'observacion:1:124', registrado:false, id:124, tag:null,
  vin:null, modelo:null, color:null, posicion:{loteId:5,x:2,y:3}};
const rows = [located, missing, unidentified];

test('counts separate registry from observations and validate server totals', () => {
  const conteos = inventoryCounts(rows);
  assert.deepEqual(conteos, {registrados:2, ubicados:1, sin_observacion:1, sin_identificar:1, observaciones:2});
  assert.equal(normalizeRegistry({fuente:'sqlite', filas:rows, conteos}).filas.length, 3);
  assert.throws(() => normalizeRegistry({fuente:'sqlite',filas:rows,conteos:{...conteos, registrados:3}}), /conteos/);
  assert.throws(() => normalizeRegistry({fuente:'sqlite',filas:[...rows,located],conteos}), /inconsistentes/);
  assert.throws(() => normalizeRegistry({fuente:'sqlite',filas:[{...unidentified,posicion:null}],conteos}), /inconsistentes/);
  assert.equal(normalizeRegistry({fuente:'sqlite',filas:[],conteos:inventoryCounts([])}).filas.length, 0);
});
test('registry includes missing observations by default, unknowns have their own view', () => {
  assert.equal(queryInventory(rows).total, 2);
  assert.equal(queryInventory(rows,{scope:'sin_identificar'}).rows[0].id,124);
  assert.deepEqual(queryInventory(rows,{estado:'sin_observacion'}).rows,[missing]);
  assert.deepEqual(queryInventory(rows,{lote:'__missing'}).rows,[missing]);
  assert.deepEqual(queryInventory(rows,{scope:'sin_identificar',modelo:'__missing'}).rows,[unidentified]);
});
test('search combines exact filters and handles accents, VIN, padded ID, tag zero', () => {
  for (const query of [' crONos ', 'vin62', '#062', '261']) {
    assert.deepEqual(queryInventory(rows,{query,modelo:located.modelo,color:'Beige',lote:'1',estado:'ubicado'}).rows,[located]);
  }
  assert.deepEqual(queryInventory(rows,{query:'agil'}).rows,[missing]);
  assert.deepEqual(queryInventory([missing],{query:'0'}).rows,[missing]);
  assert.equal(queryInventory(rows,{query:'not-found'}).total,0);
  assert.equal(queryInventory(rows,{color:'Rojo',modelo:located.modelo}).total,0);
  assert.deepEqual(inventoryOptions(rows,'lote'),[1,5]);
  assert.deepEqual(queryInventory(rows,{...DEFAULT_FILTERS}).rows,[missing,located]);
});
test('sorting is numeric, deterministic, nonmutating and keeps absent dates last', () => {
  const values = [10,2,1].map(tag=>({...located,tag,clave:`vehiculo:${tag}`}));
  assert.deepEqual(queryInventory(values,{sort:'tag'}).rows.map(row=>row.tag),[1,2,10]);
  assert.deepEqual(queryInventory(values,{sort:'tag',direction:'desc'}).rows.map(row=>row.tag),[10,2,1]);
  assert.deepEqual(values.map(row=>row.tag),[10,2,1]);
  for (const direction of ['asc','desc']) assert.equal(queryInventory(rows,{sort:'ultima_observacion',direction}).rows.at(-1),missing);
});
test('pagination clamps on shrinking results without omissions or duplicate rows', () => {
  const values = Array.from({length:26},(_,tag)=>({...located,tag,clave:`vehiculo:${tag}`}));
  const result = queryInventory(values,{sort:'tag',page:2});
  assert.equal(result.start,11); assert.equal(result.end,20); assert.equal(result.pages,3);
  assert.deepEqual(result.rows.map(row=>row.tag),Array.from({length:10},(_,i)=>i+10));
  assert.equal(queryInventory(values,{page:99}).page,3);
  assert.equal(queryInventory(values,{pageSize:25,page:2}).rows.length,1);
  assert.equal(queryInventory(values,{query:'no match',page:3}).page,1);
  assert.equal(queryInventory([]).start,0);
});
test('flight dates preserve calendar date and links use observation identity, never XY', () => {
  assert.equal(observationDate(located.ultima_observacion),'14/10/2026');
  assert.equal(observationDate('2026-10-14T00:00:00Z'),'14/10/2026');
  assert.equal(observationDate(null),'Sin observación');
  assert.equal(patioLink(located),'#/patio?vuelo=1&auto=62');
  assert.equal(patioLink(missing),null);
  assert.deepEqual(parseRoute(patioLink(located)),{page:'patio',vuelo:1,auto:62});
  assert.deepEqual(parseRoute('#/inventario'),{page:'inventario'});
  assert.deepEqual(parseRoute('#contenido'),{page:null});
  assert.equal(parseRoute('#/patio?auto=invalid&vuelo=1').auto,null);
  assert.equal(parseRoute('#/unknown').page,'patio');
});
test('shared HTTP loader handles JSON and non-JSON errors for both local APIs', async () => {
  const previous = globalThis.fetch;
  try {
    for (const [load, path] of [[loadRegistry,'/api/inventario'], [loadPatio,'/api/patio']]) {
      globalThis.fetch = async (url, options) => {
        assert.equal(url,path); assert.equal(options.cache,'no-store');
        return {ok:false,status:503,json:async()=>({error:'SQLite no disponible'})};
      };
      await assert.rejects(load,/SQLite no disponible/);
      globalThis.fetch = async () => ({ok:false,status:502,json:async()=>{throw new SyntaxError('HTML');}});
      await assert.rejects(load,/HTTP 502/);
    }
    globalThis.fetch = async () => ({ok:true,json:async()=>({fuente:'sqlite',autos:[located]})});
    assert.equal((await loadPatio()).autos[0].id,62);
    globalThis.fetch = async () => ({ok:true,json:async()=>({fuente:'sqlite',filas:rows,conteos:inventoryCounts(rows)})});
    assert.equal((await loadRegistry()).filas.length,3);
  } finally {globalThis.fetch = previous;}
});
