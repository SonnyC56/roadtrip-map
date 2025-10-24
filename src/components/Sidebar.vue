<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { format } from 'date-fns'
import { useRoadTripStore } from '../stores/roadtrip'
import {
  ArrowPathIcon,
  BackwardIcon,
  ForwardIcon,
  PauseIcon,
  PlayIcon
} from '@heroicons/vue/24/outline'
const store = useRoadTripStore()

const isParksExpanded = ref(false)
const isPlaying = ref(false)
const sliderValue = ref(0)
const playbackSpeed = ref(1)
let animationFrame: number | null = null

const currentDate = computed(() => {
  const offset = (sliderValue.value / 100) * store.tripDurationMs
  return new Date(store.tripStartDate.getTime() + offset)
})

const formattedCurrentDate = computed(() => format(currentDate.value, 'EEEE, MMM dd, yyyy'))
const currentDay = computed(() => {
  const dayIndex = Math.floor((sliderValue.value / 100) * store.tripTotalDays) + 1
  return Math.min(Math.max(dayIndex, 1), store.tripTotalDays)
})
const progressPercent = computed(() => Math.round(sliderValue.value))
const playbackStatus = computed(() => (isPlaying.value ? 'Playing' : 'Paused'))
const startLabel = computed(() => format(store.tripStartDate, 'MMM dd, yyyy'))
const endLabel = computed(() => format(store.tripEndDate, 'MMM dd, yyyy'))

function formatNumber(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0'
  return value.toLocaleString()
}

const milesDisplay = computed(() => {
  if (store.viewMode === 'day-by-day') {
    return formatNumber(store.selectedDayDistanceMiles)
  }
  return formatNumber(store.currentDistanceMiles)
})

const kmDisplay = computed(() => {
  if (store.viewMode === 'day-by-day') {
    return formatNumber(Math.round(store.selectedDayDistance / 1000))
  }
  return formatNumber(store.currentDistanceKm)
})

const destinationsVisited = computed(() => store.reachedDestinations.filter(dest => dest.reached).length)

// Day-by-day view computeds
const selectedDayDate = computed(() => {
  const dayOffset = (store.selectedDay - 1) * 24 * 60 * 60 * 1000
  return new Date(store.tripStartDate.getTime() + dayOffset)
})

const formattedSelectedDayDate = computed(() => format(selectedDayDate.value, 'EEEE, MMM dd, yyyy'))

// Get list of reached national parks
const reachedNationalParks = computed(() => {
  return store.reachedDestinations
    .filter(dest => dest.type === 'national-park' && dest.reached)
    .map(dest => dest.name.replace(' NP', '').replace(', WY', '').replace(', WA', '').replace(', CA', '').replace(', OR', '').replace(', UT', '').replace(', MT', '').replace(', AB', '').replace(', WV', ''))
})

const totalNationalParks = computed(() => {
  return store.destinations.filter(dest => dest.type === 'national-park').length
})

function toggleParksExpanded() {
  isParksExpanded.value = !isParksExpanded.value
}

// Get color based on current date
const currentColor = computed(() => {
  return store.getColorForDate(currentDate.value)
})

// Build gradient that shows colors for completed months
const progressGradient = computed(() => {
  const current = sliderValue.value
  const boundaries = store.monthBoundaries

  if (boundaries.length === 0) {
    return currentColor.value
  }

  const firstBoundary = boundaries[0]
  if (!firstBoundary) {
    return currentColor.value
  }

  // If we're still in the first month
  if (current <= firstBoundary.percent) {
    return firstBoundary.color
  }

  // Build gradient stops
  const gradientStops: string[] = []
  let prevPercent = 0

  boundaries.forEach((boundary, index) => {
    if (boundary.percent <= current) {
      // This month is complete
      const percentInGradient = (boundary.percent / current) * 100
      gradientStops.push(`${boundary.color} ${prevPercent}%`)
      gradientStops.push(`${boundary.color} ${percentInGradient}%`)
      prevPercent = percentInGradient
    } else {
      const prevBoundary = boundaries[index - 1]
      if (index === 0 || (prevBoundary && prevBoundary.percent < current)) {
        // We're currently in this month
        const percentInGradient = 100
        gradientStops.push(`${boundary.color} ${prevPercent}%`)
        gradientStops.push(`${boundary.color} ${percentInGradient}%`)
      }
    }
  })

  if (gradientStops.length === 0) {
    return currentColor.value
  }

  return `linear-gradient(90deg, ${gradientStops.join(', ')})`
})

