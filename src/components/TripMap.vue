<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { useTripStore } from '../stores/trip'
import { mediaUrl, type Media } from '../lib/manifest'
import { TYPE_META } from '../lib/typeMeta'
import { dateSpan, localDateTime, pad2 } from '../lib/format'
import { useViewport } from '../composables/useViewport'
import { addBasemap } from '../lib/basemap'

const store = useTripStore()
const { isMobile } = useViewport()
const el = ref<HTMLDivElement | null>(null)

let map: L.Map | null = null
let cluster: L.MarkerClusterGroup | null = null
let routeBase: L.Polyline | null = null
let routeGlow: L.Polyline | null = null
let routeDone: L.Polyline | null = null
let headMarker: L.Marker | null = null
const legLayer = L.layerGroup()
const badgeLayer = L.layerGroup()
const magnetLayer = L.layerGroup()
const medalLayer = L.layerGroup()
const legHi = new Map<number, L.Polyline>()
let hoverTip: L.Tooltip | null = null

const AMBER = '#E6B56A'
const BRASS2 = '#7E5620'
const BRASS3 = '#AE7E36'
const BRASS6 = '#FFF0CC'

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function fitPadding(): L.FitBoundsOptions {
  if (isMobile.value) return { paddingTopLeft: [24, 110], paddingBottomRight: [24, 200] }
  const panel = 400 + 32
  return { paddingTopLeft: [panel + 24, 80], paddingBottomRight: [40, 130] }
}

// ---------------- route ----------------
function drawRoute() {
  if (!map) return
  const pts = store.route.map((p) => [p.lat, p.lon] as [number, number])
  routeGlow?.remove()
  routeBase?.remove()
  routeDone?.remove()
  if (!pts.length) return
  routeGlow = L.polyline(pts, { pane: 'routePane', color: BRASS2, weight: 9, opacity: 0.35, interactive: false, lineCap: 'round', lineJoin: 'round' }).addTo(map)
  routeBase = L.polyline(pts, { pane: 'routePane', color: BRASS3, weight: 2.5, opacity: 0.55, interactive: false, dashArray: '1 6', lineCap: 'round' }).addTo(map)
  routeDone = L.polyline(pts, { pane: 'routePane', color: AMBER, weight: 3.5, opacity: 1, interactive: false, lineCap: 'round', lineJoin: 'round' }).addTo(map)
  map.fitBounds(L.latLngBounds(pts), fitPadding())
  updateProgress()
}

