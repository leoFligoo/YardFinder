import sqlite3
import tempfile
import unittest
from pathlib import Path
from inventario_ui import InventarioError, leer_patio, leer_inventario, resolver_recorte


class InventoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.db = self.base / 'inventario.db'
        with sqlite3.connect(self.db) as con:
            con.executescript('''
                CREATE TABLE vuelos(id INTEGER PRIMARY KEY, nombre TEXT, fecha TEXT);
                CREATE TABLE autos(vuelo_id INT, auto_id INT, lote INT, pos_x INT, pos_y INT,
                    tag INT, conf REAL, recorte TEXT);
                CREATE TABLE vehiculos(tag INT PRIMARY KEY, vin TEXT, modelo TEXT, color TEXT);
                INSERT INTO vuelos VALUES(1,'vuelo_old','2026-01-01'),(2,'vuelo_new','2026-02-01');
                INSERT INTO autos VALUES(1,62,4,2,1,261,.8,NULL);
                INSERT INTO autos VALUES(2,62,1,4,5,261,.721,'/foreign/home/salida/vuelo_new/recortes/auto_0062.jpg');
                INSERT INTO autos VALUES(2,124,6,1,1,NULL,.5,NULL);
                INSERT INTO vehiculos VALUES(261,'VIN-62','Fiat Cronos Drive','Beige');
            ''')

    def test_latest_flight_metadata_positions_and_read_only(self):
        before = self.db.read_bytes()
        data = leer_patio(self.base)
        self.assertEqual(data['vuelo']['id'],2)
        self.assertEqual(len(data['autos']),2)
        auto = data['autos'][0]
        self.assertEqual(auto['id'],62)
        self.assertEqual(auto['posicion'],dict(loteId=1,x=4,y=5))
        self.assertEqual(auto['modelo'],'Fiat Cronos Drive')
        self.assertIsNone(data['autos'][1]['vin'])
        self.assertEqual(before,self.db.read_bytes())
        self.assertNotIn('/foreign',str(data))

    def test_latest_empty_snapshot_does_not_restore_historical_cars(self):
        with sqlite3.connect(self.db) as con:
            con.execute("INSERT INTO vuelos VALUES(3,'empty','2026-03-01')")
        self.assertEqual(leer_patio(self.base)['autos'],[])

    def test_invalid_and_duplicate_positions_are_reported(self):
        with sqlite3.connect(self.db) as con:
            con.execute('UPDATE autos SET pos_x=8 WHERE auto_id=124')
        with self.assertRaises(InventarioError):
            leer_patio(self.base)
        with sqlite3.connect(self.db) as con:
            con.execute('UPDATE autos SET lote=1,pos_x=4,pos_y=5 WHERE auto_id=124')
        with self.assertRaises(InventarioError):
            leer_patio(self.base)

    def test_missing_database_is_not_created(self):
        self.db.unlink()
        with self.assertRaises(InventarioError):
            leer_patio(self.base)
        self.assertFalse(self.db.exists())

    def test_registry_includes_unobserved_and_unidentified_without_double_counting(self):
        with sqlite3.connect(self.db) as con:
            con.execute("INSERT INTO vehiculos VALUES(0,'VIN-0','Modelo sin vuelo','Negro')")
            con.execute('INSERT INTO autos VALUES(1,999,1,1,1,0,.9,NULL)')
        before = self.db.read_bytes()
        data = leer_inventario(self.base)
        self.assertEqual(data['conteos'], dict(registrados=2, ubicados=1, sin_observacion=1,
                                             sin_identificar=1, observaciones=2))
        rows = {row['clave']: row for row in data['filas']}
        self.assertEqual(rows['vehiculo:261']['id'], 62)
        self.assertEqual(rows['vehiculo:261']['ultima_observacion'], '2026-02-01')
        self.assertEqual(rows['vehiculo:0']['estado'], 'sin_observacion')
        self.assertIsNone(rows['vehiculo:0']['posicion'])
        self.assertIsNone(rows['vehiculo:0']['ultima_observacion'])
        self.assertFalse(rows['observacion:2:124']['registrado'])
        self.assertEqual(rows['observacion:2:124']['estado'], 'ubicado')
        self.assertEqual(before, self.db.read_bytes())

    def test_registry_without_flight_or_with_empty_latest_keeps_catalog(self):
        with sqlite3.connect(self.db) as con:
            con.execute("INSERT INTO vuelos VALUES(3,'empty','2026-02-01')")
        data = leer_inventario(self.base)
        self.assertEqual(data['vuelo']['id'], 3)  # tie breaks by ID
        self.assertEqual(data['conteos']['sin_observacion'], 1)
        self.assertEqual(data['conteos']['observaciones'], 0)
        with sqlite3.connect(self.db) as con:
            con.execute('DELETE FROM vuelos')
        data = leer_inventario(self.base)
        self.assertIsNone(data['vuelo'])
        self.assertIsNone(data['filas'][0]['ultima_observacion'])
        with sqlite3.connect(self.db) as con:
            con.execute('DELETE FROM vehiculos')
        self.assertEqual(leer_inventario(self.base)['filas'], [])

    def test_unknown_tag_is_an_unmatched_observation_and_repeated_tag_is_error(self):
        with sqlite3.connect(self.db) as con:
            con.execute('UPDATE autos SET tag=900 WHERE vuelo_id=2 AND auto_id=124')
        data = leer_inventario(self.base)
        self.assertEqual(data['conteos']['sin_identificar'], 1)
        self.assertEqual(data['filas'][0]['tag'], 900)
        with sqlite3.connect(self.db) as con:
            con.execute('UPDATE autos SET tag=261 WHERE vuelo_id=2 AND auto_id=124')
        with self.assertRaisesRegex(InventarioError, 'AprilTag'):
            leer_inventario(self.base)

    def test_bundled_registry_counts_and_real_position(self):
        data = leer_inventario(Path(__file__).resolve().parent.parent)
        self.assertEqual(data['conteos'], dict(registrados=124, ubicados=109, sin_observacion=15,
                                             sin_identificar=11, observaciones=120))
        row = next(row for row in data['filas'] if row['id'] == 124)
        self.assertEqual(row['posicion'], dict(loteId=5, x=2, y=3))

    def test_foreign_crop_path_resolves_locally_and_blocks_escapes(self):
        crop = self.base/'salida/vuelo_new/recortes/auto_0062.jpg'
        crop.parent.mkdir(parents=True)
        crop.write_bytes(b'image')
        self.assertEqual(resolver_recorte(self.base,2,62),crop.resolve())
        self.assertIsNone(resolver_recorte(self.base,2,999))
        self.assertIsNone(resolver_recorte(self.base,2,124))
        outside = self.base/'secret.jpg'
        outside.write_bytes(b'secret')
        crop.unlink()
        crop.symlink_to(outside)
        self.assertIsNone(resolver_recorte(self.base,2,62))
