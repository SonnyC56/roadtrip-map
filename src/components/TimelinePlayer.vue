<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoadTripStore } from '../stores/roadtrip'
import { format } from 'date-fns'
import {
  PlayIcon,
  PauseIcon,
  BackwardIcon,
  ForwardIcon,
  ArrowPathIcon
} from '@heroicons/vue/24/solid'

const store = useRoadTripStore()
const emit = defineEmits<{
  timeUpdate: [number] // emit current timestamp
}>()

const isPlaying = ref(false)
const currentTime = ref(0) // 0-100 percentage
const playbackSpeed = ref(1) // 1x, 2x, 4x
let animationFrame: number | null = null

const startDate = new Date('2025-08-10')
const endDate = new Date('2025-10-10')
const totalDuration = endDate.getTime() - startDate.getTime()

const currentDate = computed(() => {
  const timestamp = startDate.getTime() + (totalDuration * currentTime.value / 100)
  return new Date(timestamp)
})

const formattedDate = computed(() => {
  return format(currentDate.value, 'MMM dd, yyyy HH:mm')
})

const currentSegmentIndex = computed(() => {
  const timestamp = currentDate.value.getTime()
  return store.segments.findIndex(segment => {
    const segStart = new Date(segment.startTime).getTime()
    const segEnd = new Date(segment.endTime).getTime()
    return timestamp >= segStart && timestamp <= segEnd
  })
})

// Get media from current time period (within 1 day)
const currentMedia = computed(() => {
  const currentTimestamp = currentDate.value.getTime()
  const oneDayMs = 24 * 60 * 60 * 1000

  return store.allMedia.filter(media => {
    const mediaTimestamp = new Date(media.timestamp).getTime()
    return Math.abs(currentTimestamp - mediaTimestamp) <= oneDayMs
  })
})

function play() {
  isPlaying.value = true
  animate()
}

function pause() {
  isPlaying.value = false
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }
}

function animate() {
  if (!isPlaying.value) return

  // Increment by a small amount based on speed
  // Complete in ~30 seconds at 1x speed
  const increment = (playbackSpeed.value * 100) / (30 * 60) // 60fps

  currentTime.value = Math.min(100, currentTime.value + increment)

  if (currentTime.value >= 100) {
    pause()
    return
  }

  emit('timeUpdate', currentDate.value.getTime())

  animationFrame = requestAnimationFrame(animate)
}

function reset() {
  pause()
  currentTime.value = 0
  emit('timeUpdate', startDate.getTime())
}

function skipForward() {
  currentTime.value = Math.min(100, currentTime.value + 5)
  emit('timeUpdate', currentDate.value.getTime())
}

function skipBackward() {
  currentTime.value = Math.max(0, currentTime.value - 5)
  emit('timeUpdate', currentDate.value.getTime())
}

function handleSliderChange() {
  emit('timeUpdate', currentDate.value.getTime())
}

function cycleSpeed() {
  const speeds = [1, 2, 4, 8]
  const currentIndex = speeds.indexOf(playbackSpeed.value)
  playbackSpeed.value = speeds[(currentIndex + 1) % speeds.length]
}

// Update selected segment when time changes
watch(currentSegmentIndex, (index) => {
  if (index >= 0 && index !== store.selectedSegmentIndex) {
    store.selectSegment(index)
  }
})
</script>

<template>
  <div class="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
    <div class="space-y-4">
      <!-- Current Date Display -->
      <div class="text-center">
        <p class="text-xs text-gray-500 mb-1">Current Timeline Position</p>
        <p class="text-xl font-bold text-gray-900">{{ formattedDate }}</p>
        <p class="text-xs text-primary-600 mt-1">Day {{ Math.floor(currentTime.value * 62 / 100) + 1 }} of 62</p>
      </div>

      <!-- Progress Bar -->
      <div class="relative">
        <input
          v-model.number="currentTime"
          @input="handleSliderChange"
          type="range"
          min="0"
          max="100"
          step="0.1"
          class="w-full h-3 bg-gradient-to-r from-red-200 via-teal-200 to-green-200 rounded-full appearance-none cursor-pointer timeline-slider"
        />
        <div
          class="absolute top-0 left-0 h-3 bg-gradient-to-r from-red-500 via-teal-500 to-green-500 rounded-full pointer-events-none transition-all"
          :style="{ width: `${currentTime}%` }"
        ></div>
      </div>

      <!-- Playback Controls -->
      <div class="flex items-center justify-center gap-2">
        <button
          @click="reset"
          class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Reset to start"
        >
          <ArrowPathIcon class="h-5 w-5 text-gray-600" />
        </button>

        <button
          @click="skipBackward"
          class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Skip backward"
        >
          <BackwardIcon class="h-5 w-5 text-gray-600" />
        </button>

        <button
          @click="isPlaying ? pause() : play()"
          class="p-3 bg-primary-600 hover:bg-primary-700 rounded-full transition-colors shadow-lg"
          title="Play/Pause"
        >
          <PlayIcon v-if="!isPlaying" class="h-6 w-6 text-white" />
          <PauseIcon v-else class="h-6 w-6 text-white" />
        </button>

        <button
          @click="skipForward"
          class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Skip forward"
        >
          <ForwardIcon class="h-5 w-5 text-gray-600" />
        </button>

        <button
          @click="cycleSpeed"
          class="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium text-gray-700"
          title="Playback speed"
        >
          {{ playbackSpeed }}x
        </button>
      </div>

      <!-- Current Media Preview -->
      <div v-if="currentMedia.length > 0" class="pt-4 border-t border-gray-200">
        <p class="text-xs font-medium text-gray-700 mb-2">
          Media from this time ({{ currentMedia.length }})
        </p>
        <div class="grid grid-cols-4 gap-2">
          <div
            v-for="media in currentMedia.slice(0, 4)"
            :key="media.id"
            class="aspect-square rounded-md overflow-hidden border border-gray-200"
          >
            <img
              v-if="media.type.includes('photo')"
              :src="media.thumbnail || media.url"
              class="w-full h-full object-cover"
            />
            <video
              v-else
              :src="media.url"
              class="w-full h-full object-cover"
            ></video>
          </div>
          <div
            v-if="currentMedia.length > 4"
            class="aspect-square rounded-md bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600"
          >
            +{{ currentMedia.length - 4 }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom slider styling */
.timeline-slider::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  border: 3px solid #0ea5e9;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  position: relative;
  z-index: 10;
}

.timeline-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  border: 3px solid #0ea5e9;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.timeline-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.timeline-slider {
  position: relative;
  z-index: 1;
}
</style>
