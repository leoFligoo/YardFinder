// app.js — Yard Finder · PWA del chofer.
import { PATIO, AUTOS, ORDEN } from './data.js';
import { RastreoGPS } from './geo.js';
import { leerTagDeVideo, precargarDetector, estadoDetector, diagDetector } from './tag-detector.js';

/* ------------------------------------------------------------------ *
 * Estado
 * ------------------------------------------------------------------ */
const porTag = new Map(AUTOS.map(a => [a.tag, a]));
restaurarEstado();

const $ = sel => document.querySelector(sel);
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

/* ------------------------------------------------------------------ *
 * Navegación por pestañas
 * ------------------------------------------------------------------ */
function irA(vista) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view === vista));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.go === vista));
  if (vista !== 'escanear') detenerCamara();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => irA(t.dataset.go)));

/* ------------------------------------------------------------------ *
 * Orden + recorrido
 * ------------------------------------------------------------------ */
function autosDeOrden() {
  return ORDEN.recorrido.map(tag => porTag.get(tag)).filter(Boolean);
}
function proximoAuto() {
  return autosDeOrden().find(a => a.estado !== 'retirado') || null;
}

function renderOrdenHead() {
  $('#orden-id').textContent = ORDEN.id;
  $('#orden-dest').textContent = `${ORDEN.destino} · ${ORDEN.transportista}`;
  const total = autosDeOrden().length;
  const hechos = autosDeOrden().filter(a => a.estado === 'retirado').length;
  $('#orden-prog-n').textContent = `${hechos}/${total}`;
  $('#info-orden').textContent = ORDEN.id;
  $('#info-dest').textContent = ORDEN.destino;
  $('#info-transp').textContent = ORDEN.transportista;
}

/* ---------- Mapa del playón ---------- */
function renderYard() {
  const yard = $('#yard');
  yard.innerHTML = '';
  for (let s = 1; s <= PATIO.sectores; s++) {
    const enSector = AUTOS.filter(a => a.sector === s)
      .sort((a, b) => (a.fila + a.pos).localeCompare(b.fila + b.pos));
    const hayRetirar = enSector.some(a => a.estado === 'a_retirar');
    const sec = el('div', 'sector' + (hayRetirar ? ' has-retirar' : ''));
    sec.appendChild(el('div', 'sector-badge', String(s)));
    const grid = el('div', 'sector-grid');
    enSector.forEach(a => {
      const clase = a.estado === 'a_retirar' ? 'retirar' : a.estado === 'retirado' ? 'retirado' : 'patio';
      const car = el('button', `g-car ${clase}`);
      car.dataset.tag = a.tag;
      car.title = `#${a.tag} · ${a.modelo}`;
      if (a.estado !== 'en_patio') car.addEventListener('click', () => abrirDetalle(a));
      else car.disabled = true;
      grid.appendChild(car);
    });
    sec.appendChild(grid);
    yard.appendChild(sec);
  }
  const desp = el('div', 'despacho',
    '<svg viewBox="0 0 24 24"><path d="M3 7h11v8H3V7Zm11 2h4l3 3v3h-7V9Z"/></svg> Despacho');
  yard.appendChild(desp);
}

