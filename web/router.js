export function parseRoute(hash) {
  if (hash === '#contenido') return {page: null};
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  if (path === '/inventario') return {page: 'inventario'};
  const params = new URLSearchParams(query);
  const integer = key => /^\d+$/.test(params.get(key) ?? '') ? Number(params.get(key)) : null;
  return {page: 'patio', vuelo: integer('vuelo'), auto: integer('auto')};
}

export function patioLink(row) {
  return row.posicion ? `#/patio?vuelo=${row.vuelo_id}&auto=${row.id}` : null;
}