watch(
  () => store.timelineTimestamp,
  timestamp => {
    if (!timestamp) {
      sliderValue.value = 0
      return
    }

    const clamped = Math.min(store.tripEndDate.getTime(), Math.max(store.tripStartDate.getTime(), timestamp))
    const percent = ((clamped - store.tripStartDate.getTime()) / store.tripDurationMs) * 100
    sliderValue.value = Math.max(0, Math.min(100, Number(percent.toFixed(3))))
  },
  { immediate: true }
)

onMounted(() => {
  store.activateTimelineMode()
})

onUnmounted(() => {
  pause()
})

// Use RAF for buttery smooth slider updates
let rafId: number | null = null
let pendingSliderUpdate = false

function handleSliderInput(event: Event) {
  const target = event.target as HTMLInputElement
  const value = Number(target.value)
  sliderValue.value = value

  // Schedule update with requestAnimationFrame for smooth 60fps
  if (!pendingSliderUpdate) {
    pendingSliderUpdate = true

    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }

    rafId = requestAnimationFrame(() => {
      store.setTimelineTimestamp(currentDate.value.getTime())
      pendingSliderUpdate = false
      rafId = null
    })
  }
}

function play() {
  if (sliderValue.value >= 100) {
    sliderValue.value = 0
    store.setTimelineTimestamp(store.tripStartDate.getTime())
  }

  if (isPlaying.value) return

  isPlaying.value = true
  animate()
}

function pause() {
  if (!isPlaying.value) return

  isPlaying.value = false
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }
}

function animate() {
  if (!isPlaying.value) return

  const increment = (playbackSpeed.value * 100) / (30 * 60)
  sliderValue.value = Math.min(100, sliderValue.value + increment)
  store.setTimelineTimestamp(currentDate.value.getTime())

  if (sliderValue.value >= 100) {
    pause()
    return
  }

  animationFrame = requestAnimationFrame(animate)
}

function reset() {
  pause()
  sliderValue.value = 0
  store.setTimelineTimestamp(store.tripStartDate.getTime())
}

function skipForward() {
  sliderValue.value = Math.min(100, sliderValue.value + 5)
  store.setTimelineTimestamp(currentDate.value.getTime())
}

function skipBackward() {
  sliderValue.value = Math.max(0, sliderValue.value - 5)
  store.setTimelineTimestamp(currentDate.value.getTime())
}

function cycleSpeed() {
  const speeds = [1, 2, 4, 8]
  const currentIndex = speeds.indexOf(playbackSpeed.value)
  playbackSpeed.value = speeds[(currentIndex + 1) % speeds.length] || 1
}

// Day-by-day view functions
function toggleViewMode() {
  if (store.viewMode === 'timeline') {
    store.setViewMode('day-by-day')
    pause() // Pause playback when switching to day view
  } else {
    store.setViewMode('timeline')
  }
}

function nextDay() {
  store.nextDay()
}

function previousDay() {
  store.previousDay()
}
</script>