function resaltarEnYard(auto) {
  renderYard();
  const car = $(`#yard .g-car[data-tag="${auto.tag}"]`);
  if (car) { car.classList.add('sel'); $('#yard').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}

/* ---------- Próximo + pendientes ---------- */
function renderProximo() {
  const cont = $('#proximo');
  const a = proximoAuto();
  if (!a) {
    cont.innerHTML = '<div class="prox-card" style="border-color:var(--borde)"><div class="info"><div class="m">Recorrido completo ✓</div><div class="d">Todos los autos de la orden fueron retirados.</div></div></div>';
    return;
  }
  cont.innerHTML = '';
  const card = el('div', 'prox-card');
  card.innerHTML = `
    <div class="loc"><b>${a.sector}</b><span>Sector</span></div>
    <div class="info">
      <div class="m">${a.modelo}</div>
      <div class="d">Fila ${a.fila} · Pos ${a.pos} · ${a.color} · ${a.patente}</div>
    </div>`;
  const go = el('button', 'btn btn-prim go', 'Escanear');
  go.addEventListener('click', () => { irA('escanear'); iniciarCamara(); });
  card.appendChild(go);
  cont.appendChild(card);
}

function renderPendientes() {
  const cont = $('#lista-pend');
  cont.innerHTML = '';
  autosDeOrden().forEach(a => {
    const done = a.estado === 'retirado';
    const item = el('button', 'item ' + (done ? 'done' : 'pend'));
    item.innerHTML = `
      <div class="tag">#${a.tag}</div>
      <div class="t"><div class="m">${a.modelo}</div><div class="s">${a.color} · ${a.patente}</div></div>
      <div class="loc-chip">${done ? 'Retirado ✓' : `S${a.sector}·${a.fila}${a.pos}`}</div>`;
    item.addEventListener('click', () => abrirDetalle(a));
    cont.appendChild(item);
  });
}

function renderTodo() {
  renderOrdenHead();
  renderYard();
  renderProximo();
  renderPendientes();
}

/* ------------------------------------------------------------------ *
 * Hoja de detalle / confirmación
 * ------------------------------------------------------------------ */
const sheet = $('#sheet');
sheet.addEventListener('click', e => { if (e.target.dataset.close !== undefined) cerrarSheet(); });
function cerrarSheet() { sheet.hidden = true; }

function abrirDetalle(a) {
  const done = a.estado === 'retirado';
  const card = $('#sheet-card');
  card.innerHTML = `
    <div class="sheet-grab"></div>
    <h3>${a.modelo}</h3>
    <div class="sub">${a.color} · ${a.patente}</div>
    <span class="sheet-badge ${done ? 'done' : 'pend'}">${done ? 'Retirado' : 'A retirar'}</span>
    <div class="sheet-loc">
      <svg class="pin" viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>
      <div><b>Sector ${a.sector} · Fila ${a.fila} · Posición ${a.pos}</b><div class="sub">${PATIO.nombre}</div></div>
    </div>
    <dl>
      <div><dt>Tag</dt><dd>#${a.tag}</dd></div>
      <div><dt>VIN</dt><dd>${a.vin}</dd></div>
    </dl>
    <div class="sheet-actions"></div>`;
  const actions = card.querySelector('.sheet-actions');
  const verBtn = el('button', 'btn', 'Ver en el playón');
  verBtn.addEventListener('click', () => { cerrarSheet(); irA('recorrido'); resaltarEnYard(a); });
  actions.appendChild(verBtn);
  if (!done) {
    const scanBtn = el('button', 'btn btn-prim', 'Escanear para retirar');
    scanBtn.addEventListener('click', () => { cerrarSheet(); irA('escanear'); iniciarCamara(); });
    actions.appendChild(scanBtn);
  }
  sheet.hidden = false;
}

// Hoja de confirmación tras leer un tag.
function confirmarRetiro(a) {
  const card = $('#sheet-card');
  card.innerHTML = `
    <div class="sheet-grab"></div>
    <div class="sub">Tag #${a.tag} leído</div>
    <h3>${a.modelo}</h3>
    <div class="sub">${a.color} · ${a.patente} · ${a.vin}</div>
    <span class="sheet-badge pend">A retirar</span>
    <div class="sheet-loc">
      <svg class="pin" viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>
      <div><b>Sector ${a.sector} · Fila ${a.fila} · Posición ${a.pos}</b></div>
    </div>
    <div class="sheet-actions"></div>`;
  const actions = card.querySelector('.sheet-actions');
  const cancel = el('button', 'btn', 'Cancelar');
  cancel.addEventListener('click', () => { cerrarSheet(); iniciarCamara(); });
  const ok = el('button', 'btn btn-prim', 'Confirmar retiro');
  ok.addEventListener('click', () => { cerrarSheet(); marcarRetirado(a); });
  actions.append(cancel, ok);
  sheet.hidden = false;
}

function avisoTag(titulo, texto) {
  const card = $('#sheet-card');
  card.innerHTML = `
    <div class="sheet-grab"></div>
    <h3>${titulo}</h3>
    <div class="sub" style="margin-top:8px">${texto}</div>
    <div class="sheet-actions"><button class="btn btn-prim btn-full" data-close>Entendido</button></div>`;
  card.querySelector('[data-close]').addEventListener('click', () => { cerrarSheet(); iniciarCamara(); });
  sheet.hidden = false;
}

/* ------------------------------------------------------------------ *
 * Marcar retirado   (la escritura a la base queda para después)
 * ------------------------------------------------------------------ */
function marcarRetirado(a) {
  a.estado = 'retirado';
  guardarEstado();
  sincronizarRetiro(a);      // <-- integración con inventario.db (pendiente)
  renderTodo();
  toast(`#${a.tag} ${a.modelo} · retirado`, 'ok');
  if (!proximoAuto()) { irA('recorrido'); toast('Orden completa ✓', 'ok'); }
}

// PENDIENTE (fase 2): avisar al backend para marcar el auto como 'retirado'
// en inventario.db. Punto único de integración; hoy solo deja registro local.
async function sincronizarRetiro(a) {
  const evento = { orden: ORDEN.id, tag: a.tag, vin: a.vin, estado: 'retirado', ts: new Date().toISOString() };
  console.info('[retiro→inventario.db] (pendiente de backend)', evento);
  // Ejemplo de fase 2:
  // await fetch('/api/inventario/retiro', { method:'POST',
  //   headers:{'Content-Type':'application/json'}, body: JSON.stringify(evento) });
}

/* ------------------------------------------------------------------ *
 * Cámara / lectura de tag
 * ------------------------------------------------------------------ */
const video = $('#cam');
const canvas = $('#cam-canvas');
let stream = null, scanLoop = null;

async function iniciarCamara() {
  $('#scan-off').style.display = 'none';
  precargarDetector(); // empieza a cargar el WASM del AprilTag
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    $('.scan-frame').classList.remove('hit');
    actualizarHintScan();
    iniciarScanLoop();
  } catch (e) {
    $('#scan-off').style.display = 'flex';
    $('#scan-off').querySelector('p').textContent =
      e.name === 'NotAllowedError'
        ? 'Permiso de cámara denegado. Activalo en el navegador para leer los tags.'
        : 'No se pudo abrir la cámara.';
    toast('Cámara no disponible', 'err');
  }
}

