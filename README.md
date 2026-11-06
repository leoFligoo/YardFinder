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

**Distribución del patio:** 6 lotes de 20 autos, cada uno con **4 columnas × 5 filas**.
La sección desplegable «Distribución del patio» permite consultar sus 120 posiciones.
`x` es la columna (1–4) e `y` la fila (1–5), con origen en la esquina superior izquierda
de cada lote. La dirección completa incluye el lote: `Lote 3 · (2,4)`, ID `L3-X2-Y4`.
El generador está en `web/yard-layout.js`. No asigna autos ni inventa coordenadas geográficas:
la vinculación de estas posiciones con detecciones o píxeles de una imagen está pendiente.
Los 5 sectores y 123 detecciones del ejemplo fotográfico inferior siguen siendo datos de referencia,
distintos de los 6 lotes y 120 lugares configurados.

- Vista cenital con las dos ortofotos locales, sectores, zoom y selección de autos.
- Búsqueda por VIN, tag o ID (`#042`), filtro por sector, capas y restablecimiento de vista.
- Recorte y datos de la observación seleccionada, accesibles también desde los resultados de búsqueda.
- El Patio inicial muestra el mapa y permite consultar observaciones. La selección múltiple
  para despacho **no aparece en esta pantalla**.
- Contadores calculados: 123 detecciones con coordenadas, 0 sin ubicación, 25 fuera de sector,
  5 sectores y 12 tags. **Estar fuera de un sector no significa carecer de ubicación.**
- Diseño adaptable a escritorio y móvil; estados de carga, error con reintento y búsqueda vacía.

Se usa una copia de los datos de `ejemplo_resultado/mapa.html` en `web/data/patio.json`,
sin cambiar coordenadas ni duplicar las imágenes. Es un ejemplo precalculado, no el inventario SQLite
en vivo ni una pasada nueva del DJI Air 3S. La precisión y los solapamientos de las ortofotos
son los del ejemplo original. El enlace al mapa de resultados utiliza `salida/demo_local`, generado
por `preparar_demo.py` en la preparación local.

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
| `web/app.js`, `web/map.js` | Pantalla Patio e interacción del mapa Leaflet |
| `web/data.js`, `web/state.js` | Adaptador de datos y estado compartido para las siguientes pantallas |
| `web/yard-layout.js` | Generador de 6 lotes × 20 posiciones con coordenadas locales X/Y |
| `web/vehicle-list.js` | Componente reservado para coincidencias del chat; no montado en Patio |
| `web/data/patio.json` | Snapshot del ejemplo local con procedencia explícita |
| `plantilla_mapa.html` | Mapa y buscador de vehículos |
| `interfaz.py` | Servidor local y API |
| `vendor/leaflet/` | Biblioteca y recursos del mapa offline |

No se necesita Node.js ni un proceso de compilación del frontend.