<template>
  <div>
    <div class="toolbar-shell">
      <div class="toolbar-container">
        <div class="glass-panel toolbar-panel">
          <div class="panel-content">
            <div class="panel-top-row">
              <!-- Timeline Mode Summary -->
              <div v-if="store.viewMode === 'timeline'" class="summary-block">
                <p class="summary-label">Timeline</p>
                <div class="summary-day">
                  <span class="day-number">Day {{ currentDay }}</span>
                  <span class="day-total">of {{ store.tripTotalDays }}</span>
                </div>
                <p class="summary-date">{{ formattedCurrentDate }}</p>
                <p class="summary-progress">{{ progressPercent }}% of journey</p>
              </div>

              <!-- Day-by-Day Mode Summary -->
              <div v-else class="summary-block">
                <p class="summary-label">Day by Day</p>
                <div class="summary-day">
                  <span class="day-number">Day {{ store.selectedDay }}</span>
                  <span class="day-total">of {{ store.tripTotalDays }}</span>
                </div>
                <p class="summary-date">{{ formattedSelectedDayDate }}</p>
                <p class="summary-progress">{{ store.selectedDayVisits }} stops this day</p>
              </div>

              <!-- Timeline Slider (only in timeline mode) -->
              <div v-if="store.viewMode === 'timeline'" class="timeline-block">
                <div class="timeline-slider-container">
                  <div class="timeline-track"></div>
                  <div
                    class="timeline-progress"
                    :style="{
                      width: `${sliderValue}%`,
                      background: progressGradient
                    }"
                  ></div>
                  <input
                    v-model.number="sliderValue"
                    @input="handleSliderInput"
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    class="timeline-input"
                    aria-label="Timeline position"
                    :style="{ '--thumb-color': currentColor }"
                  />
                </div>
                <div class="timeline-labels">
                  <span>{{ startLabel }}</span>
                  <span>{{ endLabel }}</span>
                </div>

                <!-- Color Legend -->
                <div class="color-legend">
                  <div
                    v-for="boundary in store.monthBoundaries"
                    :key="boundary.monthKey"
                    class="legend-item"
                  >
                    <span class="legend-color" :style="{ background: boundary.color }"></span>
                    <span class="legend-label">{{ boundary.name }}</span>
                  </div>
                </div>
              </div>

              <div class="distance-block">
                <p class="summary-label">{{ store.viewMode === 'timeline' ? 'Distance covered' : 'Day distance' }}</p>
                <p class="distance-miles">
                  {{ milesDisplay }}
                  <span>mi</span>
                </p>
                <p class="distance-km">{{ kmDisplay }} km</p>
              </div>
            </div>

            <div class="panel-bottom-row">
              <!-- Timeline Mode Controls -->
              <div v-if="store.viewMode === 'timeline'" class="controls-group">
                <button
                  @click="reset"
                  class="control-button"
                  title="Reset to start"
                >
                  <ArrowPathIcon class="icon-regular" />
                </button>
                <button
                  @click="skipBackward"
                  class="control-button"
                  title="Step back"
                >
                  <BackwardIcon class="icon-regular" />
                </button>
                <button
                  @click="isPlaying ? pause() : play()"
                  class="control-button-play"
                  :aria-label="isPlaying ? 'Pause playback' : 'Start playback'"
                >
                  <PlayIcon v-if="!isPlaying" class="icon-large text-white" />
                  <PauseIcon v-else class="icon-large text-white" />
                </button>
                <button
                  @click="skipForward"
                  class="control-button"
                  title="Step forward"
                >
                  <ForwardIcon class="icon-regular" />
                </button>
                <button
                  @click="cycleSpeed"
                  class="speed-button"
                  title="Change speed"
                >
                  {{ playbackSpeed }}x
                </button>
              </div>

              <!-- Day-by-Day Mode Controls -->
              <div v-else class="controls-group">
                <button
                  @click="previousDay"
                  class="control-button"
                  title="Previous day"
                  :disabled="store.selectedDay === 1"
                >
                  <BackwardIcon class="icon-regular" />
                </button>
                <button
                  @click="nextDay"
                  class="control-button"
                  title="Next day"
                  :disabled="store.selectedDay === store.tripTotalDays"
                >
                  <ForwardIcon class="icon-regular" />
                </button>
              </div>

              <div class="meta-group">
                <!-- Mode Toggle Button -->
                <button
                  @click="toggleViewMode"
                  class="mode-toggle-button"
                  :title="store.viewMode === 'timeline' ? 'Switch to Day-by-Day' : 'Switch to Timeline'"
                >
                  <span class="mode-icon">{{ store.viewMode === 'timeline' ? '📅' : '▶️' }}</span>
                  <span class="mode-label">{{ store.viewMode === 'timeline' ? 'Day View' : 'Timeline' }}</span>
                </button>

                <!-- Status Pill (only in timeline mode) -->
                <span
                  v-if="store.viewMode === 'timeline'"
                  class="status-pill"
                  :class="isPlaying ? 'status-live' : ''"
                >
                  <span class="status-dot"></span>
                  {{ playbackStatus }}
                </span>

                <!-- National Parks Badge (only for default data) -->
                <button
                  v-if="store.dataSource === 'default'"
                  @click="toggleParksExpanded"
                  class="parks-badge"
                >
                  <span class="parks-count">
                    {{ reachedNationalParks.length }} / {{ totalNationalParks }}
                  </span>
                  <span class="parks-label-text">National Parks</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- National Parks Modal -->
  <Transition name="modal-fade">
    <div v-if="isParksExpanded" class="modal-overlay" @click="toggleParksExpanded">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">National Parks Visited</h3>
          <button @click="toggleParksExpanded" class="modal-close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="parks-count-display">
            {{ reachedNationalParks.length }} of {{ totalNationalParks }} Visited
          </div>
          <div class="parks-modal-grid">
            <div
              v-for="(park, index) in reachedNationalParks"
              :key="index"
              class="park-modal-item"
            >
              {{ park }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.toolbar-shell {
  position: fixed;
  inset: auto 0 0 0;
  padding: 0 1.75rem 1.75rem;
  z-index: 1500;
  pointer-events: none;
}

.toolbar-container {
  max-width: 1100px;
  margin: 0 auto;
  pointer-events: auto;
}

.toolbar-panel {
  display: block;
  color: #0f172a;
}

.glass-panel {
  width: 100%;
  border-radius: 24px;
  background: rgba(248, 250, 252, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(36px);
  padding: 22px 26px;
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.panel-top-row {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: flex-start;
}

.summary-block {
  flex: 1 1 200px;
  min-width: 200px;
}

.summary-label {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(15, 23, 42, 0.55);
  margin: 0 0 6px;
}

.summary-day {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 3px;
}

.day-number {
  font-size: 2rem;
  font-weight: 700;
  color: #111827;
}

.day-total {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.45);
}

.summary-date {
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(15, 23, 42, 0.7);
  margin: 0;
}

.summary-progress {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(59, 130, 246, 0.85);
  margin: 6px 0 0;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.timeline-block {
  flex: 2 1 320px;
  min-width: 260px;
}

.timeline-slider-container {
  position: relative;
  height: 16px;
  border-radius: 9999px;
}

.timeline-track {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 9999px;
  box-shadow: inset 0 1px 4px rgba(15, 23, 42, 0.12);
}

.timeline-progress {
  position: absolute;
  inset: 0;
  width: 0;
  border-radius: 9999px;
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.25);
}

.timeline-input {
  position: absolute;
  inset: -8px 0 -8px 0;
  width: 100%;
  background: transparent;
  appearance: none;
  cursor: pointer;
  z-index: 2;
}

.timeline-input::-webkit-slider-thumb {
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 4px solid #ffffff;
  background: var(--thumb-color, #2563eb);
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.45);
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.15s ease;
}

.timeline-input::-webkit-slider-thumb:hover {
  transform: scale(1.08);
  box-shadow: 0 12px 30px rgba(37, 99, 235, 0.5);
}

.timeline-input::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border: 4px solid #ffffff;
  border-radius: 50%;
  background: var(--thumb-color, #2563eb);
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.45);
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.15s ease;
}

.timeline-input::-moz-range-thumb:hover {
  transform: scale(1.08);
  box-shadow: 0 12px 30px rgba(37, 99, 235, 0.5);
}

.timeline-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.45);
  margin-top: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.color-legend {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-color {
  width: 20px;
  height: 4px;
  border-radius: 2px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.legend-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.6);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.distance-block {
  min-width: 180px;
  text-align: right;
}

.distance-miles {
  font-size: 2rem;
  font-weight: 700;
  color: #1e293b;
  margin: 3px 0 0;
  line-height: 1;
}

.distance-miles span {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.55);
  margin-left: 5px;
}

