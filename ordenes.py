"""
ordenes.py — Órdenes de retiro (despacho) sobre inventario.db.

Flujo: el operador genera UNA orden desde el front web (autos elegidos + recorrido);
la PWA del chofer carga la "orden activa" (la última abierta), marca cada auto como
RETIRADO al leer su AprilTag, y la orden se completa cuando se retiran todos.

Modelo de datos (se crea solo, idempotente):
  - ordenes(id, codigo, consulta, destino, transportista, estado, creada, completada)
      estado: 'abierta' | 'completa' | 'cerrada'(reemplazada por una nueva)
  - orden_items(orden_id, vuelo_id, auto_id, tag, recorrido)   -- membresía + orden del recorrido
  - autos.retirado / autos.retirado_ts                          -- estado de retiro (en la observación)

Solo depende de sqlite3 (no de cv2): se puede usar sin el stack del drone.
"""
import datetime as dt
import sqlite3
from contextlib import closing
from pathlib import Path


def _ahora():
    return dt.datetime.now().isoformat(timespec="seconds")


def _conectar_rw(base):
    con = sqlite3.connect(str((Path(base) / "inventario.db").resolve()), timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def asegurar_esquema(base):
    """Crea tablas/columnas si faltan. Idempotente; seguro de llamar al arrancar."""
    with closing(_conectar_rw(base)) as con, con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS ordenes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo TEXT, consulta TEXT, destino TEXT, transportista TEXT,
                estado TEXT NOT NULL DEFAULT 'abierta',
                creada TEXT NOT NULL, completada TEXT
            )""")
        con.execute("""
            CREATE TABLE IF NOT EXISTS orden_items (
                orden_id INTEGER NOT NULL,
                vuelo_id INTEGER NOT NULL,
                auto_id INTEGER NOT NULL,
                tag INTEGER,
                recorrido INTEGER NOT NULL,
                PRIMARY KEY (orden_id, vuelo_id, auto_id)
            )""")
        cols = {r[1] for r in con.execute("PRAGMA table_info(autos)")}
        if "retirado" not in cols:
            con.execute("ALTER TABLE autos ADD COLUMN retirado INTEGER NOT NULL DEFAULT 0")
        if "retirado_ts" not in cols:
            con.execute("ALTER TABLE autos ADD COLUMN retirado_ts TEXT")


def _vuelo_actual(con):
    row = con.execute(
        "SELECT id FROM vuelos ORDER BY fecha DESC, id DESC LIMIT 1").fetchone()
    return row["id"] if row else None


def _item_dict(row):
    return {
        "auto_id": row["auto_id"], "vuelo_id": row["vuelo_id"], "tag": row["tag"],
        "vin": row["vin"], "modelo": row["modelo"], "color": row["color"],
        "lote": row["lote"], "pos": {"x": row["pos_x"], "y": row["pos_y"]},
        "recorrido": row["recorrido"],
        "retirado": bool(row["retirado"]), "retirado_ts": row["retirado_ts"],
        "recorte": f"/api/patio/recortes/{row['vuelo_id']}/{row['auto_id']}",
    }


def _orden_dict(con, orden):
    items = con.execute("""
        SELECT i.auto_id, i.vuelo_id, i.tag, i.recorrido,
               a.lote, a.pos_x, a.pos_y, a.retirado, a.retirado_ts,
               v.vin, v.modelo, v.color
          FROM orden_items i
          JOIN autos a ON a.vuelo_id = i.vuelo_id AND a.auto_id = i.auto_id
     LEFT JOIN vehiculos v ON v.tag = a.tag
         WHERE i.orden_id = ?
      ORDER BY i.recorrido""", (orden["id"],)).fetchall()
    autos = [_item_dict(r) for r in items]
    retirados = sum(1 for a in autos if a["retirado"])
    return {
        "id": orden["id"], "codigo": orden["codigo"], "consulta": orden["consulta"],
        "destino": orden["destino"], "transportista": orden["transportista"],
        "estado": orden["estado"], "creada": orden["creada"], "completada": orden["completada"],
        "total": len(autos), "retirados": retirados, "pendientes": len(autos) - retirados,
        "autos": autos,
    }


def crear_orden(base, auto_ids, consulta="", destino=None, transportista=None):
    """Crea una orden con los autos dados (en orden de recorrido). Cierra la anterior
    abierta y reinicia el estado 'retirado' de esos autos. Devuelve la orden creada."""
    auto_ids = [int(a) for a in auto_ids]
    if not auto_ids:
        return {"ok": False, "error": "La orden no tiene autos."}
    with closing(_conectar_rw(base)) as con, con:
        vuelo_id = _vuelo_actual(con)
        if vuelo_id is None:
            return {"ok": False, "error": "No hay vuelos en el inventario."}
        # Validar que los autos existan en el vuelo actual.
        validos = {r["auto_id"]: r["tag"] for r in con.execute(
            "SELECT auto_id, tag FROM autos WHERE vuelo_id = ?", (vuelo_id,))}
        faltan = [a for a in auto_ids if a not in validos]
        if faltan:
            return {"ok": False, "error": f"Autos fuera del vuelo actual: {faltan}"}

        con.execute("UPDATE ordenes SET estado = 'cerrada' WHERE estado = 'abierta'")
        creada = _ahora()
        cur = con.execute(
            "INSERT INTO ordenes (consulta, destino, transportista, estado, creada) "
            "VALUES (?,?,?, 'abierta', ?)", (consulta, destino, transportista, creada))
        orden_id = cur.lastrowid
        codigo = f"OR-{dt.date.today().year}-{orden_id:04d}"
        con.execute("UPDATE ordenes SET codigo = ? WHERE id = ?", (codigo, orden_id))
        con.executemany(
            "INSERT INTO orden_items (orden_id, vuelo_id, auto_id, tag, recorrido) "
            "VALUES (?,?,?,?,?)",
            [(orden_id, vuelo_id, a, validos[a], i) for i, a in enumerate(auto_ids)])
        # Reiniciar el estado de retiro de los autos de esta orden.
        con.executemany(
            "UPDATE autos SET retirado = 0, retirado_ts = NULL WHERE vuelo_id = ? AND auto_id = ?",
            [(vuelo_id, a) for a in auto_ids])
        orden = con.execute("SELECT * FROM ordenes WHERE id = ?", (orden_id,)).fetchone()
        return {"ok": True, "orden": _orden_dict(con, orden)}


def orden_activa(base):
    """La última orden abierta con sus autos, o None si no hay."""
    with closing(_conectar_rw(base)) as con:
        orden = con.execute(
            "SELECT * FROM ordenes WHERE estado = 'abierta' ORDER BY id DESC LIMIT 1").fetchone()
        return _orden_dict(con, orden) if orden else None


def marcar_retiro(base, tag=None, auto_id=None):
    """Marca un auto de la orden activa como retirado (por tag o auto_id). Completa la
    orden si quedan todos retirados. Devuelve el auto actualizado y el estado de la orden."""
    with closing(_conectar_rw(base)) as con, con:
        orden = con.execute(
            "SELECT * FROM ordenes WHERE estado = 'abierta' ORDER BY id DESC LIMIT 1").fetchone()
        if orden is None:
            return {"ok": False, "error": "No hay una orden activa."}
        if auto_id is not None:
            item = con.execute(
                "SELECT * FROM orden_items WHERE orden_id = ? AND auto_id = ?",
                (orden["id"], int(auto_id))).fetchone()
        elif tag is not None:
            item = con.execute(
                "SELECT * FROM orden_items WHERE orden_id = ? AND tag = ?",
                (orden["id"], int(tag))).fetchone()
        else:
            return {"ok": False, "error": "Falta tag o auto_id."}
        if item is None:
            ref = f"tag #{tag}" if tag is not None else f"auto {auto_id}"
            return {"ok": False, "error": f"El {ref} no pertenece a la orden activa.", "fuera_de_orden": True}

        ya = con.execute("SELECT retirado FROM autos WHERE vuelo_id = ? AND auto_id = ?",
                         (item["vuelo_id"], item["auto_id"])).fetchone()["retirado"]
        con.execute(
            "UPDATE autos SET retirado = 1, retirado_ts = ? WHERE vuelo_id = ? AND auto_id = ?",
            (_ahora(), item["vuelo_id"], item["auto_id"]))

        pendientes = con.execute("""
            SELECT COUNT(*) FROM orden_items i
              JOIN autos a ON a.vuelo_id = i.vuelo_id AND a.auto_id = i.auto_id
             WHERE i.orden_id = ? AND a.retirado = 0""", (orden["id"],)).fetchone()[0]
        if pendientes == 0:
            con.execute("UPDATE ordenes SET estado = 'completa', completada = ? WHERE id = ?",
                        (_ahora(), orden["id"]))
        orden = con.execute("SELECT * FROM ordenes WHERE id = ?", (orden["id"],)).fetchone()
        return {"ok": True, "ya_estaba": bool(ya), "orden": _orden_dict(con, orden)}


def completar_orden(base, orden_id=None):
    """Cierra la orden activa (o la indicada) como completa."""
    with closing(_conectar_rw(base)) as con, con:
        if orden_id is None:
            orden = con.execute(
                "SELECT id FROM ordenes WHERE estado = 'abierta' ORDER BY id DESC LIMIT 1").fetchone()
            if orden is None:
                return {"ok": False, "error": "No hay una orden activa."}
            orden_id = orden["id"]
        con.execute("UPDATE ordenes SET estado = 'completa', completada = ? WHERE id = ?",
                    (_ahora(), orden_id))
        orden = con.execute("SELECT * FROM ordenes WHERE id = ?", (orden_id,)).fetchone()
        return {"ok": True, "orden": _orden_dict(con, orden)}
