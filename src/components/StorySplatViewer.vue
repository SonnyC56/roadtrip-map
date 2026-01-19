<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRoadTripStore, type MediaItem } from '../stores/roadtrip'
import { format } from 'date-fns'
import MediaComments from './MediaComments.vue'

// Dynamic import to handle missing package gracefully
let storySplatModule: {
  createViewerFromSceneId: any
  createViewer: any
  createViewerFromUrl: any
} | null = null

type ViewerInstance = {
  destroy: () => void
  on: (event: string, callback: (data?: any) => void) => void
  getWaypointCount: () => number
  getCurrentWaypointIndex: () => number
  nextWaypoint: () => void
  prevWaypoint: () => void
  goToWaypoint: (index: number) => void
  play: () => void
  pause: () => void
}

async function loadStorySplatLibrary(): Promise<typeof storySplatModule> {
  if (storySplatModule) return storySplatModule

  try {
    const module = await import('storysplat-viewer')
    storySplatModule = {
      createViewerFromSceneId: module.createViewerFromSceneId,
      createViewer: module.createViewer,
      createViewerFromUrl: module.createViewerFromUrl
    }
    return storySplatModule
  } catch (error) {
    console.error('Failed to load storysplat-viewer:', error)
    throw new Error('StorySplat viewer library not available. Please ensure storysplat-viewer is installed.')
  }
}

const props = defineProps<{
  mediaItem: MediaItem
  allMedia: MediaItem[]
  currentIndex: number
}>()

const emit = defineEmits<{
  close: []
  next: []
  previous: []
}>()

const store = useRoadTripStore()
const viewerContainer = ref<HTMLDivElement | null>(null)
const viewerInstance = ref<ViewerInstance | null>(null)
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const loadProgress = ref(0)
const showInfo = ref(false)
const showComments = ref(false)

const currentMedia = computed(() => props.mediaItem)
const canGoNext = computed(() => props.currentIndex < props.allMedia.length - 1)
const canGoPrevious = computed(() => props.currentIndex > 0)

const formattedDate = computed(() => {
  return format(new Date(currentMedia.value.timestamp), 'EEEE, MMM dd, yyyy h:mm a')
})

