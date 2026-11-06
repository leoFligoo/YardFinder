# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Operadores y administradores de playones que necesitan inventariar y localizar vehículos.

## Product Purpose

Yard Finder convierte imágenes de vuelos de dron en un inventario consultable de vehículos con ubicación. El resultado buscado es poder identificar y ubicar los autos del playón con sus datos asociados.

## Positioning

Combina detección de vehículos en imágenes aéreas con lectura de AprilTags y geolocalización para vincular cada observación con lote y posición.

## Operating Context

El flujo habitual va desde fotos o videos de un dron DJI hasta el procesamiento local, la base SQLite y la consulta de resultados en una interfaz web local. La UI de Patio presenta seis lotes con posiciones y fichas de vehículos.

## Capabilities and Constraints

- Procesa fotos y videos, detecta vehículos con YOLO OBB, lee AprilTags, estima ubicación y guarda resultados en SQLite.
- La interfaz web funciona localmente; la UI de Patio consulta el último vuelo y no modifica la base.
- Los datos incluidos contienen ejemplos y deben entenderse como datos de prueba.
- El chat de búsqueda, selección de hasta ocho vehículos y sugerencia de recorrido están diseñados pero aún no implementados.
- La posición depende del GPS del dron y tiene limitaciones de precisión documentadas en LEEME.md.

## Evidence on Hand

- Datos de prueba en `inventario.db` y `salida/`.
- Modelo local `modelos/yolo11s-obb.pt`.
- Mockups de referencia descritos en `README.md`; no representan funcionalidades implementadas.

## Product Principles

- Mantener el procesamiento y la consulta localmente.
- Distinguir claramente observaciones reales de datos de demostración.
- No inferir disponibilidad de despacho a partir de una posición vacía.
- Preservar la integridad del inventario durante la consulta.
