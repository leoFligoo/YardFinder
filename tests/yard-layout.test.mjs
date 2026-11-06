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

test('street network connects both gates and every pickup stop without crossing parked cars', async () => {
  const {buildYardGeometry} = await import('../web/yard-geometry.js');
  const plan = buildYardGeometry(generateYard());
  assert.equal(plan.positions.length, 120);
  assert.equal(plan.roads.filter(r => r.id.startsWith('vertical')).length, 9);
  const nodes = new Map(plan.nodes.map(n => [n.id, n]));
  assert.equal(nodes.size, plan.nodes.length);
  const adjacency = new Map(plan.nodes.map(n => [n.id, []]));
  for (const edge of plan.edges) {
    const a = nodes.get(edge.from), b = nodes.get(edge.to);
    assert.ok(a && b);
    assert.ok(a.x === b.x || a.y === b.y, 'Street segment must be axis-aligned');
    assert.ok(edge.cost > 0);
    adjacency.get(a.id).push(b.id);
    if (edge.bidirectional) adjacency.get(b.id).push(a.id);
  }
  const reached = new Set([plan.entryNodeId]);
  const queue = [plan.entryNodeId];
  while (queue.length) for (const next of adjacency.get(queue.shift())) {
    if (!reached.has(next)) {reached.add(next); queue.push(next);}
  }
  assert.ok(reached.has(plan.exitNodeId));
  for (const p of plan.positions) {
    assert.ok(p.width > p.height, 'Cars must be horizontal');
    assert.ok(reached.has(p.accessNodeId), `${p.id} must be reachable from the entry`);
    assert.equal(nodes.get(p.accessNodeId).y, p.cy);
    for (const road of plan.roads) {
      const left = Math.min(road.x1, road.x2) - road.width / 2;
      const right = Math.max(road.x1, road.x2) + road.width / 2;
      const top = Math.min(road.y1, road.y2) - road.width / 2;
      const bottom = Math.max(road.y1, road.y2) + road.width / 2;
      const overlaps = p.cx + p.width/2 > left && p.cx - p.width/2 < right
        && p.cy + p.height/2 > top && p.cy - p.height/2 < bottom;
      assert.equal(overlaps, false, `${p.id} overlaps street ${road.id}`);
    }
  }
});
