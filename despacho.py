"""
despacho.py — Búsqueda de autos en lenguaje natural para "Planificar por chat".

Recibe un pedido del despachador en lenguaje natural (ej. "necesito 5 Cronos
blancos del lote 4"), lo convierte en criterios estructurados y busca los autos
en inventario.db (último vuelo), ordenándolos por una ruta de retiro óptima.

El parseo del lenguaje natural usa Claude (Anthropic) si hay ANTHROPIC_API_KEY
en el entorno; si no hay key, o si la llamada falla (sin internet), cae a un
parseo local por palabras clave. Así la demo funciona también 100% offline.

Este módulo solo depende de sqlite3 (no de cv2), para poder probarlo y correrlo
sin el stack de procesamiento del drone.
"""
import json
import math
import os
import re
import sqlite3
from contextlib import closing
from pathlib import Path

CAPACIDAD_CAMION = 8
MODELO_LLM_DEFECTO = "claude-haiku-5-5"  # barato y rápido; se cambia con ANTHROPIC_MODEL


def cargar_env(base):
    """Carga variables de un archivo .env en la raíz (si existe), sin pisar las ya
    definidas en el entorno real. Así la API key queda fuera del código y de git."""
    ruta = Path(base) / ".env"
    if not ruta.exists():
        return
    try:
        for linea in ruta.read_text(encoding="utf-8").splitlines():
            linea = linea.strip()
            if not linea or linea.startswith("#") or "=" not in linea:
                continue
            clave, _, valor = linea.partition("=")
            # Quita comillas envolventes y espacios; el entorno real tiene prioridad.
            os.environ.setdefault(clave.strip(), valor.strip().strip('"').strip("'"))
    except OSError:
        pass


# ───────────────────────── Inventario (SQLite) ─────────────────────────

def _conectar(base):
    uri = (Path(base) / "inventario.db").resolve().as_uri() + "?mode=ro"
    return sqlite3.connect(uri, uri=True)


def leer_inventario(base):
    """Autos del último vuelo con su vehículo (modelo/color), listos para filtrar."""
    with closing(_conectar(base)) as con:
        con.row_factory = sqlite3.Row
        vuelo = con.execute(
            "SELECT id FROM vuelos ORDER BY fecha DESC, id DESC LIMIT 1"
        ).fetchone()
        if not vuelo:
            return []
        rows = con.execute(
            """SELECT a.auto_id AS id, a.lote, a.pos_x, a.pos_y, a.tag, a.conf,
                      v.vin, v.modelo, v.color
                 FROM autos a LEFT JOIN vehiculos v ON v.tag = a.tag
                WHERE a.vuelo_id = ?
                ORDER BY a.lote, a.pos_y, a.pos_x""",
            (vuelo["id"],),
        ).fetchall()
        return [dict(r) for r in rows]


def vocabulario_modelos(inventario):
    """Palabras significativas de los modelos presentes (para el parseo local)."""
    vocab = set()
    for a in inventario:
        for palabra in _norm(a.get("modelo")).split():
            if len(palabra) >= 3 or palabra.isdigit():
                vocab.add(palabra)
    return vocab


# ───────────────────────── Parseo del pedido ─────────────────────────

def _norm(s):
    return (s or "").strip().lower()


# Colores de la base (los compuestos van primero para ganarle al substring corto).
_COLORES = [
    "gris plata", "gris oscuro", "gris", "blanco", "negro", "azul",
    "rojo", "bordó", "bordo", "beige", "verde", "plata",
]
_STOP = {
    "los", "las", "el", "la", "un", "una", "unos", "unas", "de", "del", "con",
    "para", "auto", "autos", "vehiculo", "vehiculos", "vehículo", "vehículos",
    "necesito", "buscame", "búscame", "traeme", "tráeme", "quiero", "dame",
    "todos", "todas", "lote", "sector", "color", "colores", "y", "en",
}

SYSTEM_PROMPT = """Eres el asistente de despacho de la app "Yard Finder".
Convertí el pedido del despachador en un objeto JSON válido, SIN texto extra.

Estructura exacta:
{
  "cantidad": <número o null>,   // null si pide "todos" o no aclara
  "modelo": "<texto>",           // palabra clave del modelo, ej: "cronos", "amarok", "taos", "hilux". "" si no aclara
  "color": "<texto o null>",     // ej: "blanco", "gris plata", "azul". null si no aclara
  "lote": <1..6 o null>          // número de lote/sector, o null
}

Modelos posibles en el patio: Volkswagen Taos, Chevrolet Onix, Fiat Cronos,
Nissan Frontier, Toyota Yaris, Volkswagen Amarok, Ford Ranger, Toyota Corolla
Cross, Ford Territory, Renault Kangoo, Toyota Hilux, Peugeot 208.
Colores: Azul, Beige, Blanco, Gris Plata, Gris Oscuro, Rojo, Bordó, Negro.

Ejemplo: "Necesito los 12 Cronos blancos del lote 4"
-> {"cantidad": 12, "modelo": "cronos", "color": "blanco", "lote": 4}
Ejemplo: "Traeme todos los Amarok"
-> {"cantidad": null, "modelo": "amarok", "color": null, "lote": null}"""


def parsear_llm(texto, key):
    """Parseo con Claude. Lanza excepción si algo falla (el caller cae al local)."""
    import anthropic  # import lazy: si no está instalado, usamos el parseo local

    cliente = anthropic.Anthropic(api_key=key)
    msg = cliente.messages.create(
        model=os.environ.get("ANTHROPIC_MODEL", MODELO_LLM_DEFECTO),
        max_tokens=200,
        temperature=0,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": texto}],
    )
    crudo = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text").strip()
    crudo = re.sub(r"^```(?:json)?|```$", "", crudo, flags=re.MULTILINE).strip()
    datos = json.loads(crudo)
    return {
        "cantidad": datos.get("cantidad"),
        "modelo": datos.get("modelo") or "",
        "color": datos.get("color"),
        "lote": datos.get("lote"),
    }


