// Dark basemap presets. Pick with VITE_BASEMAP (default 'esri-dark').
//  - esri-dark:   Esri World Dark Gray Canvas (base + label reference layers). No key.
//  - stadia-dark: Stadia Alidade Smooth Dark. Works on localhost; in production the site's
//                 domain must be added to a (free, non-commercial) Stadia account. No key in code.
//  - carto-dark:  CARTO dark_matter. CARTO now watermarks keyless requests ("API key required").
//  - any URL template with {z}/{x}/{y} is used as-is.
import L from 'leaflet'

const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

export function addBasemap(map: L.Map): void {
  const choice = String(import.meta.env.VITE_BASEMAP || 'esri-dark').trim()
  if (choice === 'stadia-dark') {
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      className: 'rt-base rt-base-stadia',
      attribution: `&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> ${OSM}`,
    }).addTo(map)
    return
  }
  if (choice === 'carto-dark') {
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      className: 'rt-base rt-base-carto',
      attribution: `${OSM} &copy; <a href="https://carto.com/attributions">CARTO</a>`,
    }).addTo(map)
    return
  }
  if (choice.includes('{z}')) {
    L.tileLayer(choice, { maxZoom: 20, className: 'rt-base', attribution: OSM }).addTo(map)
    return
  }
  // default: Esri Dark Gray Canvas
  const esri = 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas'
  L.tileLayer(`${esri}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
    maxZoom: 16,
    maxNativeZoom: 16,
    className: 'rt-base rt-base-esri',
    attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community',
  }).addTo(map)
  L.tileLayer(`${esri}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, {
    maxZoom: 16,
    maxNativeZoom: 16,
    className: 'rt-labels',
    pane: 'labelPane',
  }).addTo(map)
}
