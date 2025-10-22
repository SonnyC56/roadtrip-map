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
import { TRIP_DURATION_MS, TRIP_END_DATE, TRIP_START_DATE, TRIP_TOTAL_DAYS } from '../constants/trip'

const store = useRoadTripStore()

const isParksExpanded = ref(false)
const isPlaying = ref(false)
const sliderValue = ref(0)
const playbackSpeed = ref(1)
let animationFrame: number | null = null

const currentDate = computed(() => {
  const offset = (sliderValue.value / 100) * TRIP_DURATION_MS
  return new Date(TRIP_START_DATE.getTime() + offset)
})

const formattedCurrentDate = computed(() => format(currentDate.value, 'EEEE, MMM dd'))
const currentDay = computed(() => {
  const dayIndex = Math.floor((sliderValue.value / 100) * TRIP_TOTAL_DAYS) + 1
  return Math.min(Math.max(dayIndex, 1), TRIP_TOTAL_DAYS)
})
const progressPercent = computed(() => Math.round(sliderValue.value))
const playbackStatus = computed(() => (isPlaying.value ? 'Playing' : 'Paused'))
const startLabel = computed(() => format(TRIP_START_DATE, 'MMM dd'))
const endLabel = computed(() => format(TRIP_END_DATE, 'MMM dd'))

function formatNumber(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0'
  return value.toLocaleString()
}

const milesDisplay = computed(() => formatNumber(store.currentDistanceMiles))
const kmDisplay = computed(() => formatNumber(store.currentDistanceKm))
const destinationsVisited = computed(() => store.reachedDestinations.filter(dest => dest.reached).length)

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
  const month = currentDate.value.getMonth()
  if (month === 7) return '#FF6B6B'  // August - red
  if (month === 8) return '#4ECDC4'  // September - teal
  if (month === 9) return '#FF8C42'  // October - orange
  return '#666'
})

// Calculate month boundaries as percentages
const augustEnd = computed(() => {
  const augustEndDate = new Date('2025-09-01T00:00:00Z')
  return ((augustEndDate.getTime() - TRIP_START_DATE.getTime()) / TRIP_DURATION_MS) * 100
})

const septemberEnd = computed(() => {
  const septemberEndDate = new Date('2025-10-01T00:00:00Z')
  return ((septemberEndDate.getTime() - TRIP_START_DATE.getTime()) / TRIP_DURATION_MS) * 100
})

// Build gradient that shows colors for completed months
const progressGradient = computed(() => {
  const current = sliderValue.value

  if (current <= augustEnd.value) {
    // Still in August, all red
    return '#FF6B6B'
  } else if (current <= septemberEnd.value) {
    // In September, show red for August portion, then teal up to current position
    const augustPercent = (augustEnd.value / current) * 100
    return `linear-gradient(90deg,
      #FF6B6B 0%,
      #FF6B6B ${augustPercent}%,
      #4ECDC4 ${augustPercent}%,
      #4ECDC4 100%)`
  } else {
    // In October, show red, teal, then orange
    const augustPercent = (augustEnd.value / current) * 100
    const septemberPercent = (septemberEnd.value / current) * 100
    return `linear-gradient(90deg,
      #FF6B6B 0%,
      #FF6B6B ${augustPercent}%,
      #4ECDC4 ${augustPercent}%,
      #4ECDC4 ${septemberPercent}%,
      #FF8C42 ${septemberPercent}%,
      #FF8C42 100%)`
  }
})

