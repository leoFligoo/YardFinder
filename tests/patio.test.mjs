import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assetUrl, filterVehicles, hasLocation, normalizePatio, summarize} from '../web/data.js';

const snapshot = JSON.parse(readFileSync(new URL('../web/data/patio.json', import.meta.url)));
test('local fixture matches its original export without changed coordinates', () => {
  const source = readFileSync(new URL('../ejemplo_resultado/mapa.html', import.meta.url), 'utf8');
  // The original embeds a one-line JSON object in the map template.
  const original = JSON.parse(source.split('const D =')[1].split(';\n')[0]);
  assert.deepEqual(snapshot.autos, original.autos);
  assert.deepEqual(snapshot.huellas, original.huellas);
  assert.deepEqual(snapshot.lotes, original.lotes);
  assert.deepEqual(summarize(normalizePatio(snapshot)), {total:123, located:123, missing:0, outside:25, sectors:5, tags:12});
});
test('located outside a sector is different from missing location; tag zero is identified', () => {
  const autos = [{id:1, lat:0, lon:0, lote:null, tag:0}, {id:2, lat:null, lon:null}, {id:3, lat:91, lon:0}];
  assert.deepEqual(summarize({autos, lotes:[]}), {total:3, located:1, missing:2, outside:1, sectors:0, tags:1});
  assert.equal(hasLocation({lat:NaN, lon:0}), false);
  assert.deepEqual(filterVehicles(autos,{sector:'__outside'}).map(a=>a.id), [1]);
});
test('search handles padded ID, tag zero, case-insensitive VIN and combined sector filter', () => {
  const autos = [{id:42,tag:0,vin:'ABCxyz',lote:'Lote A'}, {id:43,tag:9,lote:'Lote B'}];
  assert.equal(filterVehicles(autos,{query:' #042 '})[0].id,42);
  assert.equal(filterVehicles(autos,{query:'abcXYZ'})[0].id,42);
  assert.equal(filterVehicles(autos,{query:'0'})[0].id,42);
  assert.equal(filterVehicles(autos,{query:'42',sector:'Lote B'}).length,0);
  assert.equal(filterVehicles(autos,{query:'inexistente'}).length,0);
});
test('empty inventory is valid; malformed datasets fail with a user-facing error', () => {
  assert.equal(summarize(normalizePatio({autos:[],lotes:[],huellas:[]})).total,0);
  assert.throws(()=>normalizePatio({}), /formato/);
  assert.throws(()=>normalizePatio({autos:[{id:1},{id:1}],lotes:[],huellas:[]}), /únicos/);
  assert.throws(()=>normalizePatio({autos:[],lotes:[{nombre:'bad',anillo:[]}],huellas:[]}), /geometría/);
});
test('image references cannot escape the local asset mount', () => {
  assert.equal(assetUrl('recortes/auto_0001.jpg'), '/demo-assets/recortes/auto_0001.jpg');
  for(const value of ['https://example.com/image.png','../config.json','recortes/../../secret.jpg','ortofotos/a.svg']) {
    assert.throws(()=>assetUrl(value), /inválida/);
  }
});