def parsear_local(texto, inventario):
    """Parseo por palabras clave: sin internet ni API key."""
    t = _norm(texto)
    cantidad = None
    m = re.search(r"\b(\d{1,3})\b", t)
    if m:
        # Si el número es un lote (1..6 junto a 'lote/sector'), no es cantidad.
        if not re.search(r"(?:lote|sector)\s*" + m.group(1), t):
            cantidad = int(m.group(1))
    if re.search(r"\btodos?\b|\btodas?\b", t):
        cantidad = None

    lote = None
    ml = re.search(r"(?:lote|sector)\s*(\d)", t)
    if ml and 1 <= int(ml.group(1)) <= 6:
        lote = int(ml.group(1))

    color = None
    for c in _COLORES:
        if c in t:
            color = "bordó" if c == "bordo" else c
            break

    vocab = vocabulario_modelos(inventario)
    tokens = re.findall(r"[a-záéíóúñ0-9]+", t)
    modelo = " ".join(
        tok for tok in tokens
        if tok in vocab and tok not in _STOP and tok != (color or "")
    )
    return {"cantidad": cantidad, "modelo": modelo, "color": color, "lote": lote}


def parsear_criterios(texto, inventario):
    """Devuelve (criterios, modo) donde modo es 'ia' o 'local'."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key and key != "TU_API_KEY_AQUI":
        try:
            return parsear_llm(texto, key), "ia"
        except Exception as e:  # sin red, sin SDK, respuesta rara → fallback
            print("[despacho] Claude no disponible, uso parseo local:", e)
    return parsear_local(texto, inventario), "local"


# ───────────────────────── Filtro y ruta ─────────────────────────

def filtrar(inventario, crit):
    terminos = [w for w in _norm(crit.get("modelo")).split() if len(w) >= 2]
    color = _norm(crit.get("color"))
    lote = crit.get("lote")
    res = []
    for a in inventario:
        modelo = _norm(a.get("modelo"))
        col = _norm(a.get("color"))
        if terminos and not all(term in modelo for term in terminos):
            continue
        if color and color not in col:
            continue
        if lote and a.get("lote") != lote:
            continue
        res.append(a)
    return res


def _coord(a):
    # Coordenada global aproximada: lotes en fila, cada uno 4 de ancho + separación.
    return ((a.get("lote", 1) - 1) * 6 + (a.get("pos_x") or 0), a.get("pos_y") or 0)


def ruta_optima(autos):
    """Vecino más cercano desde el origen (0,0). Devuelve (orden, pasos_totales)."""
    rest = list(autos)
    ruta, cx, cy, total = [], 0.0, 0.0, 0.0
    while rest:
        i = min(range(len(rest)), key=lambda k: math.dist(_coord(rest[k]), (cx, cy)))
        a = rest.pop(i)
        gx, gy = _coord(a)
        total += math.dist((gx, gy), (cx, cy))
        cx, cy = gx, gy
        ruta.append(a)
    return ruta, round(total, 1)


def planificar(base, texto):
    texto = (texto or "").strip()
    if not texto:
        return {"ok": False, "error": "Escribí qué autos buscás."}

    cargar_env(base)  # toma la API key del .env si existe (y no está ya en el entorno)
    inventario = leer_inventario(base)
    crit, modo = parsear_criterios(texto, inventario)

    # Sin filtros reconocidos: no vaciamos el patio entero salvo que pidan "todos".
    tiene_filtro = bool(_norm(crit.get("modelo")) or crit.get("color") or crit.get("lote"))
    quiere_todos = bool(re.search(r"\btodo|\bpatio\b|\binventario\b|complet", _norm(texto)))
    if not tiene_filtro and not quiere_todos:
        return {
            "ok": True, "consulta": texto, "modo": modo, "criterios": crit,
            "encontrados": 0, "entregados": 0, "recortado": False,
            "capacidad": CAPACIDAD_CAMION, "pasos_ruta": 0, "ruta": [],
            "nota": "No reconocí modelo, color ni lote. Probá: «5 Cronos blancos del lote 4».",
        }

    matches = filtrar(inventario, crit)
    ruta, pasos = ruta_optima(matches)

    recortado = False
    cant = crit.get("cantidad")
    if isinstance(cant, int) and cant > 0 and len(ruta) > cant:
        ruta, pasos = ruta_optima(ruta[:cant])
        recortado = True

    salida = [{
        "id": a["id"], "vin": a.get("vin"), "modelo": a.get("modelo"),
        "color": a.get("color"), "lote": a.get("lote"),
        "pos": {"x": a.get("pos_x"), "y": a.get("pos_y")},
        "tag": a.get("tag"), "conf": a.get("conf"),
    } for a in ruta]

    return {
        "ok": True,
        "consulta": texto,
        "modo": modo,
        "criterios": crit,
        "encontrados": len(matches),
        "entregados": len(salida),
        "recortado": recortado,
        "capacidad": CAPACIDAD_CAMION,
        "pasos_ruta": pasos,
        "ruta": salida,
    }


# Prueba rápida por consola:  python despacho.py "5 cronos blancos del lote 4"
if __name__ == "__main__":
    import sys
    consulta = " ".join(sys.argv[1:]) or "todos los amarok"
    print(json.dumps(planificar(Path(__file__).resolve().parent, consulta),
                     ensure_ascii=False, indent=2))