watch(
  () => store.timelineTimestamp,
  timestamp => {
    if (!timestamp) {
      sliderValue.value = 0
      return
    }

    const clamped = Math.min(TRIP_END_DATE.getTime(), Math.max(TRIP_START_DATE.getTime(), timestamp))
    const percent = ((clamped - TRIP_START_DATE.getTime()) / TRIP_DURATION_MS) * 100
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
    store.setTimelineTimestamp(TRIP_START_DATE.getTime())
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
  store.setTimelineTimestamp(TRIP_START_DATE.getTime())
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
</script>

<template>
  <div>
    <div class="toolbar-shell">
      <div class="toolbar-container">
        <div class="glass-panel toolbar-panel">
          <div class="panel-content">
            <div class="panel-top-row">
              <div class="summary-block">
                <p class="summary-label">Timeline</p>
                <div class="summary-day">
                  <span class="day-number">Day {{ currentDay }}</span>
                  <span class="day-total">of {{ TRIP_TOTAL_DAYS }}</span>
                </div>
                <p class="summary-date">{{ formattedCurrentDate }}</p>
                <p class="summary-progress">{{ progressPercent }}% of journey</p>
              </div>

              <div class="timeline-block">
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
                  <div class="legend-item">
                    <span class="legend-color" style="background: #FF6B6B;"></span>
                    <span class="legend-label">August</span>
                  </div>
                  <div class="legend-item">
                    <span class="legend-color" style="background: #4ECDC4;"></span>
                    <span class="legend-label">September</span>
                  </div>
                  <div class="legend-item">
                    <span class="legend-color" style="background: #FF8C42;"></span>
                    <span class="legend-label">October</span>
                  </div>
                </div>
              </div>

              <div class="distance-block">
                <p class="summary-label">Distance covered</p>
                <p class="distance-miles">
                  {{ milesDisplay }}
                  <span>mi</span>
                </p>
                <p class="distance-km">{{ kmDisplay }} km</p>
              </div>
            </div>

            <div class="panel-bottom-row">
              <div class="controls-group">
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

              <div class="meta-group">
                <span
                  class="status-pill"
                  :class="isPlaying ? 'status-live' : ''"
                >
                  <span class="status-dot"></span>
                  {{ playbackStatus }}
                </span>
                <div class="parks-counter">
                  <button
                    @click="toggleParksExpanded"
                    class="parks-toggle"
                    :class="{ expanded: isParksExpanded }"
                  >
                    <span class="parks-count">
                      {{ reachedNationalParks.length }} / {{ totalNationalParks }}
                    </span>
                    <span class="parks-label-text">National Parks</span>
                    <svg
                      class="chevron"
                      :class="{ rotated: isParksExpanded }"
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                  <Transition name="parks-expand">
                    <div v-if="isParksExpanded && reachedNationalParks.length > 0" class="parks-details">
                      <div class="parks-grid">
                        <span
                          v-for="(park, index) in reachedNationalParks"
                          :key="index"
                          class="park-item"
                        >
                          {{ park }}
                        </span>
                      </div>
                    </div>
                  </Transition>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
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
  border-radius: 28px;
  background: rgba(248, 250, 252, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(36px);
  padding: 28px 32px;
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.panel-top-row {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: flex-start;
}

.summary-block {
  flex: 1 1 220px;
  min-width: 220px;
}

.summary-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(15, 23, 42, 0.55);
  margin: 0 0 8px;
}

.summary-day {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}

.day-number {
  font-size: 2.25rem;
  font-weight: 700;
  color: #111827;
}

.day-total {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.45);
}

.summary-date {
  font-size: 1rem;
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
  min-width: 200px;
  text-align: right;
}

.distance-miles {
  font-size: 2.25rem;
  font-weight: 700;
  color: #1e293b;
  margin: 4px 0 0;
  line-height: 1;
}

.distance-miles span {
  font-size: 1rem;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.55);
  margin-left: 6px;
}

.distance-km {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.45);
  margin: 4px 0 0;
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

.parks-counter {
  flex: 1;
  max-width: 600px;
}

.parks-toggle {
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
  width: 100%;
  justify-content: space-between;
}

.parks-toggle:hover {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.12);
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
  flex: 1;
  text-align: left;
}

.chevron {
  transition: transform 0.2s ease;
  color: rgba(15, 23, 42, 0.5);
}

.chevron.rotated {
  transform: rotate(180deg);
}

.parks-details {
  margin-top: 8px;
  padding: 12px;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.parks-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.park-item {
  display: inline-block;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(15, 23, 42, 0.75);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

.parks-expand-enter-active,
.parks-expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.parks-expand-enter-from,
.parks-expand-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-8px);
}

.parks-expand-enter-to,
.parks-expand-leave-from {
  opacity: 1;
  max-height: 500px;
  transform: translateY(0);
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
    padding: 0 1.25rem 1.5rem;
  }

  .timeline-block {
    flex: 1 1 100%;
  }

  .distance-block {
    text-align: left;
  }
}

@media (max-width: 768px) {
  .toolbar-shell {
    padding: 0 1rem 1.25rem;
  }

  .panel-bottom-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .controls-group {
    width: 100%;
    justify-content: flex-start;
  }

  .meta-group {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 640px) {
  .glass-panel {
    padding: 22px 20px;
    border-radius: 24px;
  }

  .panel-top-row {
    flex-direction: column;
    gap: 20px;
  }

  .summary-block,
  .timeline-block,
  .distance-block {
    min-width: 100%;
  }

  .distance-block {
    text-align: left;
  }

  .panel-bottom-row {
    align-items: flex-start;
    gap: 16px;
  }

  .controls-group {
    width: 100%;
    justify-content: space-between;
  }

  .control-button,
  .control-button-play {
    flex: 1 1 0;
    max-width: 48px;
  }

  .control-button-play {
    max-width: 60px;
  }

  .speed-button {
    flex: 1 1 auto;
  }

  .meta-group {
    width: 100%;
    gap: 8px;
  }

  .meta-pill,
  .status-pill {
    flex: 1 1 calc(50% - 6px);
    justify-content: center;
    font-size: 0.78rem;
  }
}

@media (max-width: 480px) {
  .toolbar-shell {
    padding: 0 0.75rem 1rem;
  }

  .glass-panel {
    padding: 20px 16px;
  }

  .summary-day {
    gap: 6px;
  }

  .day-number {
    font-size: 1.8rem;
  }

  .distance-miles {
    font-size: 1.8rem;
  }

  .controls-group {
    gap: 8px;
  }

  .control-button,
  .control-button-play,
  .speed-button {
    height: 42px;
  }

  .meta-pill,
  .status-pill {
    flex: 1 1 100%;
  }
}
</style>
