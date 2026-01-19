<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { useRoadTripStore, type MediaItem, type XRSceneConfig } from '../stores/roadtrip'
import { format } from 'date-fns'
import MediaComments from './MediaComments.vue'

// XRGallery is loaded as IIFE and exposes window.XRGallery
declare global {
  interface Window {
    XRGallery?: {
      init: (options: { config: any }) => Promise<any>
    }
    __XRGALLERY_CONFIG__?: any
  }
}

// WebXR Navigator extension
interface XRSystem {
  isSessionSupported(mode: string): Promise<boolean>
}

declare global {
  interface Navigator {
    xr?: XRSystem
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
const galleryInstance = ref<any>(null)
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const showInfo = ref(false)
const showComments = ref(false)
const showVRModal = ref(false)
const currentStage = ref(0)
const isScriptLoaded = ref(false)
const scriptLoadAttempts = ref(0)
const MAX_SCRIPT_LOAD_ATTEMPTS = 3

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

const xrConfig = computed(() => currentMedia.value.xrConfig)
const totalStages = computed(() => xrConfig.value?.stages?.length || 0)

// CDN URLs to try (primary and fallbacks)
const CDN_URLS = [
  'https://unpkg.com/@xrgallery/viewer@1.0.0/dist/viewer-bundle.iife.js',
  'https://cdn.jsdelivr.net/npm/@xrgallery/viewer@1.0.0/dist/viewer-bundle.iife.js'
]

// Load the XRGallery script dynamically with retry logic
async function loadXRGalleryScript(): Promise<void> {
  if (isScriptLoaded.value || window.XRGallery) {
    isScriptLoaded.value = true
    return
  }

  const loadFromUrl = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Set a timeout for script loading (10 seconds)
      const timeoutId = setTimeout(() => {
        reject(new Error('Script load timed out'))
      }, 10000)

      const script = document.createElement('script')
      script.src = url
      script.async = true
      script.onload = () => {
        clearTimeout(timeoutId)
        if (window.XRGallery) {
          isScriptLoaded.value = true
          resolve()
        } else {
          reject(new Error('XRGallery not found after script load'))
        }
      }
      script.onerror = () => {
        clearTimeout(timeoutId)
        // Remove failed script
        script.remove()
        reject(new Error(`Failed to load from ${url}`))
      }
      document.head.appendChild(script)
    })
  }

  // Try each CDN URL until one succeeds
  let lastError: Error | null = null
  for (const url of CDN_URLS) {
    scriptLoadAttempts.value++
    try {
      await loadFromUrl(url)
      return // Success!
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      console.warn(`Failed to load XRGallery from ${url}:`, error)
    }
  }

  // All CDNs failed
  throw new Error(`Failed to load XRGallery library after trying ${CDN_URLS.length} sources. Please check your internet connection.`)
}

