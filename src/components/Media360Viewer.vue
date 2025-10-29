<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Viewer } from '@photo-sphere-viewer/core'
import { useRoadTripStore, type MediaItem } from '../stores/roadtrip'
import { format } from 'date-fns'
import MediaComments from './MediaComments.vue'
import '@photo-sphere-viewer/core/index.css'

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
const videoRef = ref<HTMLVideoElement | null>(null)
const viewer360 = ref<Viewer | null>(null)
const showComments = ref(false)
const showMetadata = ref(false)
const editingCaption = ref(false)
const captionInput = ref('')

const currentMedia = computed(() => props.mediaItem)
const is360Photo = computed(() => currentMedia.value.type === '360-photo')
const is360Video = computed(() => currentMedia.value.type === '360-video')
const canGoNext = computed(() => props.currentIndex < props.allMedia.length - 1)
const canGoPrevious = computed(() => props.currentIndex > 0)

// Format metadata
const formattedDate = computed(() => {
  return format(new Date(currentMedia.value.timestamp), 'EEEE, MMM dd, yyyy h:mm a')
})

const locationText = computed(() => {
  if (!currentMedia.value.location) return null
  const { lat, lng, isInferred } = currentMedia.value.location
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}${isInferred ? ' (inferred)' : ''}`
})

// Initialize 360° viewer
async function init360Viewer() {
  if (!is360Photo.value || !viewerContainer.value) return

  // Clean up existing viewer
  if (viewer360.value) {
    viewer360.value.destroy()
    viewer360.value = null
  }

  await nextTick()

  try {
    viewer360.value = new Viewer({
      container: viewerContainer.value,
      panorama: currentMedia.value.url,
      navbar: [
        'zoom',
        'move',
        'fullscreen',
      ],
      defaultZoomLvl: 50,
      mousewheel: true,
      mousemove: true,
    })
  } catch (error) {
    console.error('Failed to initialize 360° viewer:', error)
  }
}

// Initialize 360° video
function init360Video() {
  if (!is360Video.value || !videoRef.value) return

  // Note: Full Video.js VR integration would require more setup
  // This is a placeholder for basic video playback
  // For full VR, you would initialize videojs with the VR plugin here
}

// Handle keyboard navigation
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (showComments.value || showMetadata.value) {
      showComments.value = false
      showMetadata.value = false
    } else {
      close()
    }
  } else if (e.key === 'ArrowRight' && canGoNext.value) {
    next()
  } else if (e.key === 'ArrowLeft' && canGoPrevious.value) {
    previous()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  if (is360Photo.value) {
    init360Viewer()
  } else if (is360Video.value) {
    init360Video()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  if (viewer360.value) {
    viewer360.value.destroy()
    viewer360.value = null
  }
})

// Reinitialize when media changes
watch(() => props.mediaItem.id, () => {
  showComments.value = false
  showMetadata.value = false
  editingCaption.value = false

  if (is360Photo.value) {
    init360Viewer()
  } else if (is360Video.value) {
    if (videoRef.value) {
      videoRef.value.pause()
      videoRef.value.currentTime = 0
    }
    init360Video()
  }
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

function toggleComments() {
  showComments.value = !showComments.value
  if (showComments.value) showMetadata.value = false
}

function toggleMetadata() {
  showMetadata.value = !showMetadata.value
  if (showMetadata.value) showComments.value = false
}

function startEditCaption() {
  captionInput.value = currentMedia.value.caption || ''
  editingCaption.value = true
}

function saveCaption() {
  const media = store.allMedia.find(m => m.id === currentMedia.value.id)
  if (media) {
    media.caption = captionInput.value
    localStorage.setItem('roadtrip-media', JSON.stringify(store.allMedia))
  }
  editingCaption.value = false
}

function cancelEditCaption() {
  editingCaption.value = false
}

function enterVR() {
  if (viewer360.value) {
    // Note: Full VR mode requires WebXR/WebVR support
    // Photo Sphere Viewer has built-in stereo mode
    alert('VR Mode: Use a VR-compatible browser and headset for full VR experience. In the meantime, use fullscreen mode for immersive viewing.')
  } else if (videoRef.value) {
    // For Video.js VR, you would call the VR mode here
    alert('360° Video VR: Full VR mode requires Video.js VR plugin setup.')
  }
}
</script>

<template>
  <div class="viewer-360-overlay">
    <div class="viewer-360-container">
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
          <span class="vr-badge">360° VR</span>
          <span class="media-title">{{ currentMedia.caption || 'Untitled' }}</span>
        </div>

        <div class="toolbar-actions">
          <button @click="enterVR" class="btn-toolbar btn-vr" title="Enter VR Mode">
            🥽 VR Mode
          </button>
          <button @click="toggleMetadata" class="btn-toolbar" :class="{ active: showMetadata }" title="Show Metadata">
            ℹ️
          </button>
          <button @click="toggleComments" class="btn-toolbar" :class="{ active: showComments }" title="Show Comments">
            💬 {{ currentMedia.comments?.length || 0 }}
          </button>
        </div>
      </div>

      <!-- 360° Photo Viewer -->
      <div
        v-if="is360Photo"
        ref="viewerContainer"
        class="photo-sphere-container"
      />

      <!-- 360° Video Player -->
      <video
        v-if="is360Video"
        ref="videoRef"
        :src="currentMedia.url"
        controls
        class="video-360-player"
      />

      <!-- Metadata overlay -->
      <Transition name="slide-left">
        <div v-if="showMetadata" class="overlay-panel metadata-panel">
          <div class="panel-header">
            <h3 class="panel-title">Media Info</h3>
            <button @click="showMetadata = false" class="btn-close-panel">✕</button>
          </div>

          <div class="panel-content">
            <!-- Caption -->
            <div class="info-section">
              <div v-if="!editingCaption" class="caption-display">
                <h4 class="info-label">Caption</h4>
                <p class="caption-text">{{ currentMedia.caption || 'No caption' }}</p>
                <button @click="startEditCaption" class="btn-edit-small">Edit</button>
              </div>

              <div v-else class="caption-edit">
                <h4 class="info-label">Edit Caption</h4>
                <input
                  v-model="captionInput"
                  type="text"
                  placeholder="Enter caption..."
                  class="caption-input-small"
                  @keydown.enter="saveCaption"
                  @keydown.escape="cancelEditCaption"
                />
                <div class="caption-actions-small">
                  <button @click="cancelEditCaption" class="btn-cancel-small">Cancel</button>
                  <button @click="saveCaption" class="btn-save-small">Save</button>
                </div>
              </div>
            </div>

            <!-- Metadata -->
            <div class="info-section">
              <h4 class="info-label">Details</h4>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-key">Date:</span>
                  <span class="info-value">{{ formattedDate }}</span>
                </div>
                <div v-if="locationText" class="info-item">
                  <span class="info-key">Location:</span>
                  <span class="info-value">{{ locationText }}</span>
                </div>
                <div v-if="currentMedia.exifData?.camera" class="info-item">
                  <span class="info-key">Camera:</span>
                  <span class="info-value">{{ currentMedia.exifData.camera }}</span>
                </div>
                <div class="info-item">
                  <span class="info-key">Type:</span>
                  <span class="info-value">{{ currentMedia.type }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Comments overlay -->
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
.viewer-360-overlay {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 3000;
}

.viewer-360-container {
  width: 100%;
  height: 100%;
  position: relative;
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

.vr-badge {
  display: inline-flex;
  padding: 0.25rem 0.625rem;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
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
  white-space: nowrap;
}

.btn-toolbar:hover {
  background: rgba(0, 0, 0, 0.9);
  transform: translateY(-1px);
}

.btn-toolbar.active {
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
}

.btn-vr {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.btn-vr:hover {
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
}

.photo-sphere-container {
  width: 100%;
  height: 100%;
}

.video-360-player {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

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
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
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
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(15, 23, 42, 0.6);
  margin: 0 0 0.75rem;
}

.caption-display {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.caption-text {
  font-size: 0.875rem;
  color: #475569;
  margin: 0;
  line-height: 1.6;
}

.btn-edit-small {
  align-self: flex-start;
  padding: 0.375rem 0.75rem;
  background: rgba(15, 23, 42, 0.05);
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-edit-small:hover {
  background: rgba(15, 23, 42, 0.1);
}

.caption-edit {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.caption-input-small {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid rgba(15, 23, 42, 0.2);
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
}

.caption-input-small:focus {
  outline: none;
  border-color: #3b82f6;
}

.caption-actions-small {
  display: flex;
  gap: 0.5rem;
}

.btn-cancel-small,
.btn-save-small {
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel-small {
  background: rgba(15, 23, 42, 0.05);
  color: #64748b;
}

.btn-save-small {
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-item {
  display: flex;
  gap: 0.5rem;
}

.info-key {
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  min-width: 80px;
}

.info-value {
  font-size: 0.75rem;
  color: #1f2937;
  word-break: break-word;
}

.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.3s ease;
}

.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(100%);
}

@media (max-width: 768px) {
  .top-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .toolbar-title {
    max-width: 100%;
  }

  .toolbar-actions {
    flex-wrap: wrap;
  }

  .overlay-panel {
    width: 100%;
  }

  .btn-nav {
    width: 48px;
    height: 48px;
  }

  .btn-nav-prev {
    left: 0.5rem;
  }

  .btn-nav-next {
    right: 0.5rem;
  }
}
</style>