function detenerCamara() {
  if (scanLoop) { clearInterval(scanLoop); scanLoop = null; }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  video.srcObject = null;
}

function actualizarHintScan() {
  const est = estadoDetector();
  const hint = $('#scan-hint');
  if (est === 'cargando') hint.textContent = 'Preparando lector… apuntá al tag del techo';
  else if (est === 'fallo') hint.textContent = 'Lector no disponible · usá "Ingresar tag a mano"';
  else hint.textContent = 'Apuntá al tag del techo';

  // Línea de diagnóstico (ayuda a entender por qué "no detecta").
  const diagEl = $('#scan-diag');
  if (!diagEl) return;
  const d = diagDetector();
  if (d.estado === 'fallo') {
    diagEl.textContent = `WASM no cargó${d.error ? ' · ' + d.error : ''} · respaldo QR / manual`;
  } else if (d.estado === 'cargando') {
    diagEl.textContent = 'Cargando decodificador AprilTag…';
  } else {
    diagEl.textContent = `Lector OK · ${d.via} · frames ${d.frames} · tags en vista ${d.ultimaCantidad}`;
  }
}

function iniciarScanLoop() {
  if (scanLoop) clearInterval(scanLoop);
  let leyendo = false;
  scanLoop = setInterval(async () => {
    if (!stream || leyendo) return;
    leyendo = true;
    try {
      actualizarHintScan();
      const tag = await leerTagDeVideo(video, canvas);
      if (tag !== null) {
        $('.scan-frame').classList.add('hit');
        detenerCamara();
        procesarTag(tag);
      }
    } finally { leyendo = false; }
  }, 350);
}

// Qué hacer con un tag leído (o ingresado a mano).
function procesarTag(tag) {
  const a = porTag.get(tag);
  if (!a) { avisoTag('Tag no reconocido', `El tag #${tag} no figura en el inventario.`); return; }
  if (a.estado === 'retirado') { avisoTag('Ya estaba retirado', `#${tag} · ${a.modelo} ya fue cargado.`); return; }
  if (a.estado !== 'a_retirar') {
    avisoTag('Fuera de la orden', `#${tag} · ${a.modelo} no está en la orden ${ORDEN.id}. Confirmá con el operador antes de cargarlo.`);
    return;
  }
  confirmarRetiro(a);
}

$('#btn-cam').addEventListener('click', iniciarCamara);
$('#btn-manual').addEventListener('click', () => {
  const v = prompt('Número de tag del techo (0–29):');
  if (v === null) return;
  const n = parseInt(v.trim(), 10);
  if (!Number.isFinite(n)) { toast('Tag inválido', 'err'); return; }
  detenerCamara();
  procesarTag(n);
});

/* ------------------------------------------------------------------ *
 * GPS
 * ------------------------------------------------------------------ */
const gps = new RastreoGPS({
  onUpdate: (p) => pintarGPS(p),
  onError: (msg) => { setChipGPS('err'); $('#gps-state-txt').textContent = msg; $('#gps-state').className = 'gps-state err'; toast(msg, 'err'); },
});
let gpsOn = false;

