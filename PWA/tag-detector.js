// tag-detector.js — Lectura del AprilTag del techo desde la cámara.
//
// Los imanes del techo son AprilTag 36h11 (nros 0..29). El decodificador real es
// un módulo WASM (vendor/apriltag-loader.js) que se carga de forma perezosa la
// primera vez que se escanea. Interfaz única que consume la app:
//
//     leerTagDeVideo(video, canvas) -> Promise<number|null>
//
// Respaldo: si el WASM aún no cargó o falla, intenta leer un QR con el
// BarcodeDetector nativo (útil para pruebas). La app siempre ofrece, además,
// ingreso manual del tag.

import { getDetector } from './vendor/apriltag-loader.js';

const ANCHO_MUESTRA = 960; // ancho al que se reduce el frame para detectar
                           // (más alto = tags del techo más legibles)

let _detector = null;      // detector WASM una vez listo
let _cargando = false;
let _falloWasm = false;
let _errWasm = '';         // mensaje del último fallo de carga

// Diagnóstico en vivo para la UI (ayuda a entender por qué "no detecta").
const _diag = { frames: 0, ultimaCantidad: 0, ultimoId: null, via: '—' };

// Empieza a cargar el WASM (no bloquea; cuando esté listo se usa solo).
export function precargarDetector() {
  if (_detector || _cargando || _falloWasm) return;
  _cargando = true;
  getDetector()
    .then(d => { _detector = d; console.info('[tag] AprilTag WASM listo'); })
    .catch(e => { _falloWasm = true; _errWasm = e && e.message ? e.message : String(e); console.warn('AprilTag WASM no disponible:', e); })
    .finally(() => { _cargando = false; });
}

export function estadoDetector() {
  if (_detector) return 'listo';
  if (_falloWasm) return 'fallo';
  return 'cargando';
}

// Diagnóstico para mostrar en pantalla.
export function diagDetector() {
  return { estado: estadoDetector(), error: _errWasm, ..._diag };
}

// ---- QR de respaldo ----
let _barcode = null;
function barcodeDetector() {
  if (_barcode !== null) return _barcode;
  if ('BarcodeDetector' in window) {
    try { _barcode = new window.BarcodeDetector({ formats: ['qr_code'] }); }
    catch { _barcode = false; }
  } else { _barcode = false; }
  return _barcode;
}
function tagDesdeTexto(txt) {
  const m = String(txt || '').match(/(\d{1,3})/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

// Dibuja el frame reducido en el canvas y devuelve su buffer en escala de grises.
function frameGris(video, canvas) {
  const w = ANCHO_MUESTRA;
  const h = Math.round((video.videoHeight / video.videoWidth) * w) || Math.round(w * 0.75);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    // luminancia (enteros, rápido)
    gray[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
  }
  return { gray, w, h };
}

/**
 * Intenta leer un tag de un frame de video.
 * @returns {Promise<number|null>} nro de tag, o null
 */
export async function leerTagDeVideo(video, canvas) {
  if (!video.videoWidth) return null;

  // 1) Detector AprilTag real.
  if (!_detector && !_falloWasm) precargarDetector();
  if (_detector) {
    try {
      const { gray, w, h } = frameGris(video, canvas);
      const dets = _detector.detect(gray, w, h);
      _diag.frames++;
      _diag.ultimaCantidad = dets ? dets.length : 0;
      _diag.via = 'AprilTag';
      if (dets && dets.length) {
        _diag.ultimoId = dets[0].id;
        return dets[0].id;
      }
      return null; // WASM listo: no caemos a QR (son tags, no QR)
    } catch (e) {
      console.warn('Fallo detección AprilTag:', e);
    }
  }

  // 2) Respaldo QR (mientras carga el WASM o si falló).
  const bd = barcodeDetector();
  if (bd) {
    try {
      const codes = await bd.detect(video);
      _diag.frames++;
      _diag.via = 'QR (respaldo)';
      for (const c of codes) {
        const n = tagDesdeTexto(c.rawValue);
        if (n !== null) { _diag.ultimoId = n; _diag.ultimaCantidad = codes.length; return n; }
      }
    } catch { /* frame no listo */ }
  }
  return null;
}