const locationText = computed(() => {
  if (!currentMedia.value.location) return null
  const { lat, lng, isInferred } = currentMedia.value.location
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}${isInferred ? ' (inferred)' : ''}`
})

// Waypoint navigation state
const currentWaypoint = ref(0)
const totalWaypoints = ref(0)
const isPlaying = ref(false)

async function initViewer() {
  if (!viewerContainer.value) return

  // Clean up existing viewer
  if (viewerInstance.value) {
    viewerInstance.value.destroy()
    viewerInstance.value = null
  }

  isLoading.value = true
  loadError.value = null
  loadProgress.value = 0

  // Set up initialization timeout (30 seconds)
  const timeoutId = setTimeout(() => {
    if (isLoading.value) {
      loadError.value = 'Scene loading timed out. The scene may be too large or the server is not responding.'
      isLoading.value = false
    }
  }, 30000)

  try {
    // Load the library dynamically
    const lib = await loadStorySplatLibrary()
    if (!lib) {
      throw new Error('StorySplat library failed to load')
    }

    const config = currentMedia.value.splatConfig
    let viewer: ViewerInstance

    if (config?.sceneId) {
      // Load from StorySplat API
      viewer = await lib.createViewerFromSceneId(
        viewerContainer.value,
        config.sceneId,
        {
          autoPlay: config.autoPlay ?? false,
          showUI: config.showUI ?? true,
          revealEffect: config.revealEffect ?? 'medium'
        }
      )
    } else if (config?.sceneUrl) {
      // Load from URL
      viewer = await lib.createViewerFromUrl(
        viewerContainer.value,
        config.sceneUrl,
        {
          autoPlay: config.autoPlay ?? false,
          showUI: config.showUI ?? true,
          revealEffect: config.revealEffect ?? 'medium'
        }
      )
    } else if (currentMedia.value.url) {
      // Load from media URL (assume it's a scene JSON)
      viewer = await lib.createViewerFromUrl(
        viewerContainer.value,
        currentMedia.value.url,
        {
          autoPlay: false,
          showUI: true,
          revealEffect: 'medium'
        }
      )
    } else {
      throw new Error('No scene source provided')
    }

    clearTimeout(timeoutId)
    viewerInstance.value = viewer

    // Listen for events
    viewer.on('ready', () => {
      isLoading.value = false
      totalWaypoints.value = viewer.getWaypointCount()
      currentWaypoint.value = viewer.getCurrentWaypointIndex()
    })

    viewer.on('progress', (data: { percent: number }) => {
      loadProgress.value = data.percent
    })

    viewer.on('waypointChange', (data: { index: number }) => {
      currentWaypoint.value = data.index
    })

    viewer.on('playbackStart', () => {
      isPlaying.value = true
    })

    viewer.on('playbackStop', () => {
      isPlaying.value = false
    })

    viewer.on('error', (error: Error) => {
      loadError.value = error.message
      isLoading.value = false
    })

  } catch (error) {
    clearTimeout(timeoutId)
    loadError.value = error instanceof Error ? error.message : 'Failed to load scene'
    isLoading.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (showInfo.value || showComments.value) {
      showInfo.value = false
      showComments.value = false
    } else {
      close()
    }
  } else if (e.key === 'ArrowRight') {
    if (e.shiftKey && viewerInstance.value) {
      viewerInstance.value.nextWaypoint()
    } else if (canGoNext.value) {
      next()
    }
  } else if (e.key === 'ArrowLeft') {
    if (e.shiftKey && viewerInstance.value) {
      viewerInstance.value.prevWaypoint()
    } else if (canGoPrevious.value) {
      previous()
    }
  } else if (e.key === ' ' && viewerInstance.value) {
    e.preventDefault()
    togglePlayback()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  initViewer()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  if (viewerInstance.value) {
    viewerInstance.value.destroy()
    viewerInstance.value = null
  }
})

watch(() => props.mediaItem.id, () => {
  showInfo.value = false
  showComments.value = false
  initViewer()
})

function close() {
  emit('close')
}

function next() {
  if (canGoNext.value) {
    emit('next')
  }
}

function previous() {
  if (canGoPrevious.value) {
    emit('previous')
  }
}

function togglePlayback() {
  if (!viewerInstance.value) return

  if (isPlaying.value) {
    viewerInstance.value.pause()
  } else {
    viewerInstance.value.play()
  }
}

function goToWaypoint(index: number) {
  viewerInstance.value?.goToWaypoint(index)
}

function toggleInfo() {
  showInfo.value = !showInfo.value
  if (showInfo.value) showComments.value = false
}

function toggleComments() {
  showComments.value = !showComments.value
  if (showComments.value) showInfo.value = false
}
</script>

<template>
  <div class="splat-viewer-overlay">
    <div class="splat-viewer-container">
      <!-- Close button -->
      <button @click="close" class="btn-close" title="Close (Esc)">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>

      <!-- Navigation buttons -->
      <button
        v-if="canGoPrevious"
        @click="previous"
        class="btn-nav btn-nav-prev"
        title="Previous (←)"
      >
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M20 26L10 16L20 6" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <button
        v-if="canGoNext"
        @click="next"
        class="btn-nav btn-nav-next"
        title="Next (→)"
      >
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M12 6L22 16L12 26" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <!-- Top toolbar -->
      <div class="top-toolbar">
        <div class="toolbar-title">
          <span class="splat-badge">3D SPLAT</span>
          <span class="media-title">{{ currentMedia.caption || 'Untitled Scene' }}</span>
        </div>

        <div class="toolbar-actions">
          <button @click="toggleInfo" class="btn-toolbar" :class="{ active: showInfo }" title="Show Info">
            <span class="icon">ℹ️</span>
          </button>
          <button @click="toggleComments" class="btn-toolbar" :class="{ active: showComments }" title="Show Comments">
            <span class="icon">💬</span>
            <span class="count">{{ currentMedia.comments?.length || 0 }}</span>
          </button>
        </div>
      </div>

      <!-- Viewer container -->
      <div ref="viewerContainer" class="viewer-canvas" />

      <!-- Loading overlay -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-content">
          <div class="loading-spinner" />
          <p class="loading-text">Loading 3D Scene...</p>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${loadProgress}%` }" />
          </div>
          <p class="progress-text">{{ Math.round(loadProgress) }}%</p>
        </div>
      </div>

      <!-- Error overlay -->
      <div v-if="loadError" class="error-overlay">
        <div class="error-content">
          <span class="error-icon">⚠️</span>
          <p class="error-text">{{ loadError }}</p>
          <button @click="initViewer" class="btn-retry">Retry</button>
        </div>
      </div>

      <!-- Waypoint controls -->
      <div v-if="!isLoading && !loadError && totalWaypoints > 1" class="waypoint-controls">
        <button
          @click="viewerInstance?.prevWaypoint()"
          class="btn-waypoint"
          :disabled="currentWaypoint === 0"
          title="Previous waypoint (Shift+←)"
        >
          ◀
        </button>

        <div class="waypoint-dots">
          <button
            v-for="i in totalWaypoints"
            :key="i"
            @click="goToWaypoint(i - 1)"
            class="waypoint-dot"
            :class="{ active: currentWaypoint === i - 1 }"
            :title="`Go to waypoint ${i}`"
          />
        </div>

        <button
          @click="viewerInstance?.nextWaypoint()"
          class="btn-waypoint"
          :disabled="currentWaypoint === totalWaypoints - 1"
          title="Next waypoint (Shift+→)"
        >
          ▶
        </button>

        <button
          @click="togglePlayback"
          class="btn-playback"
          :title="isPlaying ? 'Pause (Space)' : 'Play (Space)'"
        >
          {{ isPlaying ? '⏸' : '▶️' }}
        </button>
      </div>

      <!-- Info panel -->
      <Transition name="slide-left">
        <div v-if="showInfo" class="overlay-panel info-panel">
          <div class="panel-header">
            <h3 class="panel-title">Scene Info</h3>
            <button @click="showInfo = false" class="btn-close-panel">✕</button>
          </div>

          <div class="panel-content">
            <div class="info-section">
              <h4 class="info-label">Caption</h4>
              <p class="info-value">{{ currentMedia.caption || 'No caption' }}</p>
            </div>

            <div class="info-section">
              <h4 class="info-label">Date</h4>
              <p class="info-value">{{ formattedDate }}</p>
            </div>

            <div v-if="locationText" class="info-section">
              <h4 class="info-label">Location</h4>
              <p class="info-value">{{ locationText }}</p>
            </div>

            <div class="info-section">
              <h4 class="info-label">Type</h4>
              <p class="info-value">Gaussian Splat 3D Scene</p>
            </div>

            <div v-if="totalWaypoints > 0" class="info-section">
              <h4 class="info-label">Waypoints</h4>
              <p class="info-value">{{ totalWaypoints }} waypoints</p>
            </div>

            <div class="info-section controls-info">
              <h4 class="info-label">Controls</h4>
              <ul class="controls-list">
                <li><kbd>Click + Drag</kbd> Rotate view</li>
                <li><kbd>Scroll</kbd> Zoom</li>
                <li><kbd>Shift + ←/→</kbd> Navigate waypoints</li>
                <li><kbd>Space</kbd> Play/Pause tour</li>
              </ul>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Comments panel -->
      <Transition name="slide-left">
        <div v-if="showComments" class="overlay-panel comments-panel">
          <div class="panel-header">
            <h3 class="panel-title">Comments</h3>
            <button @click="showComments = false" class="btn-close-panel">✕</button>
          </div>

          <div class="panel-content">
            <MediaComments :media-id="currentMedia.id" />
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.splat-viewer-overlay {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 3000;
}

