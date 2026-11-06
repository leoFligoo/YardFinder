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

Ver [LEEME.md](LEEME.md) para configuración, procesamiento de fotos/video y comandos de diagnóstico.

## Estado del proyecto

- Implementado: procesamiento de fotos y video con SRT, detección de vehículos y tags, inventario y mapas.
- Incluido: ejemplo precalculado con 123 detecciones, modelo local y Leaflet 1.9.4 con su licencia.
- Diseñado, pendiente de implementar: despacho por chat, capacidad máxima de 8 autos por camión y recorrido
  sugerido con cada vehículo seleccionado marcado en el mapa.

Los [mockups v2](output/imagegen/yard-finder-demo-v2) son referencias visuales con datos simulados.
También están disponibles como [ZIP](output/imagegen/yard-finder-demo-v2.zip).

## Estructura para frontend

| Archivo | Uso |
|---|---|
| `interfaz.html` | UI principal, estilos y JavaScript |
| `plantilla_mapa.html` | Mapa y buscador de vehículos |
| `interfaz.py` | Servidor local y API |
| `vendor/leaflet/` | Biblioteca y recursos del mapa offline |

No se necesita Node.js ni un proceso de compilación del frontend.
