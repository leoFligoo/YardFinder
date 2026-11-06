import {assetUrl, hasLocation} from './data.js';

export function createPatioMap(data, onSelect, onImageError) {
  const L = window.L;
  if (!L) throw new Error('Leaflet local no está disponible. Revisá vendor/leaflet.');
  const map = L.map('map', {zoomControl: false, attributionControl: false, minZoom: 17, maxZoom: 23, zoomSnap: .25});
  L.control.zoom({position: 'bottomright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar'}).addTo(map);
  const images = L.layerGroup().addTo(map);
  const sectors = L.layerGroup().addTo(map);
  const vehicles = L.layerGroup().addTo(map);
  const bounds = L.latLngBounds([]);
  data.huellas.forEach(h => {
    const imageBounds = [h.orto.sw, h.orto.ne];
    bounds.extend(imageBounds);
    L.imageOverlay(assetUrl(h.orto.archivo), imageBounds, {alt: `Imagen cenital de ${h.foto}`})
      .on('error', onImageError).addTo(images);
  });
  data.lotes.forEach(l => {
    const polygon = L.polygon(l.anillo, {color: '#ffe181', weight: 1.5, fillOpacity: .035, dashArray: '5 5', interactive: false}).addTo(sectors);
    const label = document.createElement('span');
    label.textContent = l.nombre;
    polygon.bindTooltip(label, {permanent: true, direction: 'center', className: 'sector-label'});
  });
  data.autos.filter(hasLocation).forEach(a => bounds.extend([a.lat, a.lon]));
  function fit() {
    if (bounds.isValid()) map.fitBounds(bounds, {padding: [18, 18], animate: false});
    else map.setView([0, 0], 17);
  }
  fit();
  const markers = new Map();
  let selectedId = null;
  const icon = (auto, selected) => L.divIcon({
    className: `auto-marker ${auto.lote ? 'in-sector' : 'outside'}${selected ? ' selected' : ''}`,
    html: '<span></span>', iconSize: [14, 14], iconAnchor: [7, 7],
  });
  function select(id, focus = false) {
    selectedId = id;
    markers.forEach(({marker, auto}) => {
      marker.setIcon(icon(auto, auto.id === id));
      marker.setZIndexOffset(auto.id === id ? 1000 : 0);
      const element = marker.getElement();
      if (element) {
        element.setAttribute('aria-label', `Auto #${String(auto.id).padStart(3, '0')}, ${auto.lote || 'fuera de sector'}`);
        element.setAttribute('aria-pressed', String(auto.id === id));
      }
    });
    const match = markers.get(id);
    if (focus && match) map.setView(match.marker.getLatLng(), Math.max(map.getZoom(), 21), {animate: false});
  }
  function show(autos) {
    vehicles.clearLayers();
    markers.clear();
    autos.filter(hasLocation).forEach(auto => {
      const marker = L.marker([auto.lat, auto.lon], {
        icon: icon(auto, auto.id === selectedId), keyboard: true,
        title: `Auto #${String(auto.id).padStart(3, '0')} · ${auto.lote || 'Fuera de sector'}`,
      }).on('click', () => onSelect(auto.id)).addTo(vehicles);
      markers.set(auto.id, {marker, auto});
    });
    select(selectedId);
  }
  const observer = new ResizeObserver(() => map.invalidateSize());
  observer.observe(document.getElementById('map'));
  return {
    show, select, fit,
    toggleSectors: visible => visible ? sectors.addTo(map) : sectors.removeFrom(map),
    toggleVehicles: visible => visible ? vehicles.addTo(map) : vehicles.removeFrom(map),
    destroy: () => {observer.disconnect(); map.remove();},
  };
}
