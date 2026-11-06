#!/usr/bin/env python3
# serve_https.py — Servidor HTTPS local para presentar la PWA del chofer en el
# celular (misma red / LAN) SIN depender de un túnel.
#
# Uso:
#     python serve_https.py            # puerto 8443
#     python serve_https.py 9000       # otro puerto
#
# Sirve la carpeta de la PWA por HTTPS con el MIME correcto para .wasm, y usa
# cert.pem / key.pem (ya generados). Si faltan, intenta crearlos con openssl.
#
# En el celular, en la misma red Wi-Fi, abrí la URL  https://<IP>:8443  que
# imprime abajo. (Ver PRESENTAR.md para que el teléfono confíe en el certificado
# y para habilitar "instalar app".)

import http.server
import ipaddress
import os
import shutil
import socket
import ssl
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8443
CERT = HERE / "cert.pem"
KEY = HERE / "key.pem"


def lan_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def ensure_cert(ip: str) -> None:
    if CERT.exists() and KEY.exists():
        return
    openssl = shutil.which("openssl")
    if not openssl:
        sys.exit(
            "Faltan cert.pem / key.pem y no encontré 'openssl' para generarlos.\n"
            "Generalos a mano (desde Git Bash) con:\n"
            '  openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem '
            f'-days 365 -subj "//CN=YardFinder" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:{ip}"'
        )
    print("Generando certificado autofirmado…")
    cnf = HERE / "_openssl_min.cnf"
    cnf.write_text("[req]\ndistinguished_name=dn\n[dn]\n", encoding="utf-8")
    env = {**os.environ, "OPENSSL_CONF": str(cnf)}
    subprocess.run(
        [openssl, "req", "-x509", "-newkey", "rsa:2048", "-nodes",
         "-keyout", str(KEY), "-out", str(CERT), "-days", "365",
         "-subj", "//CN=YardFinder",
         "-addext", f"subjectAltName=DNS:localhost,IP:127.0.0.1,IP:{ip}"],
        check=True, env=env,
    )
    cnf.unlink(missing_ok=True)


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
    try:  # la consola de Windows suele ser cp1252: forzamos UTF-8
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ip = lan_ip()
    try:
        ensure_cert(ip)
    except subprocess.CalledProcessError as e:
        sys.exit(f"openssl falló: {e}")

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(str(CERT), str(KEY))

    httpd = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)

    print("\n  Yard Finder · servidor HTTPS para la demo")
    print("  ------------------------------------------")
    print(f"   • En esta PC:     https://localhost:{PORT}")
    print(f"   • Desde el móvil: https://{ip}:{PORT}   (misma red Wi-Fi)")
    print("\n  La primera vez el teléfono avisará del certificado: tocá")
    print("  'Configuración avanzada' -> 'Continuar de todos modos'.")
    print("  (Para que funcione 'Instalar app', ver PRESENTAR.md.)")
    print("\n  Ctrl+C para cortar.\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Cortado.")


if __name__ == "__main__":
    main()