async function initViewer() {
  if (!viewerContainer.value) {
    loadError.value = 'Viewer container not available'
    isLoading.value = false
    return
  }

  // Check for XR config
  if (!xrConfig.value) {
    loadError.value = 'No XR scene configuration provided. Please add stage data to view this experience.'
    isLoading.value = false
    return
  }

  isLoading.value = true
  loadError.value = null
  currentStage.value = 0

  // If stages are empty but we have a configUrl, try to fetch the config
  let stages = xrConfig.value.stages || []
  if (stages.length === 0 && xrConfig.value.configUrl) {
    try {
      const response = await fetch(xrConfig.value.configUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`)
      }
      const remoteConfig = await response.json()
      if (remoteConfig.stages && Array.isArray(remoteConfig.stages)) {
        stages = remoteConfig.stages
        // Also update navigation and globalAudio if provided
        if (remoteConfig.navigation) {
          xrConfig.value.navigation = remoteConfig.navigation
        }
        if (remoteConfig.globalAudio) {
          xrConfig.value.globalAudio = remoteConfig.globalAudio
        }
      }
    } catch (error) {
      console.error('Failed to fetch XR config:', error)
      loadError.value = `Failed to load XR scene configuration from URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      isLoading.value = false
      return
    }
  }

  // Validate stages array
  if (stages.length === 0) {
    loadError.value = 'XR scene has no stages configured. At least one stage with a skybox is required.'
    isLoading.value = false
    return
  }

  // Set up initialization timeout (30 seconds)
  const timeoutId = setTimeout(() => {
    if (isLoading.value) {
      loadError.value = 'XR scene loading timed out. The scene may be too large or the server is not responding.'
      isLoading.value = false
    }
  }, 30000)

  try {
    // Load script if needed
    await loadXRGalleryScript()

    // Wait for next tick to ensure DOM is ready
    await nextTick()

    // Create canvas element for BabylonJS
    const canvas = document.createElement('canvas')
    canvas.id = 'renderCanvas'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    canvas.style.touchAction = 'none'

    // Clear container and add canvas
    viewerContainer.value.innerHTML = ''
    viewerContainer.value.appendChild(canvas)

    // Build the experience config with validated stages
    const experienceConfig = {
      experience: {
        title: currentMedia.value.caption || 'XR Experience',
        description: `Travel vlog immersive experience`,
        defaultFOV: 1.0
      },
      stages: stages.map((stage, index) => ({
        id: stage.id || `stage-${index}`,
        name: stage.name || `Stage ${index + 1}`,
        skybox: stage.skybox || { type: 'color', color: '#1a1a2e' },
        hotspots: stage.hotspots?.map(h => ({
          ...h,
          color: h.type === 'navigation' ? '#4A90E2' : '#FF6B6B'
        })) || [],
        audioUrl: stage.audioUrl,
        audioVolume: stage.audioVolume ?? 0.5
      })),
      navigation: xrConfig.value.navigation || { type: 'none' },
      globalAudio: xrConfig.value.globalAudio,
      disableLogo: true,
      disableFooterBranding: true
    }

    // Set config on window for the viewer to pick up
    window.__XRGALLERY_CONFIG__ = experienceConfig

    // Initialize the gallery
    if (window.XRGallery) {
      galleryInstance.value = await window.XRGallery.init({
        config: experienceConfig
      })

      // Listen for stage changes if the gallery supports it
      if (galleryInstance.value?.on) {
        galleryInstance.value.on('stageChange', (data: { index: number }) => {
          currentStage.value = data.index
        })
      }
    }

    clearTimeout(timeoutId)
    isLoading.value = false

  } catch (error) {
    clearTimeout(timeoutId)
    loadError.value = error instanceof Error ? error.message : 'Failed to load XR scene'
    isLoading.value = false
    console.error('XRGallery init error:', error)
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (showVRModal.value) {
      showVRModal.value = false
    } else if (showInfo.value || showComments.value) {
      showInfo.value = false
      showComments.value = false
    } else {
      close()
    }
  } else if (e.key === 'ArrowRight') {
    if (e.shiftKey && totalStages.value > 1) {
      // Shift+Right: Next stage
      nextStage()
    } else if (canGoNext.value) {
      // Right: Next media
      next()
    }
  } else if (e.key === 'ArrowLeft') {
    if (e.shiftKey && totalStages.value > 1) {
      // Shift+Left: Previous stage
      prevStage()
    } else if (canGoPrevious.value) {
      // Left: Previous media
      previous()
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  initViewer()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  // Clean up
  if (galleryInstance.value?.destroy) {
    galleryInstance.value.destroy()
  }
  galleryInstance.value = null
  window.__XRGALLERY_CONFIG__ = undefined
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

function toggleInfo() {
  showInfo.value = !showInfo.value
  if (showInfo.value) showComments.value = false
}

function toggleComments() {
  showComments.value = !showComments.value
  if (showComments.value) showInfo.value = false
}

function enterVR() {
  // Check if WebXR is supported
  if (navigator.xr) {
    navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
      if (supported && galleryInstance.value?.enterVR) {
        galleryInstance.value.enterVR()
      } else {
        showVRModal.value = true
      }
    }).catch(() => {
      showVRModal.value = true
    })
  } else {
    showVRModal.value = true
  }
}

function closeVRModal() {
  showVRModal.value = false
}

// Stage navigation
function goToStage(index: number) {
  if (index >= 0 && index < totalStages.value) {
    if (galleryInstance.value?.goToStage) {
      galleryInstance.value.goToStage(index)
    }
    currentStage.value = index
  }
}

function nextStage() {
  if (currentStage.value < totalStages.value - 1) {
    goToStage(currentStage.value + 1)
  }
}

function prevStage() {
  if (currentStage.value > 0) {
    goToStage(currentStage.value - 1)
  }
}
</script>

<template>
  <div class="xr-viewer-overlay">
    <div class="xr-viewer-container">
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
          <span class="xr-badge">XR 360°</span>
          <span class="media-title">{{ currentMedia.caption || 'Immersive Experience' }}</span>
        </div>

        <div class="toolbar-actions">
          <button @click="enterVR" class="btn-toolbar btn-vr" title="Enter VR Mode">
            🥽 VR Mode
          </button>
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
          <p class="loading-text">Loading XR Experience...</p>
          <p class="loading-subtext">Preparing immersive environment</p>
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

      <!-- Stage navigation controls -->
      <div v-if="!isLoading && !loadError && totalStages > 1" class="stage-controls">
        <button
          @click="prevStage"
          class="btn-stage"
          :disabled="currentStage === 0"
          title="Previous stage (Shift+←)"
        >
          ◀
        </button>

        <div class="stage-dots">
          <button
            v-for="i in totalStages"
            :key="i"
            @click="goToStage(i - 1)"
            class="stage-dot"
            :class="{ active: currentStage === i - 1 }"
            :title="`Go to stage ${i}`"
          />
        </div>

        <button
          @click="nextStage"
          class="btn-stage"
          :disabled="currentStage === totalStages - 1"
          title="Next stage (Shift+→)"
        >
          ▶
        </button>

        <span class="stage-label">{{ currentStage + 1 }} / {{ totalStages }}</span>
      </div>

      <!-- Info panel -->
      <Transition name="slide-left">
        <div v-if="showInfo" class="overlay-panel info-panel">
          <div class="panel-header">
            <h3 class="panel-title">Experience Info</h3>
            <button @click="showInfo = false" class="btn-close-panel">✕</button>
          </div>

          <div class="panel-content">
            <div class="info-section">
              <h4 class="info-label">Title</h4>
              <p class="info-value">{{ currentMedia.caption || 'Untitled Experience' }}</p>
            </div>

            <div class="info-section">
              <h4 class="info-label">Date Captured</h4>
              <p class="info-value">{{ formattedDate }}</p>
            </div>

            <div v-if="locationText" class="info-section">
              <h4 class="info-label">Location</h4>
              <p class="info-value">{{ locationText }}</p>
            </div>

            <div class="info-section">
              <h4 class="info-label">Type</h4>
              <p class="info-value">Immersive XR Experience</p>
            </div>

            <div v-if="totalStages > 0" class="info-section">
              <h4 class="info-label">Scenes</h4>
              <p class="info-value">{{ totalStages }} interactive scenes</p>
            </div>

            <div class="info-section controls-info">
              <h4 class="info-label">Controls</h4>
              <ul class="controls-list">
                <li><kbd>Click + Drag</kbd> Look around</li>
                <li><kbd>Scroll</kbd> Zoom (if enabled)</li>
                <li><kbd>Click hotspots</kbd> Navigate/Info</li>
                <li><kbd>Shift + ←/→</kbd> Navigate stages</li>
                <li><kbd>VR Button</kbd> Enter VR mode</li>
              </ul>
            </div>

            <div class="info-section vr-info">
              <h4 class="info-label">VR Mode</h4>
              <p class="info-value-small">
                For the full immersive experience, use a WebXR-compatible browser
                with a VR headset (Meta Quest, HTC Vive, etc.)
              </p>
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

      <!-- VR Not Supported Modal -->
      <Transition name="fade">
        <div v-if="showVRModal" class="vr-modal-overlay" @click.self="closeVRModal">
          <div class="vr-modal">
            <div class="vr-modal-header">
              <span class="vr-modal-icon">🥽</span>
              <h3 class="vr-modal-title">VR Mode Unavailable</h3>
            </div>
            <div class="vr-modal-body">
              <p>To experience this content in VR, you'll need:</p>
              <ul class="vr-requirements">
                <li>A WebXR-compatible browser (Chrome, Edge, Firefox Reality)</li>
                <li>A VR headset (Meta Quest, HTC Vive, Valve Index, etc.)</li>
                <li>For standalone headsets: Open this page in the headset's browser</li>
              </ul>
              <p class="vr-tip">
                You can still explore this experience in 360° mode by clicking and dragging to look around.
              </p>
            </div>
            <div class="vr-modal-footer">
              <button @click="closeVRModal" class="btn-vr-close">Got it</button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.xr-viewer-overlay {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 3000;
}

.xr-viewer-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.viewer-canvas {
  width: 100%;
  height: 100%;
  background: #0a0a0a;
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

.xr-badge {
  display: inline-flex;
  padding: 0.25rem 0.625rem;
  background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
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
  background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
}

.btn-vr {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.btn-vr:hover {
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
}

.btn-toolbar .count {
  font-size: 0.75rem;
  opacity: 0.8;
}

/* Loading overlay */
.loading-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
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
  width: 64px;
  height: 64px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top-color: #06b6d4;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.loading-subtext {
  font-size: 0.875rem;
  opacity: 0.6;
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
  background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
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

/* Stage navigation controls */
.stage-controls {
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
  color: white;
  z-index: 99;
}

.btn-stage {
  background: none;
  border: none;
  color: white;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.25rem;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.btn-stage:hover:not(:disabled) {
  opacity: 1;
}

.btn-stage:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.stage-dots {
  display: flex;
  gap: 0.5rem;
}

.stage-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.stage-dot:hover {
  background: rgba(255, 255, 255, 0.6);
}

.stage-dot.active {
  background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
  transform: scale(1.2);
}

.stage-label {
  font-size: 0.875rem;
  font-weight: 600;
  opacity: 0.8;
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
  background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
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

.info-value-small {
  font-size: 0.8125rem;
  color: #475569;
  margin: 0;
  line-height: 1.5;
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
  min-width: 100px;
  text-align: center;
}

.vr-info {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1rem;
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

/* VR Modal */
.vr-modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.vr-modal {
  background: white;
  border-radius: 16px;
  max-width: 420px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.vr-modal-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
}

.vr-modal-icon {
  font-size: 1.5rem;
}

.vr-modal-title {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0;
}

.vr-modal-body {
  padding: 1.5rem;
}

.vr-modal-body p {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  color: #475569;
  line-height: 1.6;
}

.vr-requirements {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem;
}

.vr-requirements li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0;
  font-size: 0.875rem;
  color: #1f2937;
  border-bottom: 1px solid rgba(15, 23, 42, 0.05);
}

.vr-requirements li::before {
  content: "•";
  color: #f59e0b;
  font-weight: 700;
}

.vr-tip {
  background: rgba(6, 182, 212, 0.1);
  border: 1px solid rgba(6, 182, 212, 0.2);
  border-radius: 8px;
  padding: 0.75rem;
  margin-top: 1rem;
  font-size: 0.8125rem !important;
  color: #0e7490 !important;
}

.vr-modal-footer {
  padding: 1rem 1.5rem;
  background: rgba(248, 250, 252, 0.8);
  display: flex;
  justify-content: flex-end;
}

.btn-vr-close {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
  border: none;
  color: white;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-vr-close:hover {
  transform: scale(1.02);
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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

  .btn-nav {
    width: 48px;
    height: 48px;
  }

  .stage-controls {
    padding: 0.5rem 1rem;
    gap: 0.75rem;
  }
}
</style>
