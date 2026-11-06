// Drawing coordinates, not GPS or meters. Both the map and future routing use
// this topology, so pickup stops stay on streets instead of crossing parked cars.
export function buildYardGeometry(yard) {
  if (yard.lots.length !== 6 || yard.lots.some(l => l.columns !== 4 || l.rows !== 5)) {
    throw new Error('El plano requiere 6 lotes con 4 columnas y 5 filas.');
  }
  const width = 1248, height = 900, laneWidth = 36;
  const crossYs = [100, 430, 760];
  const slotYs = [190, 232, 274, 316, 358, 520, 562, 604, 646, 688];
  const laneXs = Array.from({length: 3}, (_, col) => [70, 240, 410].map(x => x + col * 384)).flat();
  const nodeId = (x, y) => `road-${x}-${y}`;
  const nodes = [], edges = [], roads = [];
  const addEdge = (a, b) => edges.push({from: nodeId(a.x, a.y), to: nodeId(b.x, b.y),
    cost: Math.hypot(b.x - a.x, b.y - a.y), bidirectional: true});
  for (const x of laneXs) {
    const ys = [...crossYs, ...slotYs].sort((a, b) => a - b);
    for (const y of ys) nodes.push({id: nodeId(x, y), x, y});
    ys.slice(1).forEach((y, i) => addEdge({x, y: ys[i]}, {x, y}));
    roads.push({id: `vertical-${x}`, x1: x, y1: 100, x2: x, y2: 760, width: laneWidth});
  }
  for (const y of crossYs) {
    laneXs.slice(1).forEach((x, i) => addEdge({x: laneXs[i], y}, {x, y}));
    roads.push({id: `cross-${y}`, x1: laneXs[0], y1: y, x2: laneXs.at(-1), y2: y, width: laneWidth});
  }
  const gates = [
    {id: 'entry', label: 'ENTRADA', x: laneXs[0], y: 840, direction: -1},
    {id: 'exit', label: 'SALIDA', x: laneXs.at(-1), y: 840, direction: 1},
  ];
  for (const gate of gates) {
    gate.nodeId = nodeId(gate.x, gate.y);
    nodes.push({id: gate.nodeId, x: gate.x, y: gate.y});
    addEdge({x: gate.x, y: 760}, gate);
    roads.push({id: gate.id, x1: gate.x, y1: 760, x2: gate.x, y2: gate.y, width: laneWidth});
  }
  const lots = yard.lots.map((lot, i) => {
    const left = 70 + (i % 3) * 384;
    const top = i < 3 ? 0 : 330;
    return {...lot, left, top, positions: lot.positions.map(position => {
      const cx = left + [55, 120, 220, 285][position.x - 1];
      const cy = top + 190 + (position.y - 1) * 42;
      const streetX = left + [0, 170, 170, 340][position.x - 1];
      return {...position, cx, cy, width: 54, height: 26,
        accessNodeId: nodeId(streetX, cy), available: true};
    })};
  });
  return {width, height, lots, positions: lots.flatMap(l => l.positions), roads, nodes, edges,
    gates, entryNodeId: gates[0].nodeId, exitNodeId: gates[1].nodeId};
}
