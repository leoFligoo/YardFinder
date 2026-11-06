import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changeSelection, coordinatesLabel} from '../web/vehicle-list.js';
import {filterVehicles} from '../web/data.js';
const autos = Array.from({length:10}, (_, i) => ({id:i+1}));

test('dispatch never exceeds eight vehicles and supports removing and replacing one', () => {
  let ids = [];
  for (let id=1; id<=8; id++) ids = changeSelection(autos, ids, id, true).ids;
  assert.equal(ids.length,8);
  assert.match(changeSelection(autos,ids,9,true).error,/hasta 8/);
  assert.equal(changeSelection(autos,ids,8,true).ids.length,8);
  ids = changeSelection(autos,ids,3,false).ids;
  ids = changeSelection(autos,ids,9,true).ids;
  assert.deepEqual(ids,[1,2,4,5,6,7,8,9]);
  assert.match(changeSelection(autos,ids,99,true).error,/encontrados/);
});
test('filtering does not mutate the dispatch shortlist', () => {
  const ids = [1,2,3];
  assert.equal(filterVehicles(autos,{query:'10'}).length,1);
  assert.deepEqual(changeSelection(autos,ids,10,true).ids,[1,2,3,10]);
  assert.deepEqual(ids,[1,2,3]);
});
test('local XY must include a valid lot and remain distinct from GPS', () => {
  assert.equal(coordinatesLabel({posicion:{loteId:3,x:2,y:4}}),'Lote 3 · (2,4)');
  for(const auto of [{lat:-34,lon:-58},{posicion:{loteId:7,x:1,y:1}},{posicion:{loteId:1,x:5,y:1}}]) {
    assert.equal(coordinatesLabel(auto),'Posición X/Y sin vincular');
  }
});
test('list searches model, color and plate as well as tag zero', () => {
  const cars = [{id:1,modelo:'Cronos',color:'Blanco',patente:'AB123CD',tag:0}];
  for(const query of ['cronos','BLANCO','ab123cd','0']) assert.equal(filterVehicles(cars,{query}).length,1);
});
