---
version: 1
slug: "web-index-html"
primary_target: "web/index.html"
related_targets: ["web/styles.css","web/yard-layout.js","web/app.js"]
---

## Direction contract

**THESIS:** Patio is a wayfinding system for finding a specific vehicle, not a fleet dashboard. The map is the destination; the selected vehicle's lot and coordinates become an unmistakable sign.

**OWN-WORLD:** Terminal wayfinding: charcoal ground, durable white labels, signal-yellow destination panels, green for confirmed located vehicles, and compact tabular coordinates. Square-edged panels and high-contrast directional cues; color must carry state, not decoration.

**STORY:** Operators arrive to locate an auto, search its real identifier or descriptive data, read its lot/position on the six-lot plan, then inspect its existing read-only detail. Search results point back to the map; close or clear returns to the whole yard. Empty, loading, stale/no-flight, and error states remain explicit.

**FIRST VIEWPORT:** A compact brand/navigation rail leads into the page title and live inventory status. A prominent yellow search-and-destination band precedes the largest element, the interactive six-lot plan. On selection, a high-contrast wayfinding sign beside the plan identifies lot, coordinates, vehicle and available detail; summary metrics stay secondary and compact. The map and all six lots remain visible at desktop scale.

**FORM:** Selected direction: “Señalización de orientación,” winning challenger from the direction roll, seed: seed:f3e3968e128bfbbd. Code-led build; the chosen HTML sketch is the composition reference. Preserve web semantics, visible keyboard focus, responsive behavior, current data/API, and read-only operation. Do not imply dispatch, routes, or availability from empty spaces.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
