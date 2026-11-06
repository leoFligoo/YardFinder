// Logical positions are local to each lot, never latitude/longitude or image pixels.
export const YARD_LAYOUT = Object.freeze({lotCount: 6, columns: 4, rows: 5});

export function generateYard({lotCount, columns, rows} = YARD_LAYOUT) {
  if (![lotCount, columns, rows].every(n => Number.isSafeInteger(n) && n > 0)
      || lotCount * columns * rows > 10000) {
    throw new Error('La distribución debe tener dimensiones enteras positivas y hasta 10.000 posiciones.');
  }
  const lots = Array.from({length: lotCount}, (_, index) => ({
    id: index + 1,
    name: `Lote ${index + 1}`,
    columns,
    rows,
    capacity: columns * rows,
    positions: Array.from({length: columns * rows}, (_, position) => {
      const x = position % columns + 1;
      const y = Math.floor(position / columns) + 1;
      return {id: `L${index + 1}-X${x}-Y${y}`, lotId: index + 1, x, y};
    }),
  }));
  return {lots, capacity: lotCount * columns * rows};
}

export function findPosition(yard, lotId, x, y) {
  return yard.lots.find(lot => lot.id === lotId)?.positions.find(p => p.x === x && p.y === y) ?? null;
}

export function renderYardLayout(container) {
  const yard = generateYard();
  const details = document.createElement('details');
  details.className = 'yard-layout panel';
  const summary = document.createElement('summary');
  const title = document.createElement('strong');
  title.textContent = 'Distribución del patio';
  const count = document.createElement('span');
  count.textContent = `${yard.lots.length} lotes · ${yard.capacity} posiciones`;
  summary.append(title, count);
  const description = document.createElement('p');
  description.className = 'yard-description';
  description.textContent = '20 autos por lote · 4 columnas (X) × 5 filas (Y). Las coordenadas comienzan en (1,1) en la esquina superior izquierda de cada lote.';
  const grid = document.createElement('div');
  grid.className = 'yard-lots';
  const status = document.createElement('p');
  status.className = 'yard-position-status';
  status.setAttribute('role', 'status');
  status.textContent = 'Elegí una posición para consultar su ubicación.';
  for (const lot of yard.lots) {
    const section = document.createElement('section');
    const heading = document.createElement('h3');
    heading.textContent = `${lot.name} · ${lot.capacity} autos`;
    const positions = document.createElement('div');
    positions.className = 'yard-positions';
    positions.setAttribute('role', 'group');
    positions.setAttribute('aria-label', `Posiciones de ${lot.name}`);
    for (const position of lot.positions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${position.x},${position.y}`;
      button.setAttribute('aria-label', `${lot.name}, columna ${position.x}, fila ${position.y}`);
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        grid.querySelectorAll('[aria-pressed="true"]').forEach(el => el.setAttribute('aria-pressed', 'false'));
        button.setAttribute('aria-pressed', 'true');
        status.textContent = `${lot.name} · (${position.x},${position.y}) · ${position.id}. Posición definida; sin vehículo vinculado a la imagen.`;
      });
      positions.append(button);
    }
    section.append(heading, positions);
    grid.append(section);
  }
  const note = document.createElement('p');
  note.className = 'yard-description';
  note.textContent = 'Esta distribución define 120 lugares; no representa 120 detecciones. El mapa inferior conserva el ejemplo fotográfico original. La vinculación entre posiciones y autos observados está pendiente.';
  details.append(summary, description, grid, status, note);
  container.replaceChildren(details);
}
