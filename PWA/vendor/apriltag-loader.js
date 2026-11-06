// apriltag-loader.js — Carga el detector AprilTag (WASM, familia tag36h11) en el
// hilo principal, sin Web Worker ni Comlink, para que funcione offline.
//
// Usa el módulo emscripten `apriltag_wasm.js` (global AprilTagWasm) de
// arenaxr/apriltag-js-standalone. Expone:
//
//     getDetector() -> Promise<{ detect(grayU8, w, h) -> Array<{id, corners, center}> }>
//
// La familia tag36h11 coincide con la de generar_tags.py (DICT_APRILTAG_36h11).

let _promesa = null;

function cargarScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar ' + src));
    document.head.appendChild(s);
  });
}

// Baja el .wasm como bytes y valida que sea WASM de verdad (y no, p. ej., el
// index.html que devolvería el service worker ante un fallo de red).
async function bajarWasm(url) {
  const resp = await fetch(url, { cache: 'no-cache' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} al bajar ${url}`);
  const buf = await resp.arrayBuffer();
  const m = new Uint8Array(buf.slice(0, 4)); // magic '\0asm' = 00 61 73 6d
  if (!(m[0] === 0x00 && m[1] === 0x61 && m[2] === 0x73 && m[3] === 0x6d)) {
    throw new Error('El archivo .wasm no es válido (¿el servidor/SW devolvió HTML?).');
  }
  return buf;
}

async function _crear() {
  // Carpeta de este módulo, para resolver el .wasm junto al .js.
  const base = new URL('.', import.meta.url).href;
  console.info('[tag] cargando apriltag_wasm.js…');
  if (typeof window.AprilTagWasm === 'undefined') {
    await cargarScript(base + 'apriltag_wasm.js');
  }
  console.info('[tag] bajando apriltag_wasm.wasm…');
  // Pasamos el binario explícito (wasmBinary): evita el camino de
  // instantiateStreaming, que con http.server + SW puede colgarse por el MIME.
  const wasmBinary = await bajarWasm(base + 'apriltag_wasm.wasm');
  console.info('[tag] instanciando módulo WASM…');
  const Module = await window.AprilTagWasm({
    wasmBinary,
    locateFile: (path) => base + path,
  });
  console.info('[tag] módulo WASM instanciado');

  const _init = Module.cwrap('atagjs_init', 'number', []);
  const _set_opts = Module.cwrap('atagjs_set_detector_options', 'number',
    ['number', 'number', 'number', 'number', 'number', 'number', 'number']);
  const _set_img_buffer = Module.cwrap('atagjs_set_img_buffer', 'number', ['number', 'number', 'number']);
  const _detect = Module.cwrap('atagjs_detect', 'number', []);

  _init();
  // decimate, sigma, nthreads, refine_edges, max_detections, return_pose, return_solutions
  // decimate 1.0 (sin reducir) mejora la lectura de tags chicos/lejanos del techo;
  // max_detections 0 = devolver todas.
  _set_opts(1.0, 0.0, 1, 1, 0, 0, 0);

  function detect(grayU8, w, h) {
    const imgBuffer = _set_img_buffer(w, h, w);
    if (w * h < grayU8.length) return [];
    Module.HEAPU8.set(grayU8.subarray(0, w * h), imgBuffer);
    const ptr = _detect();
    const len = Module.getValue(ptr, 'i32');
    if (len === 0) return [];
    const strPtr = Module.getValue(ptr + 4, 'i32');
    const view = new Uint8Array(Module.HEAP8.buffer, strPtr, len);
    let json = '';
    for (let i = 0; i < len; i++) json += String.fromCharCode(view[i]);
    try { return JSON.parse(json); } catch { return []; }
  }

  return { detect };
}

export function getDetector() {
  if (!_promesa) {
    // Timeout de seguridad: si la carga se cuelga, rechazamos para que la app
    // muestre el fallo y ofrezca el respaldo (QR / ingreso manual).
    _promesa = Promise.race([
      _crear(),
      new Promise((_, rej) => setTimeout(
        () => rej(new Error('Timeout cargando el decodificador AprilTag (15 s).')), 15000)),
    ]);
  }
  return _promesa;
}
