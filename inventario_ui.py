"""Read-only patio queries. SQLite is the source; no fixture fallback or writes."""
from contextlib import closing
import re
import sqlite3
from pathlib import Path


class InventarioError(Exception):
    pass


def conectar(base):
    return sqlite3.connect((Path(base) / 'inventario.db').resolve().as_uri() + '?mode=ro', uri=True)


def leer_patio(base):
    try:
        with closing(conectar(base)) as con:
            con.row_factory = sqlite3.Row
            con.execute('BEGIN')
            return _leer_patio(con)
    except sqlite3.Error as error:
        raise InventarioError('No se pudo leer inventario.db con el esquema de lote/X/Y requerido.') from error


def _leer_patio(con):
    # One flight is a snapshot. Never combine historical observations.
    vuelo = con.execute('SELECT id, nombre, fecha FROM vuelos ORDER BY fecha DESC, id DESC LIMIT 1').fetchone()
    autos = []
    if vuelo:
        rows = con.execute('''SELECT a.auto_id AS id, a.vuelo_id, a.lote,
            a.pos_x, a.pos_y, a.tag, a.conf, v.vin, v.modelo, v.color
            FROM autos a LEFT JOIN vehiculos v ON v.tag = a.tag
            WHERE a.vuelo_id = ? ORDER BY a.lote, a.pos_y, a.pos_x''', (vuelo['id'],))
        positions, ids = set(), set()
        for row in rows:
            auto = dict(row)
            position = (auto['lote'], auto.pop('pos_x'), auto.pop('pos_y'))
            if (not all(type(n) is int for n in position)
                    or not 1 <= position[0] <= 6 or not 1 <= position[1] <= 4 or not 1 <= position[2] <= 5):
                raise InventarioError('El inventario contiene autos sin una posición válida de lote/X/Y.')
            if position in positions or auto['id'] in ids:
                raise InventarioError('El inventario contiene posiciones o identificadores duplicados en el vuelo.')
            positions.add(position)
            ids.add(auto['id'])
            auto['posicion'] = dict(zip(('loteId', 'x', 'y'), position))
            auto['recorte'] = f"/api/patio/recortes/{auto['vuelo_id']}/{auto['id']}"
            autos.append(auto)
    return {'autos': autos, 'vuelo': dict(vuelo) if vuelo else None, 'fuente': 'sqlite'}


def leer_inventario(base):
    """Registry plus unmatched observations, from one read-only SQLite snapshot."""
    try:
        with closing(conectar(base)) as con:
            con.row_factory = sqlite3.Row
            con.execute('BEGIN')
            patio = _leer_patio(con)
            registrados = [dict(row) for row in con.execute(
                'SELECT tag, vin, modelo, color FROM vehiculos ORDER BY tag')]
            por_tag = {row['tag']: row for row in registrados}
            observados = {}
            filas = []
            fecha = patio['vuelo']['fecha'] if patio['vuelo'] else None
            for auto in patio['autos']:
                tag = auto['tag']
                if tag is not None:
                    if tag in observados:
                        raise InventarioError('Un AprilTag tiene más de una observación en el último vuelo.')
                    observados[tag] = auto
                if tag not in por_tag:
                    filas.append({**auto, 'clave': f"observacion:{auto['vuelo_id']}:{auto['id']}",
                                  'registrado': False, 'estado': 'ubicado', 'ultima_observacion': fecha})
            sin_identificar = len(filas)
            ubicados = 0
            for registro in registrados:
                auto = observados.get(registro['tag'])
                ubicados += bool(auto)
                filas.append({**registro, **(auto or {'id': None, 'vuelo_id': None, 'lote': None,
                                                      'posicion': None, 'recorte': None, 'conf': None}),
                              'clave': f"vehiculo:{registro['tag']}", 'registrado': True,
                              'estado': 'ubicado' if auto else 'sin_observacion',
                              'ultima_observacion': fecha if auto else None})
            return {'fuente': 'sqlite', 'vuelo': patio['vuelo'], 'filas': filas,
                    'conteos': {'registrados': len(registrados), 'ubicados': ubicados,
                                'sin_observacion': len(registrados) - ubicados,
                                'sin_identificar': sin_identificar, 'observaciones': len(patio['autos'])}}
    except sqlite3.Error as error:
        raise InventarioError('No se pudo leer el inventario de vehículos en SQLite.') from error


def resolver_recorte(base, vuelo_id, auto_id):
    """Rebase the foreign machine path inside this flight's local crop directory."""
    try:
        with closing(conectar(base)) as con:
            row = con.execute('''SELECT v.nombre, a.recorte FROM autos a
                JOIN vuelos v ON v.id = a.vuelo_id
                WHERE a.vuelo_id = ? AND a.auto_id = ?''', (vuelo_id, auto_id)).fetchone()
        if not row or not row[1] or not re.fullmatch(r'[\w-]+', row[0] or ''):
            return None
        filename = str(row[1]).replace('\\', '/').rsplit('/', 1)[-1]
        if not re.fullmatch(r'[\w.-]+\.(?:jpg|jpeg|png)', filename, re.IGNORECASE):
            return None
        root = (Path(base) / 'salida').resolve()
        crop_root = (root / row[0] / 'recortes').resolve()
        destination = (crop_root / filename).resolve()
        return destination if (crop_root.is_relative_to(root)
                               and destination.is_relative_to(crop_root)
                               and destination.is_file()) else None
    except sqlite3.Error as error:
        raise InventarioError('No se pudo consultar el recorte en inventario.db.') from error
