#!/usr/bin/env python3
# serve_http.py — Servidor HTTP para la demo en el celular (Opción B: HTTP plano
# + flag de Chrome). Pensado para presentar la PWA en la misma red Wi-Fi SIN
# túnel y SIN certificados.
#
# Uso:
#     python serve_http.py           # puerto 8000
#     python serve_http.py 9000      # otro puerto
#
# Luego, en Chrome del CELULAR (una sola vez):
#   chrome://flags/#unsafely-treat-insecure-origin-as-secure
#   -> pegá la URL que imprime este script -> Enabled -> Relaunch
# Eso vuelve al origen "contexto seguro": cámara, GPS, service worker e
# "Instalar app" funcionan todos.

import http.server
import socket
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


def lan_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".wasm": "application/wasm",
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".webmanifest": "application/manifest+json",
        ".json": "application/json",
        ".svg": "image/svg+xml",
    }

    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(HERE), **k)

    def end_headers(self):
        # Sin caché HTTP: evita servir versiones viejas durante la demo.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s - %s\n" % (self.address_string(), fmt % args))


def main() -> None:
    try:  # consola de Windows suele ser cp1252
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    ip = lan_ip()
    url = f"http://{ip}:{PORT}"

    httpd = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler)

    print("\n  Yard Finder · servidor HTTP para la demo (Opción B)")
    print("  ---------------------------------------------------")
    print(f"   En esta PC:     http://localhost:{PORT}")
    print(f"   Desde el móvil: {url}   (misma red Wi-Fi)")
    print("\n  En Chrome del CELULAR, una sola vez:")
    print("   1) Abrí:  chrome://flags/#unsafely-treat-insecure-origin-as-secure")
    print(f"   2) Pegá:  {url}")
    print("   3) Poné 'Enabled' y tocá 'Relaunch'")
    print(f"   4) Entrá a {url}")
    print("\n  (Si no conecta: permití Python en el Firewall de Windows,")
    print("   redes privadas. Desactivá el flag al terminar la demo.)")
    print("\n  Ctrl+C para cortar.\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Cortado.")


if __name__ == "__main__":
    main()