.distance-km {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.45);
  margin: 3px 0 0;
}

.panel-bottom-row {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  align-items: center;
  justify-content: space-between;
}

.controls-group {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.control-button {
  height: 44px;
  width: 44px;
  border-radius: 14px;
  border: none;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1f2937;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
}

.control-button:hover {
  background: rgba(255, 255, 255, 0.95);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.16);
}

.control-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.control-button:disabled:hover {
  background: rgba(255, 255, 255, 0.8);
  transform: none;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
}

.control-button-play {
  height: 56px;
  width: 56px;
  border-radius: 9999px;
  border: none;
  background: linear-gradient(135deg, #2563eb 0%, #ec4899 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  box-shadow: 0 14px 30px rgba(99, 102, 241, 0.35);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.control-button-play:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 34px rgba(99, 102, 241, 0.4);
}

.speed-button {
  padding: 0 20px;
  height: 44px;
  border-radius: 14px;
  border: none;
  font-size: 1rem;
  font-weight: 600;
  background: rgba(15, 23, 42, 0.08);
  color: #1f2937;
  transition: all 0.2s ease;
}

.speed-button:hover {
  background: rgba(15, 23, 42, 0.16);
}

.mode-toggle-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  height: 44px;
  border-radius: 14px;
  border: none;
  font-size: 0.9rem;
  font-weight: 600;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  cursor: pointer;
}

