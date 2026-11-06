"""Publica los resultados incluidos en el repo usando el mapa offline actual."""
import json
import shutil
from pathlib import Path

BASE = Path(__file__).resolve().parent


def main():
    origen = BASE / "ejemplo_resultado"
    destino = BASE / "salida" / "demo_local"
    vendor = BASE / "vendor" / "leaflet"
    if not (vendor / "leaflet.js").is_file():
        raise SystemExit("Falta vendor/leaflet. Prepará los recursos locales antes de continuar.")
    html_original = (origen / "mapa.html").read_text(encoding="utf-8")
    inicio = html_original.index("const D = ") + len("const D = ")
    datos, _ = json.JSONDecoder().raw_decode(html_original[inicio:])
    datos["nombre"] = "DEMO LOCAL · Resultados de ejemplo"
    shutil.copytree(origen, destino, dirs_exist_ok=True)
    shutil.copytree(vendor, destino / "vendor" / "leaflet", dirs_exist_ok=True)
    plantilla = (BASE / "plantilla_mapa.html").read_text(encoding="utf-8")
    (destino / "mapa.html").write_text(
        plantilla.replace("/*__DATOS__*/null", json.dumps(datos, ensure_ascii=False)),
        encoding="utf-8",
    )
    print(f"Demo lista: {len(datos['autos'])} detecciones de ejemplo en {destino}")
    print("No se modificó inventario.db ni se volvió a ejecutar la detección.")


if __name__ == "__main__":
    main()
