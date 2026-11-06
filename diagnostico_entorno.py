"""Comprueba requisitos locales sin descargar paquetes ni iniciar el servidor."""
import importlib.util
import platform
import sys
from importlib import metadata
from pathlib import Path

BASE = Path(__file__).resolve().parent
REQUISITOS = (
    ("numpy", "numpy"),
    ("PIL", "pillow"),
    ("cv2", "opencv-python"),
    ("torch", "torch"),
    ("ultralytics", "ultralytics"),
)


def main():
    print(f"Python {platform.python_version()} ({platform.machine()})")
    print(f"Ejecutable: {sys.executable}")
    faltantes = []
    for modulo, paquete in REQUISITOS:
        if importlib.util.find_spec(modulo) is None:
            print(f"FALTA: {paquete}")
            faltantes.append(paquete)
            continue
        try:
            version = metadata.version(paquete)
        except metadata.PackageNotFoundError:
            version = "módulo disponible; distribución alternativa"
        print(f"OK: {paquete} ({version})")

    modelo = BASE / "modelos" / "yolo11s-obb.pt"
    if modelo.is_file() and modelo.stat().st_size > 0:
        print(f"OK: modelo local ({modelo.stat().st_size / 1e6:.1f} MB)")
    else:
        print("FALTA: modelos/yolo11s-obb.pt; no se descargará desde este diagnóstico")
        faltantes.append("modelo local")

    try:
        import tkinter
        print(f"OK: Tk {tkinter.TkVersion}")
    except ImportError:
        print("AVISO: Tk no disponible; el selector nativo de carpetas requiere Tk")

    plantilla = (BASE / "plantilla_mapa.html").read_text(encoding="utf-8")
    if "https://cdnjs.cloudflare.com" in plantilla or "https://server.arcgisonline.com" in plantilla:
        print("AVISO: el mapa todavía solicita recursos externos")
    elif not (BASE / "vendor" / "leaflet" / "leaflet.js").is_file():
        print("FALTA: vendor/leaflet/leaflet.js")
        faltantes.append("Leaflet local")
    else:
        print("OK: Leaflet local y plantilla sin CDN ni mosaicos externos")

    if not (BASE / "salida").is_dir():
        print("AVISO: no hay carpeta salida; los ejemplos aún no aparecen en Resultados")
    if faltantes:
        print("Entorno incompleto. No se instaló ni descargó nada.")
        return 1
    print("Dependencias presentes. Falta validar inferencia y funcionamiento de la aplicación.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