function pintarGPS(p) {
  setChipGPS('on');
  $('#gps-state').className = 'gps-state on';
  $('#gps-state-txt').textContent = 'Compartiendo ubicación';
  $('#gps-lat').textContent = p.lat.toFixed(6);
  $('#gps-lon').textContent = p.lon.toFixed(6);
  $('#gps-acc').textContent = `± ${Math.round(p.acc)} m`;
  $('#gps-env').textContent = new Date(p.ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const maps = $('#gps-maps');
  maps.hidden = false;
  maps.href = `https://www.google.com/maps?q=${p.lat},${p.lon}`;
}

function setChipGPS(estado) {
  const chip = $('#chip-gps');
  chip.className = 'chip chip-gps' + (estado ? ' ' + estado : '');
  $('#chip-gps-txt').textContent = estado === 'on' ? 'GPS on' : estado === 'err' ? 'GPS !' : 'GPS';
}

function toggleGPS() {
  gpsOn = !gpsOn;
  if (gpsOn) {
    gps.iniciar();
    $('#btn-gps').textContent = 'Dejar de compartir';
    $('#gps-state-txt').textContent = 'Buscando señal…';
    setChipGPS('on');
  } else {
    gps.detener();
    $('#btn-gps').textContent = 'Compartir ubicación';
    $('#gps-state').className = 'gps-state';
    $('#gps-state-txt').textContent = 'Ubicación en pausa';
    setChipGPS('');
  }
}
$('#btn-gps').addEventListener('click', toggleGPS);
$('#chip-gps').addEventListener('click', () => { irA('gps'); if (!gpsOn) toggleGPS(); });

// Compartir ubicación automáticamente al entrar.
// Si el permiso ya fue concedido, arranca en silencio; si está "prompt",
// igual lo pide (el chofer debe compartir su posición para esta app).
async function arrancarGPSAuto() {
  if (gpsOn || !('geolocation' in navigator)) return;
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const st = await navigator.permissions.query({ name: 'geolocation' });
      if (st.state === 'denied') { setChipGPS('err'); return; }
      // Re-arranca solo si el permiso pasa a concedido más tarde.
      st.onchange = () => { if (st.state === 'granted' && !gpsOn) toggleGPS(); };
    }
  } catch { /* Permissions API no disponible: seguimos igual */ }
  toggleGPS();
}

/* ------------------------------------------------------------------ *
 * Toast
 * ------------------------------------------------------------------ */
let toastT = null;
function toast(msg, tipo = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (tipo ? ' ' + tipo : '');
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ------------------------------------------------------------------ *
 * Persistencia local del progreso (reabrir sin perder lo retirado)
 * ------------------------------------------------------------------ */
function guardarEstado() {
  try {
    const estados = Object.fromEntries(AUTOS.map(a => [a.tag, a.estado]));
    localStorage.setItem('yf_estados_' + ORDEN.id, JSON.stringify(estados));
  } catch { /* modo privado / sin storage */ }
}
function restaurarEstado() {
  try {
    const raw = localStorage.getItem('yf_estados_' + ORDEN.id);
    if (!raw) return;
    const estados = JSON.parse(raw);
    for (const a of AUTOS) if (estados[a.tag]) a.estado = estados[a.tag];
  } catch { /* ignorar */ }
}

/* ------------------------------------------------------------------ *
 * Instalar como app (PWA)
 * ------------------------------------------------------------------ */
let promptInstalar = null;

function esStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true; // iOS
}
function esIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

function mostrarBannerInstalar() {
  if (esStandalone()) return;                 // ya está instalada
  if (localStorage.getItem('yf_install_off') === '1') return; // el usuario lo cerró
  const banner = $('#install');
  if (!banner) return;
  banner.hidden = false;
  // En iOS no hay beforeinstallprompt: mostramos instrucciones manuales.
  if (esIOS() && !promptInstalar) {
    $('#install-txt').textContent = 'Instalar: tocá Compartir y luego “Agregar a inicio”.';
    $('#install-go').hidden = true;
  }
}
function ocultarBannerInstalar(recordar) {
  const banner = $('#install');
  if (banner) banner.hidden = true;
  if (recordar) { try { localStorage.setItem('yf_install_off', '1'); } catch {} }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();          // evitamos el mini-infobar nativo
  promptInstalar = e;          // lo disparamos desde nuestro botón
  mostrarBannerInstalar();
});

window.addEventListener('appinstalled', () => {
  promptInstalar = null;
  ocultarBannerInstalar(true);
  toast('App instalada ✓', 'ok');
});

function cablearInstalar() {
  const go = $('#install-go');
  const no = $('#install-no');
  if (go) go.addEventListener('click', async () => {
    if (!promptInstalar) return;
    promptInstalar.prompt();
    try { await promptInstalar.userChoice; } catch {}
    promptInstalar = null;
    ocultarBannerInstalar(false);
  });
  if (no) no.addEventListener('click', () => ocultarBannerInstalar(true));
  // iOS (u otros navegadores sin evento): mostrar igualmente la ayuda si no está instalada.
  if ((esIOS() || esStandalone()) ) mostrarBannerInstalar();
}

/* ------------------------------------------------------------------ *
 * Service worker (PWA offline)
 * ------------------------------------------------------------------ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/* ------------------------------------------------------------------ *
 * Arranque
 * ------------------------------------------------------------------ */
renderTodo();
cablearInstalar();
arrancarGPSAuto();
