import json
import threading
import unittest
from http.client import HTTPConnection
from interfaz import Servidor
from compartir_ui import VistaPublica


class PublicPreviewTests(unittest.TestCase):
    def test_tunnel_serves_inventory_and_crops_but_not_admin_api_or_db(self):
        server = Servidor(('127.0.0.1',0),VistaPublica)
        thread = threading.Thread(target=server.serve_forever,daemon=True)
        thread.start()
        try:
            def request(path, method='GET'):
                connection = HTTPConnection('127.0.0.1',server.server_port,timeout=5)
                connection.request(method,path)
                response = connection.getresponse()
                status, body = response.status,response.read()
                connection.close()
                return status,body
            status,body = request('/api/patio')
            self.assertEqual(status,200)
            self.assertEqual(json.loads(body)['fuente'],'sqlite')
            for auto in json.loads(body)['autos']:
                self.assertEqual(request(auto['recorte'])[0],200)
            self.assertEqual(request('/ui/')[0],200)
            status, body = request('/api/inventario')
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(body)['conteos']['registrados'], 124)
            for path in ['/api/config','/api/procesar','/inventario.db','/api/inventario/../config','/api/patio/recortes/../inventario.db','/ui/../inventario.db']:
                self.assertEqual(request(path)[0],404)
            self.assertEqual(request('/api/procesar','POST')[0],405)
            self.assertEqual(request('/api/inventario','POST')[0],405)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()
