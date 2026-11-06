import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateYard, assignInventory, findPosition} from '../web/yard-layout.js';
import {vehicleDetailRows} from '../web/vehicle-detail.js';
import {inventoryImageUrl, normalizeInventory} from '../web/data.js';

const auto = {id:62, vuelo_id:1, posicion:{loteId:1,x:4,y:5}, tag:261,
  modelo:'Fiat Cronos Drive', color:'Beige', conf:0.721, recorte:'/api/patio/recortes/1/62'};

test('location determines identity regardless of IDs, input order or gaps', () => {
  const other = {...auto,id:124,posicion:{loteId:4,x:2,y:1}};
  const yard = assignInventory(generateYard(), [other,auto]);
  assert.equal(findPosition(yard,1,4,5).auto.id,62);
  assert.equal(findPosition(yard,4,2,1).auto.id,124);
  assert.equal(findPosition(yard,1,1,1).auto,null);
  assert.equal(yard.lots.flatMap(l=>l.positions).filter(p=>p.auto).length,2);
  assert.equal(Object.fromEntries(vehicleDetailRows(findPosition(yard,1,4,5),auto)).Confianza,'72 %');
  assignInventory(yard, []);
  assert.ok(yard.lots.flatMap(l=>l.positions).every(p=>p.auto===null));
});
test('detail shows stored coordinates, preserves tag zero and handles absent fields', () => {
  const rows = Object.fromEntries(vehicleDetailRows({lotId:1,x:4,y:5},{tag:0,conf:0}));
  assert.equal(rows.Coordenadas,'(4, 5)');
  assert.equal(rows.Sector,'Lote 1');
  assert.equal(rows.Tag,'0');
  assert.equal(rows.Confianza,'0 %');
  assert.equal(rows.VIN,'No identificado');
  assert.equal(rows.Patente,'No identificada');
});
test('reject duplicate or invalid positions instead of misplacing cars', () => {
  for (const posicion of [{loteId:7,x:1,y:1},{loteId:1,x:5,y:1},{loteId:1,x:1,y:0},null]) {
    assert.throws(()=>assignInventory(generateYard(),[{...auto,posicion}]),/posición/);
  }
  assert.throws(()=>assignInventory(generateYard(),[auto,{...auto,id:124}]),/misma posición/);
  assert.throws(()=>assignInventory(generateYard(),[auto,auto]),/duplicado/);
  assert.throws(()=>normalizeInventory({autos:[]}),/formato/);
});
test('crop URLs must match the exact flight and observation', () => {
  assert.equal(inventoryImageUrl(auto), '/api/patio/recortes/1/62');
  for (const recorte of ['https://external.invalid/image.jpg','/etc/passwd','/api/patio/recortes/2/62']) {
    assert.throws(()=>inventoryImageUrl({...auto,recorte}),/inválida/);
  }
});
