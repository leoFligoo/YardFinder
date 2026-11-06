import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateYard} from '../web/yard-layout.js';
import {demoVehicleId, vehicleDetailRows} from '../web/vehicle-detail.js';

test('explicit demo assignments are unique and resolve the existing photo observations', () => {
  const data = JSON.parse(readFileSync(new URL('../web/data/patio.json', import.meta.url)));
  const ids = generateYard().lots.flatMap(l => l.positions.map(demoVehicleId));
  assert.equal(new Set(ids).size, 120);
  assert.ok(ids.every(id => data.autos.some(a => a.id === id)));
  assert.equal(demoVehicleId({lotId:4,x:2,y:1}),62);
  const auto = data.autos.find(a => a.id === 62);
  assert.equal(Object.fromEntries(vehicleDetailRows({lotId:4,x:2,y:1},auto)).Confianza,'80 %');
});
test('detail distinguishes simulated coordinates from source attributes and handles missing values', () => {
  const position = {lotId:4,x:2,y:1};
  const rows = Object.fromEntries(vehicleDetailRows(position,{tag:0,conf:0}));
  assert.equal(rows.Coordenadas,'(2, 1) · Simuladas');
  assert.equal(rows.Sector,'Lote 4');
  assert.equal(rows.Tag,'0');
  assert.equal(rows.Confianza,'0 %');
  assert.equal(rows.VIN,'No identificado');
  assert.equal(rows.Patente,'No identificada');
  assert.equal(rows.Modelo,'Sin datos');
  assert.equal(Object.fromEntries(vehicleDetailRows(position,{conf:NaN})).Confianza,'Sin datos');
});
test('invalid positions cannot be associated to an unrelated observation', () => {
  for(const position of [{lotId:0,x:1,y:1},{lotId:7,x:1,y:1},{lotId:1,x:5,y:1},{lotId:1,x:1,y:6}]) {
    assert.throws(()=>demoVehicleId(position),/inválida/);
  }
});
