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

- Cada lote muestra «20 disponibles». Los contadores se calculan de esta distribución de ejemplo.
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

La disponibilidad es simulada: todas las posiciones del ejemplo están disponibles.
El plano no consulta `inventario.db`. Al abrir la ficha se lee `web/data/patio.json` y se asocian
las posiciones a los IDs 1–120 del ejemplo, en orden por lote, fila y columna. Esta asociación
es **simulada**, no una vinculación inferida por GPS: la ficha lo indica y distingue el lote del
plano del sector original de la observación. Se muestran los recortes y atributos originales;
los datos ausentes no se inventan. Cerrar o cambiar rápidamente de posición ignora respuestas
pendientes de la ficha anterior. La integración con el inventario real y el recorrido quedan pendientes. Los archivos originales,
ortofotos y el mapa de resultados siguen disponibles en el flujo anterior del servidor (`/`).

Solo Patio está implementado en esta entrega. Los accesos restantes explican que están pendientes;
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
| `web/app.js` | Pantalla Patio y navegación |
| `web/data.js`, `web/state.js` | Adaptador de datos y estado compartido para las siguientes pantallas |
| `web/yard-layout.js` | Generador y plano SVG interactivo de 6 lotes × 20 posiciones |
| `web/yard-geometry.js` | Calles, entrada/salida y red de circulación compartida con futuras rutas |
| `web/vehicle-list.js` | Componente reservado para coincidencias del chat; no montado en Patio |
| `web/vehicle-detail.js` | Ficha, carga de observaciones y asociación explícita para la demo |
| `web/data/patio.json` | Snapshot histórico de observaciones usado por las fichas |
| `plantilla_mapa.html` | Mapa y buscador de vehículos |
| `interfaz.py` | Servidor local y API |
| `vendor/leaflet/` | Biblioteca y recursos del mapa offline |

No se necesita Node.js ni un proceso de compilación del frontend.
