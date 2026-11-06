---
name: Yard Finder — Patio
description: Sistema de señalización de orientación de la interfaz Patio en /ui. No aplica a la configuración ni al procesamiento legacy de interfaz.html.
colors:
  ground: "#11151b"
  panel: "#1b222b"
  panel-light: "#252e39"
  line: "#424b55"
  text: "#f3f4f6"
  muted: "#c0c7cf"
  signal-yellow: "#f5c400"
  located-green: "#50df91"
  alert-red: "#ff8585"
typography:
  body:
    fontFamily: "Arial, \"Helvetica Neue\", sans-serif"
    fontSize: "14px"
    lineHeight: 1.45
  display:
    fontFamily: "Barlow Condensed, Arial, sans-serif"
    fontSize: "clamp(27px, 2.5vw, 35px)"
    fontWeight: 800
    lineHeight: 1.08
  coordinate:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12px"
rounded:
  compact: "2px"
  standard: "3px"
spacing:
  compact: "8px"
  standard: "12px"
  comfortable: "16px"
components:
  destination-band:
    backgroundColor: "{colors.signal-yellow}"
    rounded: "3px"
  selected-vehicle:
    backgroundColor: "{colors.signal-yellow}"
    rounded: "2px"
  yard-viewport:
    backgroundColor: "{colors.panel}"
    rounded: "2px"
---

# Design System: Yard Finder — Patio

## Overview

**Creative North Star: “Señalización de orientación”**

Patio is a wayfinding system for locating a specific vehicle, not a fleet dashboard. The six-lot plan is the destination; the selected vehicle's lot and coordinates become an unmistakable sign. This documents the selected direction for the new `/ui` Patio system while preserving the separate legacy experience.

**Boundary:** These normative tokens and patterns apply only to Patio served at `/ui` (`web/index.html`, `web/styles.css`, `web/wayfinding.css`). `interfaz.html` legacy configuration and processing remain untouched and retain their previous system; this document does not apply the Patio system to that legacy surface.

**Key Characteristics:**
- Terminal wayfinding: charcoal ground, durable white labels, and a broad signal-yellow destination band.
- Green means a confirmed located vehicle; yellow means destination, action, or selection.
- Compact horizontal navigation and metric strip keep the six-lot plan dominant.

## Colors

### Primary
- **Signal yellow** (`{colors.signal-yellow}`, `#f5c400`): destination band, primary action, focus, and selected vehicle.

### Secondary
- **Located green** (`{colors.located-green}`, `#50df91`): located vehicles and positive location state.

### Tertiary
- **Alert red** (`{colors.alert-red}`, `#ff8585`): alert/error text.

### Neutral
- **Ground** (`{colors.ground}`, `#11151b`): overall field and dark search surface.
- **Panel** (`{colors.panel}`, `#1b222b`) and **panel light** (`{colors.panel-light}`, `#252e39`): plan and raised controls.
- **Line** (`{colors.line}`, `#424b55`): dividers and boundaries.
- **Text** (`{colors.text}`, `#f3f4f6`) and **muted** (`{colors.muted}`, `#c0c7cf`): primary and secondary text.

Use signal colors to encode action, destination, or state, not as unrelated decoration. Yellow selection and green located state must remain distinct.

## Typography

**Display Font:** Barlow Condensed ExtraBold (local OFL-licensed font at `web/fonts/BarlowCondensed-ExtraBold.ttf`)
**Body Font:** Arial, “Helvetica Neue”, sans-serif
**Coordinate Font:** ui-monospace, SFMono-Regular, Menlo, monospace

Barlow Condensed ExtraBold is reserved for sign/display labels, headings, lot labels, and prominent metrics. Arial carries interface reading; coordinates use tabular monospace.

### Hierarchy
- **Page heading:** Barlow Condensed ExtraBold, `clamp(27px, 2.5vw, 35px)`, line-height 1.08.
- **Body:** Arial, 14px base, line-height 1.45.
- **Coordinate:** ui-monospace, 12px in the plan and search results.
- **Compact supporting labels:** Arial, typically 9–12px as used by the interface.

## Layout

