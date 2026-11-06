"""Read-only preview for an SSH tunnel: python compartir_ui.py (port 8766)."""
from urllib.parse import unquote, urlparse
from interfaz import Manejador, Servidor


class VistaPublica(Manejador):
    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        if path == '/':
            self.send_response(302)
            self.send_header('Location', '/ui/')
            self.end_headers()
            return
        if (path in {'/ui', '/ui/', '/api/patio', '/api/inventario'} or path.startswith('/ui/')
                or path.startswith('/api/patio/recortes/')):
            return super().do_GET()
        self.send_error(404)

    def do_POST(self):
        self.send_error(405)


if __name__ == '__main__':
    print('Vista pública de solo lectura: http://127.0.0.1:8766/ui/', flush=True)
    Servidor(('127.0.0.1', 8766), VistaPublica).serve_forever()