.mode-toggle-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

.mode-icon {
  font-size: 1.1rem;
  line-height: 1;
}

.mode-label {
  font-size: 0.85rem;
  letter-spacing: 0.02em;
}

.meta-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 18px;
  height: 36px;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.7);
  background: rgba(148, 163, 184, 0.2);
  transition: all 0.2s ease;
}

.status-pill.status-live {
  background: rgba(37, 99, 235, 0.18);
  color: #1d4ed8;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 4px currentColor;
  opacity: 0.4;
}

.status-pill.status-live .status-dot {
  opacity: 0.85;
  animation: pulse-dot 1.8s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%,
  100% {
    transform: scale(0.95);
    opacity: 0.65;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  padding: 0 16px;
  height: 36px;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.65);
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
}

.parks-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  max-width: 600px;
  flex: 1;
}

.parks-badge:hover {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.12);
  transform: translateY(-1px);
}

.parks-count {
  font-size: 0.95rem;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.85);
}

.parks-label-text {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 100%;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.1);
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(15, 23, 42, 0.5);
  padding: 4px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: rgba(15, 23, 42, 0.05);
  color: rgba(15, 23, 42, 0.8);
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
}

.parks-count-display {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.6);
  margin-bottom: 16px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.parks-modal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.park-modal-item {
  padding: 12px 16px;
  background: rgba(248, 250, 252, 0.8);
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  color: rgba(15, 23, 42, 0.8);
  transition: all 0.2s ease;
}

.park-modal-item:hover {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
}

/* Modal Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-active .modal-content,
.modal-fade-leave-active .modal-content {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .modal-content,
.modal-fade-leave-to .modal-content {
  transform: scale(0.95);
  opacity: 0;
}

.icon-regular {
  width: 24px;
  height: 24px;
}

.icon-medium {
  width: 22px;
  height: 22px;
  transition: transform 0.24s ease;
}

.icon-large {
  width: 28px;
  height: 28px;
}

@media (max-width: 1024px) {
  .toolbar-shell {
    padding: 0 0.75rem 0.875rem;
  }

  .glass-panel {
    padding: 14px 18px;
    border-radius: 20px;
  }

  .panel-content {
    gap: 14px;
  }

  .panel-top-row {
    flex-wrap: nowrap;
    gap: 10px;
  }

  .summary-block {
    flex: 0 0 auto;
  }

  .summary-label,
  .distance-label {
    font-size: 0.68rem;
    margin-bottom: 4px;
  }

  .day-number {
    font-size: 1.5rem;
  }

  .day-total {
    font-size: 0.75rem;
  }

  .summary-date {
    font-size: 0.8rem;
  }

  .summary-progress {
    font-size: 0.7rem;
  }

  .distance-miles {
    font-size: 1.5rem;
  }

  .distance-km {
    font-size: 0.75rem;
  }

  .timeline-block {
    flex: 1 1 0;
    min-width: 140px;
  }

  .distance-block {
    flex: 0 0 auto;
    text-align: right;
  }
}

@media (max-width: 768px) {
  .toolbar-shell {
    padding: 0 0.625rem 0.75rem;
  }

  .glass-panel {
    padding: 13px 16px;
    border-radius: 18px;
  }

  .panel-content {
    gap: 13px;
  }

  .panel-top-row {
    flex-wrap: nowrap;
    gap: 9px;
  }

  .summary-block {
    flex: 0 0 auto;
  }

  .summary-label,
  .distance-label {
    font-size: 0.66rem;
    margin-bottom: 3px;
  }

  .day-number {
    font-size: 1.4rem;
  }

  .day-total {
    font-size: 0.72rem;
  }

  .summary-date {
    font-size: 0.78rem;
  }

  .summary-progress {
    font-size: 0.68rem;
  }

  .distance-miles {
    font-size: 1.4rem;
  }

  .distance-km {
    font-size: 0.72rem;
  }

  .timeline-block {
    flex: 1 1 0;
    min-width: 110px;
  }

  .distance-block {
    flex: 0 0 auto;
    text-align: right;
  }

  .panel-bottom-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 11px;
  }

  .controls-group {
    width: 100%;
    justify-content: flex-start;
    gap: 7px;
  }

  .meta-group {
    width: 100%;
    justify-content: flex-start;
    gap: 7px;
  }

  .control-button,
  .control-button-play,
  .speed-button {
    height: 42px;
  }

  .meta-pill,
  .status-pill {
    font-size: 0.73rem;
    padding: 7px 11px;
  }
}

@media (max-width: 640px) {
  .glass-panel {
    padding: 14px 14px;
    border-radius: 18px;
  }

  .panel-content {
    gap: 14px;
  }

  .panel-top-row {
    flex-direction: row;
    flex-wrap: nowrap; /* Keep on same line */
    gap: 8px;
    align-items: flex-start;
  }

  .summary-block {
    flex: 0 0 auto;
    min-width: auto;
  }

  .summary-label {
    font-size: 0.65rem;
    margin-bottom: 4px;
  }

  .day-number {
    font-size: 1.4rem;
  }

  .day-total {
    font-size: 0.7rem;
  }

  .summary-date {
    font-size: 0.75rem;
  }

  .summary-progress {
    font-size: 0.7rem;
  }

  .timeline-block {
    flex: 1 1 0; /* Take available space */
    min-width: 100px;
  }

  .distance-block {
    flex: 0 0 auto;
    min-width: auto;
    text-align: right;
  }

  .distance-label {
    font-size: 0.65rem;
    margin-bottom: 4px;
  }

  .distance-miles {
    font-size: 1.4rem;
  }

  .distance-km {
    font-size: 0.7rem;
  }

  .panel-bottom-row {
    align-items: flex-start;
    gap: 12px;
  }

  .controls-group {
    width: 100%;
    justify-content: space-between;
  }

  .control-button,
  .control-button-play {
    flex: 1 1 0;
    max-width: 44px;
    height: 44px;
  }

  .control-button-play {
    max-width: 56px;
  }

  .speed-button {
    flex: 1 1 auto;
    height: 44px;
  }

  .meta-group {
    width: 100%;
    gap: 8px;
  }

  .meta-pill,
  .status-pill {
    flex: 1 1 calc(50% - 6px);
    justify-content: center;
    font-size: 0.75rem;
    padding: 8px 12px;
  }

  .parks-details {
    max-height: 150px;
  }
}

