"""Descarga explícita de Leaflet 1.9.4 para uso offline; nunca corre al iniciar la app."""
import base64
import hashlib
import io
import json
import tarfile
from pathlib import Path
from urllib.request import urlopen

BASE = Path(__file__).resolve().parent
VERSION = "1.9.4"
REGISTRO = f"https://registry.npmjs.org/leaflet/{VERSION}"
ARCHIVO = f"https://registry.npmjs.org/leaflet/-/leaflet-{VERSION}.tgz"
ARCHIVOS = {
    "package/dist/leaflet.js": "leaflet.js",
    "package/dist/leaflet.js.map": "leaflet.js.map",
    "package/dist/leaflet.css": "leaflet.css",
    "package/dist/images/layers.png": "images/layers.png",
    "package/dist/images/layers-2x.png": "images/layers-2x.png",
    "package/dist/images/marker-icon.png": "images/marker-icon.png",
    "package/dist/images/marker-icon-2x.png": "images/marker-icon-2x.png",
    "package/dist/images/marker-shadow.png": "images/marker-shadow.png",
    "package/LICENSE": "LICENSE",
}


def main():
    with urlopen(REGISTRO, timeout=30) as respuesta:
        paquete = json.load(respuesta)
    with urlopen(ARCHIVO, timeout=60) as respuesta:
        datos = respuesta.read()
    integridad = "sha512-" + base64.b64encode(hashlib.sha512(datos).digest()).decode()
    if integridad != paquete["dist"]["integrity"]:
        raise SystemExit("El archivo no coincide con la integridad publicada por npm.")
    destino = BASE / "vendor" / "leaflet"
    with tarfile.open(fileobj=io.BytesIO(datos), mode="r:gz") as paquete_tar:
        for origen, nombre in ARCHIVOS.items():
            contenido = paquete_tar.extractfile(origen)
            if contenido is None:
                raise SystemExit(f"Falta {origen} en el paquete.")
            ruta = destino / nombre
            ruta.parent.mkdir(parents=True, exist_ok=True)
            ruta.write_bytes(contenido.read())
    (destino / "ORIGIN.json").write_text(json.dumps({
        "package": "leaflet", "version": VERSION,
        "url": ARCHIVO, "integrity": integridad,
    }, indent=2) + "\n", encoding="utf-8")
    print(f"Leaflet {VERSION}: {len(ARCHIVOS)} archivos verificados en {destino}")


if __name__ == "__main__":
    main()
