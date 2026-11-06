# Yard Finder · PWA del chofer

App para el **chofer del camión** que retira autos del playón. Es una PWA
(instalable, funciona offline) con el mismo estilo que la plataforma del operador.

## Qué hace hoy

- **Recorrido**: mapa del playón (6 sectores) con los autos de la orden resaltados,
  próximo auto a cargar y lista de pendientes. Al leer un tag, el auto pasa a *retirado*.
- **Escanear**: abre la cámara trasera y **lee el AprilTag 36h11 del techo** (decodificador
  WASM real, `vendor/`) para confirmar el auto. Al confirmar, se marca como retirado.
- **Mi GPS**: comparte la ubicación del chofer para que el operador de planta sepa
  dónde está. Se actualiza en vivo y se "envía" cada 15 s.

## Probarla

Necesita **HTTPS o localhost** (el GPS, la cámara y el service worker lo exigen).
Desde esta carpeta:

```
python -m http.server 8000
```

y abrí `http://localhost:8000`. En el celular, serví por HTTPS (o túnel) y en Chrome
Android *Instalar app* desde el menú.

- Cámara y GPS piden permiso la primera vez.
- Sin AprilTag a mano, usá **"Ingresar tag a mano"** (números 0–19 del inventario de ejemplo)
  para recorrer todo el flujo.

## Lectura del AprilTag (ya funciona)

El decodificador AprilTag **36h11** (la misma familia que `generar_tags.py`) corre como
WASM en el navegador: `vendor/apriltag_wasm.*` + `vendor/apriltag-loader.js`, de
[arenaxr/apriltag-js-standalone](https://github.com/arenaxr/apriltag-js-standalone).
Se carga solo al abrir la cámara y queda cacheado para offline. Si por algún motivo no
cargara, hay respaldo por QR (`BarcodeDetector`) y entrada manual del tag.

## Lo que falta (fase 2)

Dos integraciones, marcadas en el código con comentarios:

1. **Escritura en la base** — `app.js › sincronizarRetiro()`: hoy solo deja registro en
   consola. Falta el `POST` que marque el auto como `retirado` en `inventario.db`.
2. **Endpoint del operador** — `geo.js › OPERADOR_ENDPOINT`: completar con la URL real
   para enviar la posición del chofer a la planta.

## Archivos

| Archivo | Rol |
|---|---|
| `index.html` / `styles.css` | UI (paleta de `interfaz.html`) |
| `app.js` | Navegación, recorrido, cámara, retiro |
| `data.js` | Inventario y orden de ejemplo (de `tags_0-19.csv`) |
| `geo.js` | GPS del chofer → operador |
| `tag-detector.js` | Orquesta la lectura del tag (WASM + respaldo QR) |
| `vendor/apriltag*` | Decodificador AprilTag 36h11 (WASM) y su loader |
| `sw.js` / `manifest.webmanifest` / `icon.svg` | PWA (offline / instalable) |