@media (max-width: 480px) {
  .toolbar-shell {
    padding: 0 0.5rem 0.75rem;
  }

  .glass-panel {
    padding: 12px 12px;
    border-radius: 16px;
  }

  .panel-content {
    gap: 12px;
  }

  .panel-top-row {
    flex-wrap: nowrap; /* Force single line */
    gap: 6px;
  }

  .summary-block {
    min-width: auto;
    flex: 0 0 auto;
  }

  .summary-label {
    display: none; /* Hide "TIMELINE" label on mobile */
  }

  .summary-day {
    gap: 4px;
    margin-bottom: 2px;
  }

  .day-number {
    font-size: 1.25rem;
    line-height: 1.2;
  }

  .day-total {
    font-size: 0.65rem;
  }

  .summary-date {
    font-size: 0.7rem;
    margin-bottom: 1px;
  }

  .summary-progress {
    font-size: 0.65rem;
  }

  .timeline-block {
    min-width: 80px;
    flex: 1 1 0;
  }

  .distance-block {
    min-width: auto;
    flex: 0 0 auto;
    text-align: right;
  }

  .distance-label {
    display: none; /* Hide "DISTANCE COVERED" label on mobile */
  }

  .distance-miles {
    font-size: 1.25rem;
    line-height: 1.2;
  }

  .distance-km {
    font-size: 0.65rem;
  }

  .panel-bottom-row {
    gap: 10px;
  }

  .controls-group {
    gap: 6px;
  }

  .control-button,
  .control-button-play,
  .speed-button {
    height: 36px;
    min-width: 36px;
  }

  .control-button-play {
    max-width: 50px;
  }

  .icon-medium {
    width: 16px;
    height: 16px;
  }

  .icon-large {
    width: 20px;
    height: 20px;
  }

  .meta-pill,
  .status-pill {
    flex: 1 1 100%;
    padding: 6px 10px;
    font-size: 0.7rem;
  }

  .parks-badge {
    padding: 6px 10px;
    font-size: 0.7rem;
  }

  .parks-grid {
    gap: 6px;
  }

  .park-chip {
    padding: 4px 8px;
    font-size: 0.65rem;
  }

  .parks-details {
    max-height: 120px;
  }
}
</style>
