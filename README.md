# Yard Finder

Inventario de vehículos a partir de imágenes de dron DJI, con detección YOLO OBB, lectura de AprilTags,
geolocalización, SQLite y una interfaz web local en HTML/CSS/JavaScript con Leaflet.

## Ejecutar localmente

Con Python 3.12 disponible:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python preparar_demo.py
.venv/bin/python interfaz.py
```

Abrir **http://127.0.0.1:8765**. En el Mac ya preparado basta con `./iniciar_interfaz.command`.
La instalación necesita Internet; la aplicación sirve sus mapas, imágenes y bibliotecas desde el equipo.

### UI 01 · Vista del patio

Con el mismo servidor activo, abrir **http://127.0.0.1:8765/ui/#/patio**.
No requiere instalar paquetes ni compilar el frontend.

**Distribución del patio:** plano interactivo con 6 lotes de 20 posiciones, cada uno con
**4 columnas × 5 filas**. Los autos se dibujan en horizontal y cada lote tiene una calle
izquierda, una central entre las columnas 2 y 3, y una derecha. Tres calles transversales
conectan los lotes y los accesos señalizados de **Entrada** y **Salida**.
Cada lote está delimitado por un único contorno verde sin relleno, que incluye la calle central.

- Cada lote muestra la cantidad de autos ubicados según SQLite. No se infiere disponibilidad para despacho. Las posiciones sin observación quedan vacías.
- Click, Enter o Espacio sobre un auto abre su ficha lateral: recorte, coordenadas, sector, Tag, VIN, patente, modelo, color y confianza. La consulta no lo reserva para despacho. En móvil la ficha aparece debajo del plano; cerrar restaura la vista completa.
- Zoom con +/−, desplazamiento por arrastre al acercar y «Ver todo» para restaurar el plano.
- `x` es la columna (1–4), `y` la fila (1–5), con origen arriba a la izquierda de cada lote.
  Ejemplo: `Lote 3 · (2,4)`, ID `L3-X2-Y4`.
- Se eliminan el mapa fotográfico y su buscador de VIN/tag/ID de esta pantalla.

`web/yard-layout.js` genera las posiciones y dibuja el SVG interactivo.
`web/yard-geometry.js` define el plano, calles, accesos, nodos y aristas de circulación.
Cada posición tiene `accessNodeId`, un punto de recogida sobre una calle, para que el futuro
recorrido no cruce autos estacionados. Los ejes y costos usan unidades del dibujo, **no metros
ni coordenadas GPS**. La red es conceptual y bidireccional; no modela todavía radios de giro,
sentidos únicos ni restricciones físicas de un camión.

El plano consulta **`GET /api/patio`**, que abre `inventario.db` en modo de solo lectura.
Se usa el último vuelo por `fecha DESC, id DESC`, sin mezclar observaciones históricas.
Cada auto se ubica por **`lote + pos_x + pos_y`** y sus datos se unen con `vehiculos` por `tag`.
Los IDs no determinan las posiciones: por ejemplo, Auto #062 está en lote 1, `(4,5)`.
`Actualizar patio` vuelve a leer SQLite y cierra cualquier ficha anterior; no hay actualización automática.

Las posiciones inválidas o duplicadas producen un error visible con reintento; no se sustituyen
por datos de ejemplo. Un vuelo vacío muestra el plano sin autos. Los campos ausentes permanecen
sin identificar y no se escribe ni modifica la base. El inventario incluido contiene datos de prueba.
`web/data/patio.json` se conserva como referencia histórica, pero esta pantalla ya no lo consume.

**`GET /api/patio/recortes/<vuelo_id>/<auto_id>`** busca la observación y resuelve su recorte dentro
de `salida/<nombre_del_vuelo>/recortes/`. Así se aprovechan las imágenes locales aunque SQLite
contenga rutas absolutas de otra computadora. No se exponen esas rutas ni se sirve el archivo `.db`.
Los archivos originales, ortofotos y mapa de resultados siguen disponibles en el flujo anterior (`/`).

Para compartir la UI por un túnel, ejecutar `.venv/bin/python compartir_ui.py` y apuntar el túnel a
`127.0.0.1:8766`. Esa vista solo sirve la UI, la consulta de inventario y sus recortes; bloquea
las APIs de configuración/procesamiento y las solicitudes POST.

Patio e Inventario están implementados. Los accesos restantes explican que están pendientes;
el chat, la selección de hasta 8 autos y el recorrido se incorporan en sus siguientes PRs.

El flujo de Despacho será: **búsqueda escrita en el chat → lista de coincidencias → selección
manual de autos → recorrido sugerido**. Ejemplo: «Buscame los 5 Fiat Cronos blancos».
La lista aparecerá solo después de esa búsqueda, con coordenadas, modelo, color, VIN, AprilTag
y patente. La capacidad del camión sigue siendo de hasta 8 autos.
El componente `web/vehicle-list.js` queda preparado, sin montar en Patio, para conectarlo a los
resultados del chat en la PR de Despacho. No hay búsqueda por chat ni recorrido implementados aún.

Validación (sin dependencias adicionales; Node solo se usa para las pruebas de JavaScript):

```bash
node --test tests/*.test.mjs
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
```

Ver [LEEME.md](LEEME.md) para configuración, procesamiento de fotos/video y comandos de diagnóstico.

### UI 02 · Inventario

Abrir **http://127.0.0.1:8765/ui/#/inventario**. La barra lateral navega entre Patio e Inventario.
Consulta **`GET /api/inventario`**, en una transacción SQLite de solo lectura, sin cambiar ni seedear
`inventario.db`. Usa el último vuelo por `fecha DESC, id DESC` y conserva el catálogo completo.

Los conteos se distinguen explícitamente (valores del inventario de prueba incluido):

| Conteo | Definición | Valor |
|---|---|---:|
| Registrados | Filas en `vehiculos` | 124 |
| Registrados ubicados | Registros con observación por tag en el último vuelo | 109 |
| Sin observación | Registros sin observación en ese vuelo, aunque pudieran tener una histórica | 15 |
| Sin identificar | Observaciones del último vuelo sin registro asociado, incluido tag ausente o desconocido | 11 |
| Observaciones | Detecciones del último vuelo: 109 vinculadas + 11 sin identificar | 120 |

La vista inicial **Registrados** contiene 124 filas, incluyendo las 15 sin ubicación. La vista
**Observaciones sin identificar** contiene las otras 11 detecciones. No se afirma que haya 135 autos
identificados ni se agregan los 15 sin observación al plano. La pertenencia al catálogo se determina
por el vínculo de tag, no por tener un VIN/modelo completo. Un tag repetido dentro del último vuelo
produce un error explícito para no atribuir dos ubicaciones al mismo registro.

- Búsqueda por VIN, AprilTag, modelo, color o ID de observación; ignora mayúsculas y acentos.
- Filtros combinables por modelo, color, lote y estado de ubicación; **Limpiar** restaura los filtros
  y orden dentro de la vista actual. Cambiar de vista limpia filtros para evitar coincidencias ocultas.
- Orden por vehículo, VIN, AprilTag, lote, estado o última observación; datos ausentes al final.
  Paginación de 10, 25 o 50 filas. Búsqueda, filtros y orden restablecen la primera página.
- **Actualizar** vuelve a consultar SQLite conservando los filtros válidos. Los conteos superiores
  corresponden al inventario completo; la cantidad de resultados y la paginación reflejan los filtros.
- **Ver en patio** abre `#/patio?vuelo=<id>&auto=<id>` y enfoca su posición real lote/X/Y y ficha.
  Si cambió el último vuelo, se informa que esa observación ya no está vigente, sin mostrar otra por error.
- Última observación usa la fecha común del vuelo (incluye soporte para formato EXIF). Sin vínculo
  actual se muestra **Sin observación**, sin reutilizar fechas antiguas ni fechas de ingreso.
- Estados de carga, error con reintento, catálogo vacío y búsqueda sin coincidencias. En móvil la
  tabla se desplaza horizontalmente para conservar VIN completo y todas las columnas.
- No hay selección ni reserva desde Inventario. El chat continúa pendiente; no se simulan resultados.
  La ubicación no implica disponibilidad, y no existe patente ni reserva en SQLite.

La vista pública de solo lectura en `8766` permite también el GET exacto `/api/inventario`;
continúa bloqueando POST, APIs administrativas, rutas del sistema y descarga de la base.
No requiere APIs externas, CDNs, dependencias nuevas ni compilación. `web/data/patio.json` no se consulta.

## Estado del proyecto

- Implementado: procesamiento de fotos y video con SRT, detección de vehículos y tags, inventario y mapas.
- Incluido: ejemplo precalculado con 123 detecciones, modelo local y Leaflet 1.9.4 con su licencia.
- Diseñado, pendiente de implementar: despacho por chat, capacidad máxima de 8 autos por camión y recorrido
  sugerido con cada vehículo seleccionado marcado en el mapa.

Los [mockups v3](output/imagegen/yard-finder-demo-v3) son referencias visuales con datos simulados.
El chat y el recorrido muestran una imagen cenital simulada del patio, con la ruta y los ocho autos
seleccionados superpuestos. También están disponibles como [ZIP](output/imagegen/yard-finder-demo-v3.zip).

## Estructura para frontend

| Archivo | Uso |
|---|---|
| `interfaz.html` | UI principal, estilos y JavaScript |
| `web/index.html`, `web/styles.css`, `web/icons.js` | Nueva UI y estructura visual compartida en `/ui/` |
| `web/app.js`, `web/router.js` | Navegación Patio/Inventario y consulta de observaciones por ID |
| `web/inventory.js`, `web/inventory-data.js` | Tabla de Inventario, filtros, conteos, orden y paginación |
| `web/data.js`, `web/state.js` | Adaptador de datos y estado compartido para las siguientes pantallas |
| `web/yard-layout.js` | Generador y plano SVG interactivo de 6 lotes × 20 posiciones |
| `web/yard-geometry.js` | Calles, entrada/salida y red de circulación compartida con futuras rutas |
| `web/vehicle-list.js` | Componente reservado para coincidencias del chat; no montado en Patio |
| `web/vehicle-detail.js` | Ficha del auto vinculado a la posición en SQLite |
| `web/data/patio.json` | Snapshot histórico de observaciones, no usado por Patio ni Inventario |
| `plantilla_mapa.html` | Mapa y buscador de vehículos |
| `interfaz.py` | Servidor local y API |
| `vendor/leaflet/` | Biblioteca y recursos del mapa offline |

No se necesita Node.js ni un proceso de compilación del frontend.
