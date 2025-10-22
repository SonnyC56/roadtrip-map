<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoadTripStore } from '../stores/roadtrip'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const store = useRoadTripStore()
const mapContainer = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let baselinePolyline: L.Polyline | null = null

// Store all segments with their polylines and markers (pre-rendered)
interface SegmentLayer {
  segment: any
  polyline: L.Polyline | null
  marker: L.CircleMarker | null
}
const segmentLayers: SegmentLayer[] = []

const destinationMarkers: L.Marker[] = []
let allRouteCoords: [number, number][] = []

function parseCoord(coordStr: string): [number, number] {
  const parts = coordStr.replace(/°/g, '').split(', ')
  return [parseFloat(parts[0] || '0'), parseFloat(parts[1] || '0')]
}

function getColorByDate(dateStr: string): string {
  const date = new Date(dateStr)
  const month = date.getMonth()
  if (month === 7) return '#FF6B6B'  // August - red
  if (month === 8) return '#4ECDC4'  // September - teal
  if (month === 9) return '#FF8C42'  // October - orange
  return '#666'
}

function clearAllLayers() {
  if (baselinePolyline) {
    baselinePolyline.remove()
    baselinePolyline = null
  }

  segmentLayers.forEach(layer => {
    if (layer.polyline) layer.polyline.remove()
    if (layer.marker) layer.marker.remove()
  })
  segmentLayers.length = 0

  destinationMarkers.forEach(m => m.remove())
  destinationMarkers.length = 0
}

