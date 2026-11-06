// geo.js — Ubicación GPS del chofer y envío al operador de planta.
//
// Vigila la posición y, cada cierto intervalo, la "envía" al operador. El envío
// real es un POST a OPERADOR_ENDPOINT; si está vacío, solo queda registrado
// localmente (para la demo) y se dispara el callback de UI igual.

const OPERADOR_ENDPOINT = ''; // p.ej. 'https://planta.local/api/chofer/posicion'
const INTERVALO_ENVIO_MS = 15000;

export class RastreoGPS {
  constructor({ onUpdate, onError } = {}) {
    this.onUpdate = onUpdate || (() => {});
    this.onError = onError || (() => {});
    this.ultima = null;        // {lat, lon, acc, ts}
    this.ultimoEnvio = 0;
    this._watchId = null;
  }

  activo() { return this._watchId !== null; }

  iniciar() {
    if (!('geolocation' in navigator)) {
      this.onError('Este dispositivo no tiene GPS disponible.');
      return;
    }
    if (this._watchId !== null) return;
    this._watchId = navigator.geolocation.watchPosition(
      (p) => this._nuevaPosicion(p),
      (e) => this.onError(this._msgError(e)),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }

  detener() {
    if (this._watchId !== null) {
      navigator.geolocation.clearWatch(this._watchId);
      this._watchId = null;
    }
  }

  _nuevaPosicion(p) {
    this.ultima = {
      lat: p.coords.latitude,
      lon: p.coords.longitude,
      acc: p.coords.accuracy,
      ts: Date.now(),
    };
    this.onUpdate(this.ultima);

    if (Date.now() - this.ultimoEnvio >= INTERVALO_ENVIO_MS) {
      this.ultimoEnvio = Date.now();
      this._enviarAlOperador(this.ultima);
    }
  }

  async _enviarAlOperador(pos) {
    const payload = {
      chofer: 'Camión 07',
      lat: pos.lat, lon: pos.lon, precision_m: pos.acc,
      ts: new Date(pos.ts).toISOString(),
    };
    if (!OPERADOR_ENDPOINT) {
      // Demo sin backend: queda el registro en consola.
      console.info('[GPS→operador] (sin endpoint)', payload);
      return;
    }
    try {
      await fetch(OPERADOR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch (e) {
      console.warn('[GPS→operador] no se pudo enviar', e);
    }
  }

  _msgError(e) {
    if (e.code === 1) return 'Permiso de ubicación denegado. Activalo para compartir tu posición.';
    if (e.code === 2) return 'No se pudo obtener la posición (sin señal GPS).';
    if (e.code === 3) return 'El GPS tardó demasiado en responder.';
    return 'Error de GPS.';
  }
}
