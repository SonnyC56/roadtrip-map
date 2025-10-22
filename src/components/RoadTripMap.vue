<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoadTripStore } from '../stores/roadtrip'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const store = useRoadTripStore()
const mapContainer = ref<HTMLElement | null>(null)
let map: L.Map | null = null
const polylines: L.Polyline[] = []
const markers: L.CircleMarker[] = []

function parseCoord(coordStr: string): [number, number] {
  const parts = coordStr.replace(/°/g, '').split(', ')
  return [parseFloat(parts[0]), parseFloat(parts[1])]
}

function getColorByDate(dateStr: string): string {
  const date = new Date(dateStr)
  const month = date.getMonth()
  if (month === 7) return '#FF6B6B'  // August - red
  if (month === 8) return '#4ECDC4'  // September - teal
  if (month === 9) return '#95E1D3'  // October - light green
  return '#666'
}

function clearMapLayers() {
  polylines.forEach(p => p.remove())
  markers.forEach(m => m.remove())
  polylines.length = 0
  markers.length = 0
}

function renderSegments() {
  if (!map) return

  clearMapLayers()

  const allCoords: [number, number][] = []
  // Use timeline segments if timeline mode is active, otherwise use filtered segments
  const segments = store.isTimelineModeActive ? store.timelineSegments : store.filteredSegments

  segments.forEach((segment, index) => {
    const startTime = segment.startTime
    const color = getColorByDate(startTime)

    // Process timeline path (the actual route)
    if (segment.timelinePath && segment.timelinePath.length > 0) {
      const pathCoords = segment.timelinePath.map(p => {
        const coord = parseCoord(p.point)
        allCoords.push(coord)
        return coord
      })

      // Draw shadow/outline first for depth effect
      const shadow = L.polyline(pathCoords, {
        color: '#000000',
        weight: 8,
        opacity: 0.15,
        className: 'route-shadow'
      }).addTo(map!)
      polylines.push(shadow)

      // Draw the main path with thicker, styled line
      const polyline = L.polyline(pathCoords, {
        color: color,
        weight: 5,
        opacity: 0.9,
        className: 'route-segment',
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map!)

      // Make it clickable
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

      polylines.push(polyline)
    }

    // Process visits (places you stopped)
    if (segment.visit) {
      const visit = segment.visit
      if (visit.topCandidate && visit.topCandidate.placeLocation) {
        const coord = parseCoord(visit.topCandidate.placeLocation.latLng)
        allCoords.push(coord)

        const marker = L.circleMarker(coord, {
          radius: 7,
          fillColor: '#2E86AB',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
          className: 'visit-marker'
        }).addTo(map!)

        // Make it clickable
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

        markers.push(marker)
      }
    }
  })

  // Fit map to show all coordinates
  if (allCoords.length > 0 && map) {
    map.fitBounds(allCoords, { padding: [50, 50] })
  }
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
  renderSegments()
})

// Watch for filter changes and timeline updates
watch(() => [store.filteredSegments, store.searchQuery, store.dateRange, store.timelineTimestamp, store.isTimelineModeActive], () => {
  renderSegments()
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
    <div class="absolute bottom-6 right-6 z-10 bg-white rounded-lg shadow-lg p-4 border border-gray-200">
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
          <span class="w-6 h-1 bg-[#95E1D3] rounded"></span>
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
      class="absolute top-6 left-6 z-10 bg-white rounded-lg shadow-lg p-3 border border-primary-200 animate-fade-in"
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
/* Route shadow for depth */
.route-shadow {
  pointer-events: none;
}

/* Make route segments clickable and animated */
.route-segment {
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: drawRoute 0.5s ease-out;
}

.route-segment:hover {
  opacity: 1 !important;
  filter: brightness(1.2) drop-shadow(0 0 8px currentColor);
  stroke-width: 7 !important;
}

@keyframes drawRoute {
  from {
    stroke-dasharray: 1000;
    stroke-dashoffset: 1000;
  }
  to {
    stroke-dasharray: 1000;
    stroke-dashoffset: 0;
  }
}

.visit-marker {
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: markerPop 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.visit-marker:hover {
  transform: scale(1.3);
  filter: drop-shadow(0 0 6px currentColor);
}

@keyframes markerPop {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
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
</style>
