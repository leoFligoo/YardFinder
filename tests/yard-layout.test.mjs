import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findPosition, generateYard} from '../web/yard-layout.js';

test('six independent lots have 20 unique positions, four columns and five rows', () => {
  const yard = generateYard();
  assert.equal(yard.capacity, 120);
  assert.equal(yard.lots.length, 6);
  const all = yard.lots.flatMap(lot => lot.positions);
  assert.equal(new Set(all.map(p => p.id)).size, 120);
  for (const lot of yard.lots) {
    assert.equal(lot.capacity, 20);
    assert.equal(lot.positions.length, 20);
    assert.equal(new Set(lot.positions.map(p => `${p.x},${p.y}`)).size, 20);
    assert.deepEqual([...new Set(lot.positions.map(p => p.x))], [1,2,3,4]);
    assert.deepEqual([...new Set(lot.positions.map(p => p.y))], [1,2,3,4,5]);
    assert.ok(lot.positions.every(p => p.lotId === lot.id));
    assert.ok(lot.positions.every(p => !('lat' in p) && !('lon' in p)));
  }
});
test('lot is part of an address; out-of-bounds coordinates do not resolve', () => {
  const yard = generateYard();
  assert.equal(findPosition(yard,3,2,4).id, 'L3-X2-Y4');
  assert.notEqual(findPosition(yard,1,1,1).id, findPosition(yard,2,1,1).id);
  for(const [lot,x,y] of [[0,1,1],[7,1,1],[1,0,1],[1,5,1],[1,1,6],[1,1.5,1]]) {
    assert.equal(findPosition(yard,lot,x,y), null);
  }
});
test('invalid layout dimensions are rejected', () => {
  for (const columns of [0,-1,1.5,NaN,Infinity]) {
    assert.throws(()=>generateYard({lotCount:6,columns,rows:5}), /dimensiones/);
  }
});
