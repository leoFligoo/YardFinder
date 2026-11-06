// dispatch.js — "Planificar por chat": busca autos en inventario.db en lenguaje
// natural, llamando al endpoint local /api/despacho (que usa Claude o un parseo
// local de respaldo). Muestra las coincidencias y la ruta de retiro sugerida.
import {renderIcons} from './icons.js';

const $ = id => document.getElementById(id);
const dialog = $('chat-dialog');
const form = $('chat-form');
const input = $('chat-input');
const result = $('chat-result');

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function posTexto(a) {
  const p = a.pos || {};
  return `Lote ${a.lote} · X${p.x}·Y${p.y}`;
}

function render(data) {
  result.replaceChildren();
  if (!data.ok) {
    result.append(el('p', 'chat-error', data.error || 'No se pudo procesar el pedido.'));
    return;
  }

  // Resumen de lo interpretado.
  const c = data.criterios || {};
  const resumen = el('div', 'chat-summary');
  const badge = el('span', 'chat-mode ' + (data.modo === 'ia' ? 'ia' : 'local'),
    data.modo === 'ia' ? 'IA' : 'Local');
  resumen.append(badge);
  const partes = [];
  if (c.cantidad) partes.push(`${c.cantidad}`);
  if (c.modelo) partes.push(c.modelo);
  if (c.color) partes.push(c.color);
  if (c.lote) partes.push(`lote ${c.lote}`);
  resumen.append(el('span', null, partes.length ? `Interpreté: ${partes.join(' · ')}` : 'Sin filtros específicos'));
  result.append(resumen);

  // Conteo.
  const linea = data.encontrados === 0
    ? 'No encontré autos que coincidan.'
    : `${data.encontrados} auto(s) coinciden` +
      (data.recortado ? ` · muestro ${data.entregados} según la cantidad pedida` : '') +
      ` · ruta ≈ ${data.pasos_ruta} pasos`;
  result.append(el('p', 'chat-count', linea));

  if (data.nota) result.append(el('p', 'small-note', data.nota));

  if (data.encontrados > data.capacidad && !data.recortado) {
    result.append(el('p', 'small-note', `Un camión lleva hasta ${data.capacidad}. Afiná el pedido o indicá una cantidad.`));
  }

  // Lista ordenada por ruta de retiro.
  if (data.ruta.length) {
    const ol = el('ol', 'chat-list');
    data.ruta.forEach(a => {
      const li = el('li', 'chat-item');
      const info = el('div', 'chat-item-info');
      info.append(el('strong', null, a.modelo || `Tag #${a.tag ?? '—'}`));
      info.append(el('span', 'chat-item-sub', `${a.color || 'sin color'} · ${posTexto(a)}`));
      li.append(info);
      if (a.tag != null) li.append(el('span', 'chat-tag', `#${a.tag}`));
      ol.append(li);
    });
    result.append(ol);
  }
}

async function buscar(texto) {
  result.replaceChildren(el('p', 'chat-count', 'Buscando…'));
  try {
    const resp = await fetch('/api/despacho', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({texto}),
    });
    const data = await resp.json();
    render(data);
  } catch (e) {
    result.replaceChildren(el('p', 'chat-error', 'No se pudo contactar el servidor local.'));
  }
}

if ($('open-chat') && dialog) {
  $('open-chat').addEventListener('click', () => {
    dialog.showModal();
    renderIcons();
    input.focus();
  });
  $('chat-close').addEventListener('click', () => dialog.close());
  form.addEventListener('submit', e => {
    e.preventDefault();
    const texto = input.value.trim();
    if (texto) buscar(texto);
  });
}
