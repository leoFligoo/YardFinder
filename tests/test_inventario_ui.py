import sqlite3
import tempfile
import unittest
from pathlib import Path
from inventario_ui import InventarioError, leer_patio, resolver_recorte


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