// Render the baseline grey route (only called once or when data changes)
function renderBaselineRoute() {
  if (!map) return

  // Clear existing baseline
  if (baselinePolyline) {
    baselinePolyline.remove()
    baselinePolyline = null
  }

  allRouteCoords = []

  // Collect all route coordinates from all segments
  store.segments.forEach(segment => {
    if (segment.timelinePath && segment.timelinePath.length > 0) {
      segment.timelinePath.forEach(p => {
        const coord = parseCoord(p.point)
        allRouteCoords.push(coord)
      })
    }
  })

  if (allRouteCoords.length > 0) {
    // Draw the complete grey baseline route
    baselinePolyline = L.polyline(allRouteCoords, {
      color: '#D1D5DB',
      weight: 4,
      opacity: 0.5,
      smoothFactor: 2,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map!)

    // Fit map to show all coordinates on first render
    map!.fitBounds(allRouteCoords, { padding: [50, 50] })
  }
}

// Create all segment layers once (polylines and markers)
function createAllSegmentLayers() {
  if (!map) return

  // Clear existing layers
  segmentLayers.forEach(layer => {
    if (layer.polyline) layer.polyline.remove()
    if (layer.marker) layer.marker.remove()
  })
  segmentLayers.length = 0

  // Create layers for all segments
  store.segments.forEach((segment) => {
    const layer: SegmentLayer = {
      segment,
      polyline: null,
      marker: null
    }

    const startTime = segment.startTime
    const color = getColorByDate(startTime)

    // Create polyline for route segments
    if (segment.timelinePath && segment.timelinePath.length > 0) {
      const pathCoords = segment.timelinePath.map(p => parseCoord(p.point))

      const polyline = L.polyline(pathCoords, {
        color: color,
        weight: 5,
        opacity: 0, // Start hidden
        smoothFactor: 2,
        className: 'route-segment',
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map!)

      polyline.on('click', () => {
        const segmentIndex = store.segments.indexOf(segment)
        store.selectSegment(segmentIndex)
      })

      polyline.bindPopup(`
        <div class="p-2">
          <strong class="text-primary-600">Route Segment</strong><br>
          <span class="text-sm">${new Date(segment.startTime).toLocaleString()}</span><br>
          <span class="text-xs text-gray-500">to</span><br>
          <span class="text-sm">${new Date(segment.endTime).toLocaleString()}</span>
          <br><br>
          <button class="text-xs text-primary-600 font-medium">Click for details →</button>
        </div>
      `)

      layer.polyline = polyline
    }

    // Create marker for visits
    if (segment.visit) {
      const visit = segment.visit
      if (visit.topCandidate && visit.topCandidate.placeLocation) {
        const coord = parseCoord(visit.topCandidate.placeLocation.latLng)

        const marker = L.circleMarker(coord, {
          radius: 7,
          fillColor: '#2E86AB',
          color: '#fff',
          weight: 2,
          opacity: 0, // Start hidden
          fillOpacity: 0,
          className: 'visit-marker'
        }).addTo(map!)

        marker.on('click', () => {
          const segmentIndex = store.segments.indexOf(segment)
          store.selectSegment(segmentIndex)
        })

        const duration = (new Date(segment.endTime).getTime() - new Date(segment.startTime).getTime()) / (1000 * 60)
        marker.bindPopup(`
          <div class="p-2">
            <strong class="text-blue-600">Stop/Visit</strong><br>
            <span class="text-sm font-medium">${visit.topCandidate.semanticType || 'Unknown'}</span><br>
            <span class="text-xs text-gray-600">Arrived: ${new Date(segment.startTime).toLocaleString()}</span><br>
            <span class="text-xs text-gray-600">Duration: ${Math.round(duration)} minutes</span><br>
            <span class="text-xs text-gray-500">Confidence: ${(visit.probability * 100).toFixed(0)}%</span>
            <br><br>
            <button class="text-xs text-primary-600 font-medium">Click for details →</button>
          </div>
        `)

        layer.marker = marker
      }
    }

    segmentLayers.push(layer)
  })

  // Initial visibility update
  updateSegmentVisibility()
}

// Update visibility of segments based on timeline position (fast!)
function updateSegmentVisibility() {
  if (!map) return

  const currentTimestamp = store.timelineTimestamp
  const isTimelineActive = store.isTimelineModeActive

  segmentLayers.forEach((layer) => {
    const segmentStart = new Date(layer.segment.startTime).getTime()

    // Determine if this segment should be visible
    const shouldBeVisible = !isTimelineActive ||
                           currentTimestamp === null ||
                           segmentStart <= currentTimestamp

    // Update polyline visibility
    if (layer.polyline) {
      layer.polyline.setStyle({
        opacity: shouldBeVisible ? 0.9 : 0
      })
    }

    // Update marker visibility
    if (layer.marker) {
      layer.marker.setStyle({
        opacity: shouldBeVisible ? 1 : 0,
        fillOpacity: shouldBeVisible ? 0.9 : 0
      })
    }
  })
}

// Update visibility immediately (no throttling needed - just changing opacity is very fast)
function scheduleVisibilityUpdate() {
  updateSegmentVisibility()
  renderDestinations()
}

function renderDestinations() {
  if (!map) return

  // Clear existing destination markers
  destinationMarkers.forEach(m => m.remove())
  destinationMarkers.length = 0

  // Get reached destinations from store
  const reachedDests = store.reachedDestinations

  reachedDests.forEach(dest => {
    const isReached = dest.reached

    // Create custom icon based on reached status
    const iconHtml = `
      <div style="
        font-size: 24px;
        text-align: center;
        filter: ${isReached ? 'brightness(1) saturate(1.2)' : 'grayscale(1) brightness(0.6)'};
        transition: all 0.3s ease;
        ${isReached ? 'animation: pulse-destination 2s infinite;' : ''}
      ">
        ${dest.icon}
      </div>
    `

    const icon = L.divIcon({
      html: iconHtml,
      className: 'destination-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    })

    const marker = L.marker([dest.location.lat, dest.location.lng], {
      icon: icon,
      opacity: isReached ? 1 : 0.5
    }).addTo(map!)

    marker.bindPopup(`
      <div class="p-3">
        <div class="text-2xl mb-2">${dest.icon}</div>
        <strong class="${isReached ? 'text-sunset-600' : 'text-gray-500'}">${dest.name}</strong><br>
        <span class="text-xs ${isReached ? 'text-sunset-500' : 'text-gray-400'} uppercase font-medium">
          ${dest.type.replace('-', ' ')}
        </span><br>
        <div class="mt-2 px-2 py-1 rounded ${isReached ? 'bg-sunset-100 text-sunset-700' : 'bg-gray-100 text-gray-500'} text-xs font-medium">
          ${isReached ? '✓ Reached' : 'Not yet visited'}
        </div>
      </div>
    `)

    destinationMarkers.push(marker)
  })
}

onMounted(async () => {
  if (!mapContainer.value) return

  // Initialize map
  map = L.map(mapContainer.value).setView([40, -100], 4)

  // Add tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map)

  // Load data
  await store.loadData()

  // Render baseline grey route once
  renderBaselineRoute()
  // Create all colored segment layers once (hidden initially)
  createAllSegmentLayers()
  // Render destination markers
  renderDestinations()
})

// Watch for timeline updates - only update visibility (super fast!)
watch(() => [store.timelineTimestamp, store.isTimelineModeActive], () => {
  scheduleVisibilityUpdate()
}, { deep: true })

// Watch for data changes - recreate everything
watch(() => [store.segments], () => {
  renderBaselineRoute()
  createAllSegmentLayers()
  renderDestinations()
}, { deep: true })

onUnmounted(() => {
  if (map) {
    map.remove()
  }
})
</script>

<template>
  <div class="relative w-full h-full">
    <!-- Loading Overlay -->
    <div
      v-if="store.loading"
      class="absolute inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm"
    >
      <div class="text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4"></div>
        <p class="text-lg font-medium text-gray-900">Loading road trip data...</p>
        <p class="text-sm text-gray-500 mt-1">Plotting your journey across America</p>
      </div>
    </div>

    <!-- Map Container -->
    <div ref="mapContainer" class="w-full h-full"></div>

    <!-- Legend -->
    <div class="absolute bottom-48 right-6 z-10 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 border border-gray-200">
      <strong class="text-sm text-gray-900 block mb-3">Route Colors</strong>
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <span class="w-6 h-1 bg-[#FF6B6B] rounded"></span>
          <span class="text-xs text-gray-600">August</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-6 h-1 bg-[#4ECDC4] rounded"></span>
          <span class="text-xs text-gray-600">September</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-6 h-1 bg-[#FF8C42] rounded"></span>
          <span class="text-xs text-gray-600">October</span>
        </div>
        <div class="flex items-center gap-2 pt-2 border-t border-gray-200">
          <span class="w-3 h-3 bg-[#2E86AB] border-2 border-white rounded-full"></span>
          <span class="text-xs text-gray-600">Stops/Visits</span>
        </div>
      </div>
    </div>

    <!-- Selected Location Badge -->
    <div
      v-if="store.selectedSegmentIndex !== null"
      class="absolute top-6 left-6 z-10 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3 border border-primary-200 animate-fade-in"
    >
      <p class="text-xs text-gray-500">Selected Location</p>
      <p class="text-sm font-semibold text-gray-900">
        {{ store.selectedSegment?.visit?.topCandidate.semanticType || 'Route Segment' }}
      </p>
      <button
        @click="store.selectSegment(null)"
        class="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium"
      >
        Clear selection
      </button>
    </div>
  </div>
</template>

<style>
/* Make route segments clickable with smooth transitions */
.route-segment {
  cursor: pointer;
  transition: opacity 0.15s ease-out, filter 0.3s ease, stroke-width 0.3s ease;
}

.route-segment:hover {
  filter: brightness(1.2) drop-shadow(0 0 8px currentColor);
  stroke-width: 7 !important;
}

.visit-marker {
  cursor: pointer;
  transition: opacity 0.15s ease-out, fill-opacity 0.15s ease-out, transform 0.3s ease;
}

.visit-marker:hover {
  transform: scale(1.3);
  filter: drop-shadow(0 0 6px currentColor);
}

.leaflet-popup-content {
  margin: 0;
}

.leaflet-popup-content-wrapper {
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.leaflet-popup-tip {
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
}

/* Destination markers */
.destination-marker {
  cursor: pointer;
  transition: all 0.3s ease;
}

.destination-marker:hover {
  transform: scale(1.2);
  filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.6));
}

@keyframes pulse-destination {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}
</style>