.splat-viewer-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.viewer-canvas {
  width: 100%;
  height: 100%;
  background: #111;
}

.btn-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 100;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  border: none;
  color: white;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-close:hover {
  background: rgba(0, 0, 0, 0.9);
  transform: scale(1.1);
}

.btn-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 100;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  border: none;
  color: white;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-nav:hover {
  background: rgba(0, 0, 0, 0.9);
  transform: translateY(-50%) scale(1.1);
}

.btn-nav-prev {
  left: 1rem;
}

.btn-nav-next {
  right: 1rem;
}

.top-toolbar {
  position: absolute;
  top: 1rem;
  left: 1rem;
  right: 5rem;
  z-index: 99;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  pointer-events: none;
}

.top-toolbar > * {
  pointer-events: auto;
}

.toolbar-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  padding: 0.75rem 1rem;
  border-radius: 12px;
  color: white;
  max-width: 50%;
}

.splat-badge {
  display: inline-flex;
  padding: 0.25rem 0.625rem;
  background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
  border-radius: 6px;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.media-title {
  font-size: 0.875rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-toolbar {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  border: none;
  color: white;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-toolbar:hover {
  background: rgba(0, 0, 0, 0.9);
}

.btn-toolbar.active {
  background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
}

.btn-toolbar .count {
  font-size: 0.75rem;
  opacity: 0.8;
}

/* Loading overlay */
.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.loading-content {
  text-align: center;
  color: white;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.progress-bar {
  width: 200px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin: 0 auto 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #8b5cf6, #ec4899);
  transition: width 0.3s;
}

.progress-text {
  font-size: 0.875rem;
  opacity: 0.7;
}

/* Error overlay */
.error-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.error-content {
  text-align: center;
  color: white;
}

.error-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

.error-text {
  font-size: 1rem;
  margin-bottom: 1.5rem;
  max-width: 300px;
}

.btn-retry {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
  border: none;
  color: white;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-retry:hover {
  transform: scale(1.05);
}

/* Waypoint controls */
.waypoint-controls {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  padding: 0.75rem 1.25rem;
  border-radius: 999px;
  z-index: 99;
}

.btn-waypoint {
  background: none;
  border: none;
  color: white;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.25rem;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.btn-waypoint:hover:not(:disabled) {
  opacity: 1;
}

.btn-waypoint:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.waypoint-dots {
  display: flex;
  gap: 0.5rem;
}

.waypoint-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.waypoint-dot:hover {
  background: rgba(255, 255, 255, 0.6);
}

.waypoint-dot.active {
  background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
  transform: scale(1.2);
}

.btn-playback {
  background: none;
  border: none;
  color: white;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.25rem;
  transition: transform 0.2s;
}

.btn-playback:hover {
  transform: scale(1.1);
}

/* Overlay panels */
.overlay-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 400px;
  height: 100%;
  background: white;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
  z-index: 98;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.1);
  background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
  color: white;
}

.panel-title {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0;
}

.btn-close-panel {
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.25rem;
  transition: transform 0.2s;
}

.btn-close-panel:hover {
  transform: scale(1.2);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.info-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.1);
}

.info-section:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(15, 23, 42, 0.6);
  margin: 0 0 0.5rem;
}

.info-value {
  font-size: 0.875rem;
  color: #1f2937;
  margin: 0;
  line-height: 1.6;
}

.controls-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 0.875rem;
  color: #475569;
}

.controls-list li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.controls-list kbd {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: rgba(15, 23, 42, 0.05);
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.75rem;
  min-width: 80px;
  text-align: center;
}

/* Transitions */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.3s ease;
}

.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(100%);
}

/* Responsive */
@media (max-width: 768px) {
  .top-toolbar {
    flex-direction: column;
    align-items: flex-start;
    right: 4rem;
  }

  .toolbar-title {
    max-width: 100%;
  }

  .overlay-panel {
    width: 100%;
  }

  .waypoint-controls {
    padding: 0.5rem 1rem;
    gap: 0.75rem;
  }

  .btn-nav {
    width: 48px;
    height: 48px;
  }
}
</style>
