"""Run with .venv/bin/python -m unittest discover -s tests -p 'test_*.py'."""
import json
import threading
import unittest
from http.client import HTTPConnection
from interfaz import Manejador, Servidor


class UIHTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = Servidor(('127.0.0.1', 0), Manejador)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def get(self, path):
        connection = HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        connection.request('GET', path)
        response = connection.getresponse()
        result = response.status, response.getheader('Content-Type'), response.read()
        connection.close()
        return result

    def test_ui_and_every_referenced_asset_are_local_and_available(self):
        paths = ['/ui', '/ui/', '/ui/app.js', '/ui/styles.css', '/ui/yard-geometry.js',
                 '/ui/icons.js', '/ui/state.js', '/ui/data.js', '/ui/yard-layout.js', '/ui/vehicle-list.js', '/ui/favicon.svg',
                 '/vendor/leaflet/leaflet.js', '/vendor/leaflet/leaflet.css']
        page = self.get('/ui/')[2].decode()
        self.assertNotIn('vehicle-list-panel', page)
        self.assertNotIn('vehicle-list-body', page)
        self.assertNotIn('id="map"', page)
        self.assertNotIn('type="search"', page)
        self.assertNotIn('Mapa del patio', page)
        status, _, body = self.get('/ui/data/patio.json')
        self.assertEqual(status, 200)
        data = json.loads(body)
        paths.extend('/demo-assets/' + h['orto']['archivo'] for h in data['huellas'])
        paths.extend('/demo-assets/' + a['recorte'] for a in data['autos'])
        for path in paths:
            with self.subTest(path=path):
                self.assertEqual(self.get(path)[0], 200)

    def test_mounts_do_not_expose_parent_files_or_directories(self):
        for prefix in ['/ui/', '/vendor/', '/demo-assets/']:
            for suffix in ['../config.json', '%2e%2e/interfaz.py', '%2e%2e%2f.git/config', 'missing.js']:
                with self.subTest(path=prefix+suffix):
                    self.assertEqual(self.get(prefix+suffix)[0], 404)
        self.assertEqual(self.get('/ui/data/')[0], 404)

    def test_existing_interface_and_api_remain_available(self):
        self.assertEqual(self.get('/')[0], 200)
        status, _, body = self.get('/api/resultados')
        self.assertEqual(status, 200)
        self.assertIsInstance(json.loads(body), list)