function updateProgress() {
  if (!map || !routeDone) return
  const r = store.route
  if (store.atEnd) {
    routeDone.setLatLngs(r.map((p) => [p.lat, p.lon]))
    headMarker?.remove()
    headMarker = null
    return
  }
  const i = store.routeIndexAt(store.t)
  const pts: L.LatLngExpression[] = []
  for (let k = 0; k <= i && k < r.length; k++) pts.push([r[k]!.lat, r[k]!.lon])
  const head = store.headPosition
  if (head) pts.push(head)
  routeDone.setLatLngs(pts)
  if (head) {
    if (!headMarker) {
      headMarker = L.marker(head, {
        pane: 'headPane',
        interactive: false,
        icon: L.divIcon({ className: '', html: '<div class="rt-head"><i></i></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
      }).addTo(map)
    } else headMarker.setLatLng(head)
    if (store.playing && !map.getBounds().pad(-0.15).contains(head)) map.panTo(head, { animate: true, duration: 0.6 })
  }
}

// ---------------- episodes ----------------
function drawEpisodes() {
  if (!map) return
  legLayer.clearLayers()
  badgeLayer.clearLayers()
  legHi.clear()
  for (const e of store.episodes) {
    const path = store.episodePaths.get(e.ep)
    const tip = `<div class="rt-tip-ep"><b>E${pad2(e.ep)}</b> ${esc(e.title)}<br><span>${dateSpan(e.start, e.end)} · click to play</span></div>`
    let at: L.LatLngExpression | null = null
    if (path) {
      const hi = L.polyline(path, { pane: 'legPane', color: BRASS6, weight: 5, opacity: 0, interactive: false, lineCap: 'round', lineJoin: 'round' })
      const hit = L.polyline(path, { pane: 'legPane', color: '#000', weight: 18, opacity: 0.01, className: 'rt-leg-hit' })
      hit.bindTooltip(tip, { sticky: true, className: 'rt-tip', direction: 'top', offset: [0, -8] })
      hit.on('click', () => store.showEpisode(e.ep))
      hit.on('mouseover', () => (store.hoverEpisode = e.ep))
      hit.on('mouseout', () => store.hoverEpisode === e.ep && (store.hoverEpisode = null))
      legLayer.addLayer(hi).addLayer(hit)
      legHi.set(e.ep, hi)
      at = path[Math.floor(path.length / 2)]!
    } else {
      // no leg (E36 epilogue) → at home, end of the route
      const r = store.route
      const last = r[r.length - 1]
      if (last) at = [last.lat, last.lon]
    }
    if (at) {
      const home = !path
      const b = L.marker(at, {
        pane: 'badgePane',
        riseOnHover: true,
        keyboard: true,
        title: `Episode ${e.ep}: ${e.title}`,
        icon: L.divIcon({
          className: '',
          html: `<button class="rt-badge${home ? ' rt-badge-home' : ''}" data-ep="${e.ep}">${home ? '⌂ ' : ''}${pad2(e.ep)}</button>`,
          iconSize: home ? [44, 24] : [30, 24],
          iconAnchor: home ? [22, -6] : [15, 12],
        }),
      })
      b.bindTooltip(tip, { className: 'rt-tip', direction: 'top', offset: [0, -12] })
      b.on('click', () => store.showEpisode(e.ep))
      b.on('mouseover', () => (store.hoverEpisode = e.ep))
      b.on('mouseout', () => store.hoverEpisode === e.ep && (store.hoverEpisode = null))
      badgeLayer.addLayer(b)
    }
  }
  applyEpisodeHighlight()
  applyLayerToggles()
}

function applyEpisodeHighlight() {
  const current = store.atEnd ? null : store.currentEpisode?.ep
  for (const [ep, hi] of legHi) {
    const on = ep === store.hoverEpisode || ep === store.openEpisode
    hi.setStyle({ opacity: on ? 0.95 : ep === current ? 0.55 : 0 })
  }
  badgeLayer.eachLayer((l) => {
    const btn = (l as L.Marker).getElement()?.querySelector('.rt-badge') as HTMLElement | null
    if (!btn) return
    const ep = Number(btn.dataset.ep)
    btn.classList.toggle('is-on', ep === store.hoverEpisode || ep === store.openEpisode)
    btn.classList.toggle('is-current', ep === current)
    btn.classList.toggle('is-future', !store.atEnd && !!store.episodeByNum.get(ep) && store.episodeByNum.get(ep)!.start > store.currentLocalDate)
  })
}

// ---------------- magnets ----------------
function drawMagnets() {
  magnetLayer.clearLayers()
  for (const m of store.magnets) {
    const mk = L.marker([m.lat, m.lon], {
      pane: 'magnetPane',
      riseOnHover: true,
      icon: L.divIcon({
        className: '',
        html: `<div class="rt-magnet${m.kind === 'park' ? ' is-park' : ''}"><img src="${esc(mediaUrl(m.src))}" alt="" loading="lazy" decoding="async"></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      }),
    })
    mk.bindTooltip(`<div class="rt-tip-ep"><b>${esc(m.label)}</b>${m.episode ? `<br><span>Episode ${m.episode}</span>` : ''}</div>`, {
      className: 'rt-tip',
      direction: 'top',
      offset: [0, -16],
    })
    if (m.episode) mk.on('click', () => store.showEpisode(m.episode!))
    magnetLayer.addLayer(mk)
  }
}

function drawMedals() {
  medalLayer.clearLayers()
  for (const md of store.medals) {
    const at = store.episodeEnd(md.ep)
    if (!at) continue
    const mk = L.marker(at, {
      pane: 'magnetPane',
      riseOnHover: true,
      zIndexOffset: 200,
      icon: L.divIcon({
        className: '',
        html: `<div class="rt-medal"><img src="${esc(mediaUrl(md.src))}" alt="" loading="lazy" decoding="async"></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 46],
      }),
    })
    mk.bindTooltip(
      `<div class="rt-tip-ep"><b>${esc(md.name)}</b><br><span>National park ${md.n} of 17 · Episode ${pad2(md.ep)}</span></div>`,
      { className: 'rt-tip', direction: 'top', offset: [0, -44] },
    )
    mk.on('click', () => store.showEpisode(md.ep))
    medalLayer.addLayer(mk)
  }
}

// ---------------- media ----------------
const markerOf = new WeakMap<Media, L.Marker>()
let shownList: Media[] | null = null
let shownN = 0

function mediaIcon(m: Media): L.DivIcon {
  const meta = TYPE_META[m.type] || TYPE_META.photo
  const thumb = mediaUrl(m.thumb || m.poster || (m.type === 'photo' ? m.src : ''))
  const g = meta.glyph ? `<span class="rt-mm-g">${meta.glyph}</span>` : ''
  return L.divIcon({
    className: '',
    html: `<div class="rt-mm" style="--c:${meta.color};${thumb ? `background-image:url('${thumb.replace(/'/g, '%27')}')` : ''}">${g}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

function getMarker(m: Media): L.Marker {
  let mk = markerOf.get(m)
  if (!mk) {
    mk = L.marker([m.lat, m.lon], { icon: mediaIcon(m), keyboard: false })
    ;(mk as L.Marker & { __m?: Media }).__m = m
    markerOf.set(m, mk)
  }
  return mk
}

function syncMedia() {
  if (!cluster) return
  const list = store.filteredMedia
  const n = store.visibleCount
  if (list === shownList) {
    if (n > shownN) cluster.addLayers(list.slice(shownN, n).map(getMarker))
    else if (n < shownN) cluster.removeLayers(list.slice(n, shownN).map(getMarker))
  } else {
    cluster.clearLayers()
    cluster.addLayers(list.slice(0, n).map(getMarker))
  }
  shownList = list
  shownN = n
}

let syncQueued = false
let lastSync = 0
function queueSync() {
  if (syncQueued) return
  syncQueued = true
  const wait = store.playing ? Math.max(0, 150 - (performance.now() - lastSync)) : 0
  setTimeout(() => {
    requestAnimationFrame(() => {
      syncQueued = false
      lastSync = performance.now()
      syncMedia()
    })
  }, wait)
}

function clusterIcon(c: L.MarkerCluster): L.DivIcon {
  const kids = c.getAllChildMarkers() as (L.Marker & { __m?: Media })[]
  const n = kids.length
  const counts: Record<string, number> = {}
  for (const k of kids) {
    const t = k.__m?.type || 'photo'
    counts[t] = (counts[t] || 0) + 1
  }
  let acc = 0
  const stops: string[] = []
  for (const [t, v] of Object.entries(counts)) {
    const col = TYPE_META[t as Media['type']]?.color || AMBER
    const a = (acc / n) * 360
    acc += v
    const b = (acc / n) * 360
    stops.push(`${col} ${a}deg ${b}deg`)
  }
  const size = n < 10 ? 34 : n < 100 ? 40 : n < 1000 ? 48 : 56
  const label = n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n)
  return L.divIcon({
    className: '',
    html: `<div class="rt-mc" style="--ring:conic-gradient(${stops.join(',')});width:${size}px;height:${size}px"><span>${label}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function thumbHtml(m: Media, size: number) {
  const u = mediaUrl(m.thumb || m.poster || (m.type === 'photo' ? m.src : ''))
  return u ? `<img src="${esc(u)}" width="${size}" height="${size}" alt="" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:6px;display:block">` : ''
}

function showMarkerTip(latlng: L.LatLng, html: string) {
  if (!map) return
  if (!hoverTip) hoverTip = L.tooltip({ className: 'rt-tip', direction: 'top', offset: [0, -20], opacity: 1 })
  hoverTip.setLatLng(latlng).setContent(html)
  map.openTooltip(hoverTip)
}
function hideMarkerTip() {
  if (map && hoverTip) map.closeTooltip(hoverTip)
}

function setupCluster() {
  if (!map) return
  cluster = L.markerClusterGroup({
    chunkedLoading: true,
    chunkInterval: 120,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    maxClusterRadius: (z: number) => (z < 8 ? 60 : z < 13 ? 45 : 30),
    disableClusteringAtZoom: 19,
    iconCreateFunction: clusterIcon,
  })
  cluster.on('click', (e: L.LeafletEvent) => {
    const m = (e as unknown as { layer: L.Marker & { __m?: Media } }).layer.__m
    hideMarkerTip()
    if (m) store.openMedia(m)
  })
  if (window.matchMedia('(hover: hover)').matches) {
    cluster.on('mouseover', (e: L.LeafletEvent) => {
      const layer = (e as unknown as { layer: L.Marker & { __m?: Media } }).layer
      const m = layer.__m
      if (!m) return
      const meta = TYPE_META[m.type]
      showMarkerTip(
        layer.getLatLng(),
        `<div class="rt-tip-media">${thumbHtml(m, 150)}<div><b>${meta.short}</b> · ${esc(localDateTime(m.local_time || m.time_utc || m.day))}</div>${
          m.stop != null && store.stopById.get(m.stop) ? `<div class="rt-tip-sub">${esc(store.stopById.get(m.stop)!.name)}</div>` : ''
        }</div>`,
      )
    })
    cluster.on('mouseout', hideMarkerTip)
    cluster.on('clustermouseover', (e: L.LeafletEvent) => {
      const c = (e as unknown as { layer: L.MarkerCluster }).layer
      const kids = c.getAllChildMarkers() as (L.Marker & { __m?: Media })[]
      const pick: Media[] = []
      const step = Math.max(1, Math.floor(kids.length / 4))
      for (let i = 0; i < kids.length && pick.length < 4; i += step) if (kids[i]!.__m) pick.push(kids[i]!.__m!)
      const ms = kids.map((k) => k.__m!).filter(Boolean)
      let a = ms[0]!
      let b = ms[0]!
      for (const m of ms) {
        if (m.t < a.t) a = m
        if (m.t > b.t) b = m
      }
      showMarkerTip(
        c.getLatLng(),
        `<div class="rt-tip-media"><div class="rt-tip-grid">${pick.map((m) => thumbHtml(m, 72)).join('')}</div><div><b>${kids.length}</b> items · ${esc(
          dateSpan(a.day, b.day),
        )}</div><div class="rt-tip-sub">Click to zoom in</div></div>`,
      )
    })
    cluster.on('clustermouseout', hideMarkerTip)
  }
  cluster.on('clusterclick', hideMarkerTip)
  map.addLayer(cluster)
}

function applyLayerToggles() {
  if (!map) return
  const on = store.layers.episodes
  if (on) {
    legLayer.addTo(map)
    badgeLayer.addTo(map)
  } else {
    legLayer.remove()
    badgeLayer.remove()
  }
  if (store.layers.magnets) magnetLayer.addTo(map)
  else magnetLayer.remove()
  if (store.layers.medals) medalLayer.addTo(map)
  else medalLayer.remove()
  if (map.getZoom() < 5) map.getContainer().classList.add('rt-zoomed-out')
  else map.getContainer().classList.remove('rt-zoomed-out')
}

// ---------------- lifecycle ----------------
onMounted(async () => {
  if (!el.value) return
  ;(window as unknown as { L: typeof L }).L = L
  await import('leaflet.markercluster')

  map = L.map(el.value, { zoomControl: false, attributionControl: true, minZoom: 3, worldCopyJump: true, zoomSnap: 0.25, zoomDelta: 0.5 }).setView([41, -100], 4)
  map.createPane('routePane').style.zIndex = '405'
  map.createPane('legPane').style.zIndex = '410'
  map.createPane('headPane').style.zIndex = '640'
  map.createPane('badgePane').style.zIndex = '630'
  map.createPane('magnetPane').style.zIndex = '620'

  map.createPane('labelPane').style.zIndex = '401'
  map.getPane('labelPane')!.style.pointerEvents = 'none'
  addBasemap(map)
  if (!isMobile.value) L.control.zoom({ position: 'topright' }).addTo(map)
  map.attributionControl.setPrefix(false)
  map.on('zoomend', applyLayerToggles)

  setupCluster()
  if (store.status === 'ready') {
    drawRoute()
    drawEpisodes()
    drawMagnets()
    syncMedia()
  }
})

watch(
  () => store.status,
  (s) => {
    if (s !== 'ready' || !map) return
    drawRoute()
    drawEpisodes()
    drawMagnets()
    syncMedia()
  },
)
watch(() => store.magnets, drawMagnets)
watch(() => store.medals, drawMedals)
watch(() => [store.filteredMedia, store.visibleCount], queueSync)

let progQueued = false
watch(
  () => store.t,
  () => {
    if (progQueued) return
    progQueued = true
    requestAnimationFrame(() => {
      progQueued = false
      updateProgress()
      applyEpisodeHighlight()
    })
  },
)
watch(() => [store.hoverEpisode, store.openEpisode], applyEpisodeHighlight)
watch(() => [store.layers.episodes, store.layers.magnets, store.layers.medals], applyLayerToggles)
watch(
  () => store.focus,
  (f) => {
    if (!f || !map) return
    const b = L.latLngBounds(f.bounds)
    if (f.bounds.length === 1 || b.getNorthEast().distanceTo(b.getSouthWest()) < 200) map.flyTo(b.getCenter(), 11, { duration: 0.8 })
    else map.flyToBounds(b, { ...fitPadding(), maxZoom: 12, duration: 0.8 })
  },
)

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div ref="el" class="rt-map absolute inset-0" role="application" aria-label="Trip map"></div>
</template>

<style>
.rt-map {
  z-index: 0;
}
.rt-leg-hit {
  cursor: pointer;
}
.rt-head {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: rgb(230 181 106 / 0.25);
  display: grid;
  place-items: center;
  animation: rt-pulse 1.6s ease-out infinite;
}
.rt-head i {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #fff0cc;
  border: 2px solid #e6b56a;
  box-shadow: 0 0 12px #e6b56a;
}
@keyframes rt-pulse {
  0% {
    box-shadow: 0 0 0 0 rgb(230 181 106 / 0.6);
  }
  100% {
    box-shadow: 0 0 0 16px rgb(230 181 106 / 0);
  }
}
.rt-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  min-width: 30px;
  padding: 0 5px;
  border-radius: 6px;
  background: #101b23;
  color: #f4d38f;
  border: 1.5px solid #ae7e36;
  font-family: var(--font-pixel);
  font-size: 11px;
  line-height: 1;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.5);
  transition: transform 0.12s, background 0.12s, color 0.12s;
}
.rt-badge:hover,
.rt-badge.is-on {
  background: #e6b56a;
  color: #101b23;
  border-color: #fff0cc;
  transform: scale(1.15);
}
.rt-badge.is-current {
  border-color: #fff0cc;
  box-shadow: 0 0 0 3px rgb(230 181 106 / 0.35), 0 2px 8px rgb(0 0 0 / 0.5);
}
.rt-badge.is-future {
  opacity: 0.45;
}
.rt-badge-home {
  min-width: 44px;
  color: #101b23;
  background: #dda95e;
}
.rt-zoomed-out .rt-badge:not(.is-on):not(.is-current):not(.rt-badge-home) {
  min-width: 10px;
  width: 10px;
  height: 10px;
  padding: 0;
  font-size: 0;
  border-radius: 999px;
  background: #e6b56a;
}
.rt-magnet {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: #16242e;
  border: 2px solid #7e5620;
  box-shadow: 0 3px 10px rgb(0 0 0 / 0.55);
  overflow: hidden;
  display: grid;
  place-items: center;
  transition: transform 0.12s;
}
.rt-magnet.is-park {
  border-radius: 999px;
  border-color: #ddaa5e;
}
.rt-magnet img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.rt-magnet:hover {
  transform: scale(1.6);
}
.rt-medal {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  filter: drop-shadow(0 3px 6px rgb(0 0 0 / 0.6));
  transition: transform 0.12s;
}
.rt-medal img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.rt-medal:hover {
  transform: scale(1.8);
}
/* zoomed out: keep the route readable (magnets appear from zoom 5, medals shrink) */
.rt-zoomed-out .rt-medal {
  width: 24px;
  height: 24px;
}
.rt-zoomed-out .rt-magnet {
  display: none;
}
.rt-mm {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: #16242e center / cover no-repeat;
  border: 2px solid var(--c);
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.55);
  position: relative;
  transition: transform 0.12s;
}
.rt-mm:hover {
  transform: scale(1.25);
  z-index: 1;
}
.rt-mm-g {
  position: absolute;
  right: -6px;
  bottom: -6px;
  min-width: 16px;
  height: 14px;
  padding: 0 3px;
  border-radius: 4px;
  background: var(--c);
  color: #101b23;
  font: 700 8px/14px var(--font-ui);
  text-align: center;
  letter-spacing: 0.02em;
}
.rt-mc {
  border-radius: 999px;
  background: var(--ring);
  padding: 3px;
  box-shadow: 0 3px 12px rgb(0 0 0 / 0.55);
  transition: transform 0.12s;
}
.rt-mc:hover {
  transform: scale(1.08);
}
.rt-mc span {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 999px;
  background: #101b23;
  color: #f5f1e7;
  font: 700 13px/1 var(--font-ui);
  letter-spacing: 0.03em;
}
.rt-tip-ep {
  font-size: 13px;
  line-height: 1.3;
  width: max-content;
  max-width: 280px;
  white-space: normal;
}
.rt-tip-ep b {
  color: #e6b56a;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 16px;
  letter-spacing: 0.03em;
  margin-right: 4px;
}
.rt-tip-ep span,
.rt-tip-sub {
  color: #a8b6bb;
  font-size: 12px;
}
.rt-tip-media {
  display: grid;
  gap: 4px;
  font-size: 12px;
  white-space: nowrap;
}
.rt-tip-media b {
  color: #e6b56a;
}
.rt-tip-grid {
  display: grid;
  grid-template-columns: repeat(2, 72px);
  gap: 4px;
}
</style>