The Patio header is a 68px horizontal brand/navigation rail. The main content is centered up to 1720px. A compact heading and horizontal metric strip precede the broad yellow search/destination band. The interactive six-lot plan is the largest work area; the selected-vehicle card sits beside it at wide sizes. The metrics remain compact and secondary.

Responsive breakpoints in `web/wayfinding.css` are 980px, 720px, and 420px. At 980px the detail card stacks below the plan; at 720px the rail becomes a compact brand row with horizontally scrollable navigation and the destination search stacks; at 420px the heading and metrics tighten further. On narrow screens the plan retains a 540px minimum width within its horizontally scrollable viewport so all six lots remain inspectable.

## Elevation & Depth

The system is flat by default. Separate the ground, panels, and controls with tonal contrast and visible borders. The search-results overlay uses `0 8px 20px #0008` for separation; do not add persistent decorative shadows to the plan or vehicle card.

## Shapes

Forms are squared and compact: 2px for plan controls, search, viewport, and selected-vehicle card; 3px for destination band, buttons, and navigation. Thin strokes and borders provide structure. Avoid the rounded-card language of the earlier Patio styling.

## Components

### Navigation
Compact horizontal navigation sits in the top rail. The active Patio item is yellow with dark text; inactive items remain muted on the dark ground. At 720px the row can scroll horizontally.

```html
<a class="nav-item active" href="#/patio" aria-current="page">Patio</a>
```

### Destination search band
The destination band is a broad yellow field containing the orientation label and dark search input. Its squared 3px edge makes it read as signage rather than a floating card.

```html
<section class="yard-destination">
  <div class="destination-copy"><label for="yard-vehicle-search">DESTINO: VEHÍCULO</label></div>
  <div class="yard-search-field">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg>
    <input id="yard-vehicle-search" type="search" placeholder="ID, VIN, patente, modelo…">
  </div>
</section>
```

### Metric strip
Four compact inline metrics are separated by hairline dividers; the first located-vehicle value uses green. They provide context without competing with the plan.

```html
<section class="stats" aria-label="Resumen de la distribución">
  <article class="stat"><div><strong>—</strong><span>Autos ubicados</span></div></article>
  <article class="stat"><div><strong>—</strong><span>Lotes</span></div></article>
</section>
```

### Six-lot plan
The plan sits on a dark gridded viewport with squared boundary. Green vehicles indicate located state; selecting one changes its mark and coordinate emphasis to yellow. Empty positions are not a signal of dispatch availability.

```css
.yard-viewport { border: 1px solid #59636d; border-radius: 2px; background-color: #1b222b; }
.yard-car { color: #50df91; }
.yard-car[aria-pressed="true"] { color: #f5c400; }
.yard-car[aria-pressed="true"] .yard-bay { fill: #f5c40028; stroke: #f5c400; stroke-width: 2.4; }
```

### Selected-vehicle card
When a vehicle is selected, its card is a high-contrast yellow sign beside the plan (below it at narrower widths), with dark text and a squared edge. It reports the existing vehicle detail; it does not imply reservation or dispatch.

```html
<aside id="vehicle-card" class="panel vehicle-card yard-vehicle-card" aria-labelledby="vehicle-title" hidden>
  <div class="card-heading"><h2 id="vehicle-title">Auto</h2></div>
  <dl id="vehicle-info"></dl>
</aside>
```

### Focus and controls
Keyboard focus is a visible 3px yellow outline with 3px offset in Patio. Controls use dark panel surfaces and compact 2–3px corners.

```css
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible,
[tabindex]:focus-visible { outline: 3px solid #f5c400; outline-offset: 3px; }
```

## Do's and Don'ts

### Do:
- **Do** keep the six-lot plan as the primary destination and the metric strip secondary.
- **Do** use yellow for destination/action/selection and green for located state.
- **Do** keep focus visible and preserve the compact, squared wayfinding language.
- **Do** keep the legacy boundary explicit: Patio `/ui` tokens are not `interfaz.html` tokens.

### Don't:
- **Don't** infer dispatch availability from empty positions or imply that viewing reserves a vehicle.
- **Don't** use yellow and green interchangeably.
- **Don't** apply this Patio system to legacy `interfaz.html` configuration or processing.
- **Don't** add rounded, shadow-heavy dashboard cards that compete with the plan.
