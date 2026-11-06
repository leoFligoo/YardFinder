// data.js — Inventario de ejemplo para la PWA del chofer.
// Derivado de tags_0-19.csv del proyecto. En producción esto vendría de
// inventario.db a través de una API (ver docs al final de README).
//
// estado:  'en_patio'  -> auto en el playón, no forma parte de la orden actual
//          'a_retirar' -> incluido en la orden de retiro de hoy (pendiente)
//          'retirado'  -> ya cargado al camión (se marca al leer el AprilTag)

export const PATIO = {
  nombre: 'Playón Central',
  sectores: 6,          // sectores 1..6, como en la vista del operador
  filas: ['A', 'B'],    // 2 filas por sector
  posiciones: 6,        // 6 posiciones por fila
};

// Inventario. sector 1..6, fila 'A'/'B', pos 1..6.
export const AUTOS = [
  { tag: 2,  vin: '8APVB3GM2SH586834', modelo: 'Fiat Cronos Drive',        color: 'Rojo',       patente: 'AH 966 TN', sector: 4, fila: 'B', pos: 7, estado: 'a_retirar' },
  { tag: 42, vin: '8AP359A1XRJ000042', modelo: 'Fiat Cronos',              color: 'Blanco',     patente: 'AG 118 KM', sector: 4, fila: 'B', pos: 4, estado: 'a_retirar' },
  { tag: 3,  vin: '8AJ7S23M8S0178128', modelo: 'Toyota Hilux SRX',         color: 'Bordó',      patente: 'AF 601 AS', sector: 1, fila: 'A', pos: 2, estado: 'a_retirar' },
  { tag: 17, vin: '8AW6HTP75ST283433', modelo: 'Volkswagen Amarok V6',     color: 'Azul',       patente: 'AB 939 JC', sector: 2, fila: 'B', pos: 5, estado: 'a_retirar' },
  { tag: 10, vin: 'LVSL3TJA3VC939729', modelo: 'Ford Territory Titanium',  color: 'Blanco',     patente: 'AG 305 MD', sector: 6, fila: 'A', pos: 3, estado: 'a_retirar' },
  { tag: 5,  vin: '8ANA19JP9TD759838', modelo: 'Nissan Frontier PRO-4X',   color: 'Bordó',      patente: 'AH 932 MP', sector: 5, fila: 'B', pos: 2, estado: 'a_retirar' },

  { tag: 0,  vin: '9BRETH859T1317066', modelo: 'Toyota Yaris XLS',         color: 'Blanco',     patente: 'AH 372 HV', sector: 1, fila: 'A', pos: 1, estado: 'en_patio' },
  { tag: 1,  vin: '9BRXBBBA8TP608377', modelo: 'Toyota Corolla Cross XEI', color: 'Gris Oscuro', patente: 'AF 336 YH', sector: 1, fila: 'A', pos: 3, estado: 'en_patio' },
  { tag: 4,  vin: 'LVS2LL9R6PN883685', modelo: 'Ford Territory Titanium',  color: 'Azul',       patente: 'AH 375 YU', sector: 1, fila: 'B', pos: 2, estado: 'en_patio' },
  { tag: 6,  vin: '8AJY6BRMXVM184011', modelo: 'Toyota Hilux SRX',         color: 'Blanco',     patente: 'AH 114 JH', sector: 2, fila: 'A', pos: 1, estado: 'en_patio' },
  { tag: 7,  vin: '9BRMZVEL7RT824475', modelo: 'Toyota Corolla Cross XEI', color: 'Beige',      patente: 'AH 216 AK', sector: 2, fila: 'A', pos: 4, estado: 'en_patio' },
  { tag: 8,  vin: '8AW3NTGT1VP960306', modelo: 'Volkswagen Amarok V6',     color: 'Negro',      patente: 'AA 836 FR', sector: 2, fila: 'B', pos: 2, estado: 'en_patio' },
  { tag: 9,  vin: '8AD4R5RB3TX604230', modelo: 'Peugeot 208 Allure',       color: 'Rojo',       patente: 'AB 979 CK', sector: 3, fila: 'A', pos: 1, estado: 'en_patio' },
  { tag: 11, vin: '9BG4N8G12S9705964', modelo: 'Chevrolet Onix Premier',   color: 'Blanco',     patente: 'AC 305 LV', sector: 3, fila: 'A', pos: 3, estado: 'en_patio' },
  { tag: 12, vin: '9BRY4PUG8TZ878310', modelo: 'Toyota Yaris XLS',         color: 'Gris Plata', patente: 'AC 273 FU', sector: 3, fila: 'B', pos: 2, estado: 'en_patio' },
  { tag: 13, vin: 'LVSY9T0YXSH439729', modelo: 'Ford Territory Titanium',  color: 'Gris Plata', patente: 'AF 140 PC', sector: 3, fila: 'B', pos: 5, estado: 'en_patio' },
  { tag: 14, vin: '9BRJYH1E3VR914549', modelo: 'Toyota Yaris XLS',         color: 'Gris Plata', patente: 'AH 383 DB', sector: 5, fila: 'A', pos: 2, estado: 'en_patio' },
  { tag: 15, vin: 'LVSAAF3HXPN396217', modelo: 'Ford Territory Titanium',  color: 'Negro',      patente: 'AD 262 DP', sector: 5, fila: 'A', pos: 5, estado: 'en_patio' },
  { tag: 16, vin: '8AWVT7XGXRX000495', modelo: 'Volkswagen Taos Highline', color: 'Beige',      patente: 'AG 420 NC', sector: 6, fila: 'A', pos: 1, estado: 'en_patio' },
  { tag: 18, vin: '8APFYR1W1PX259435', modelo: 'Fiat Cronos Drive',        color: 'Gris Plata', patente: 'AB 350 HA', sector: 6, fila: 'B', pos: 2, estado: 'en_patio' },
  { tag: 19, vin: '8AF2EUEE2PA457721', modelo: 'Ford Ranger XLT',          color: 'Azul',       patente: 'AB 621 YF', sector: 6, fila: 'B', pos: 5, estado: 'en_patio' },
];

// Orden de retiro actual (transportista / destino). El recorrido sugerido
// es el orden de esta lista.
export const ORDEN = {
  id: 'OR-2026-1142',
  destino: 'Concesionario Norte',
  transportista: 'Camión 07 · Nievas',
  // tags en el orden en que conviene recorrer el playón
  recorrido: [3, 17, 2, 42, 5, 10],
};
