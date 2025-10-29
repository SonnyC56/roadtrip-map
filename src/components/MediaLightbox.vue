<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoadTripStore, type MediaItem } from '../stores/roadtrip'
import { format } from 'date-fns'
import MediaComments from './MediaComments.vue'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../config/firebase'

const props = withDefaults(defineProps<{
  mediaItem: MediaItem
  allMedia: MediaItem[]
  currentIndex: number
  canEdit?: boolean
}>(), {
  canEdit: false
})

const emit = defineEmits<{
  close: []
  next: []
  previous: []
  open360: [mediaItem: MediaItem]
}>()

const store = useRoadTripStore()
const videoRef = ref<HTMLVideoElement | null>(null)
const editingCaption = ref(false)
const captionInput = ref('')
const editingMetadata = ref(false)
const metadataInputs = ref({
  timestamp: '',
  lat: null as number | null,
  lng: null as number | null,
  camera: '',
  focalLength: '',
  iso: '',
  exposureTime: ''
})

const currentMedia = computed(() => props.mediaItem)
const isVideo = computed(() => currentMedia.value.type === 'video')
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

// Handle keyboard navigation
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close()
  } else if (e.key === 'ArrowRight' && canGoNext.value) {
    next()
  } else if (e.key === 'ArrowLeft' && canGoPrevious.value) {
    previous()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// Stop video when switching
watch(() => props.mediaItem.id, () => {
  if (videoRef.value) {
    videoRef.value.pause()
    videoRef.value.currentTime = 0
  }
  editingCaption.value = false
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

function startEditCaption() {
  captionInput.value = currentMedia.value.caption || ''
  editingCaption.value = true
}

async function saveCaption() {
  const newCaption = captionInput.value.trim()

  // Update caption in allMedia array
  const media = store.allMedia.find(m => m.id === currentMedia.value.id)
  if (media) {
    media.caption = newCaption
  }

  // Update caption in loadedMediaDetails cache
  const cachedMedia = store.loadedMediaDetails.get(currentMedia.value.id)
  if (cachedMedia) {
    cachedMedia.caption = newCaption
  }

  // Update the current media item (triggers reactivity)
  currentMedia.value.caption = newCaption

  // Save to Firestore
  try {
    const mediaRef = doc(db, 'media', currentMedia.value.id)
    await updateDoc(mediaRef, {
      caption: newCaption
    })
    console.log('Caption saved to Firestore')
  } catch (error) {
    console.error('Failed to save caption to Firestore:', error)
    alert('Failed to save caption. Check console for details.')
  }

  editingCaption.value = false
}

function cancelEditCaption() {
  editingCaption.value = false
}

function startEditMetadata() {
  // Populate metadata inputs with current values
  const dateObj = new Date(currentMedia.value.timestamp)
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  const hours = String(dateObj.getHours()).padStart(2, '0')
  const minutes = String(dateObj.getMinutes()).padStart(2, '0')
  metadataInputs.value.timestamp = `${year}-${month}-${day}T${hours}:${minutes}`

  metadataInputs.value.lat = currentMedia.value.location?.lat || null
  metadataInputs.value.lng = currentMedia.value.location?.lng || null
  metadataInputs.value.camera = currentMedia.value.exifData?.camera || ''
  metadataInputs.value.focalLength = currentMedia.value.exifData?.focalLength || ''
  metadataInputs.value.iso = currentMedia.value.exifData?.iso || ''
  metadataInputs.value.exposureTime = currentMedia.value.exifData?.exposureTime || ''

  editingMetadata.value = true
}

async function saveMetadata() {
  // Update metadata in allMedia array
  const media = store.allMedia.find(m => m.id === currentMedia.value.id)
  if (media) {
    media.timestamp = new Date(metadataInputs.value.timestamp).toISOString()
    if (metadataInputs.value.lat !== null && metadataInputs.value.lng !== null) {
      media.location = {
        lat: metadataInputs.value.lat,
        lng: metadataInputs.value.lng,
        isInferred: false
      }
    }
    if (!media.exifData) {
      media.exifData = {}
    }
    if (metadataInputs.value.camera) media.exifData.camera = metadataInputs.value.camera
    if (metadataInputs.value.focalLength) media.exifData.focalLength = metadataInputs.value.focalLength
    if (metadataInputs.value.iso) media.exifData.iso = metadataInputs.value.iso
    if (metadataInputs.value.exposureTime) media.exifData.exposureTime = metadataInputs.value.exposureTime
  }

  // Update metadata in loadedMediaDetails cache
  const cachedMedia = store.loadedMediaDetails.get(currentMedia.value.id)
  if (cachedMedia) {
    cachedMedia.timestamp = new Date(metadataInputs.value.timestamp).toISOString()
    if (metadataInputs.value.lat !== null && metadataInputs.value.lng !== null) {
      cachedMedia.location = {
        lat: metadataInputs.value.lat,
        lng: metadataInputs.value.lng,
        isInferred: false
      }
    }
    if (!cachedMedia.exifData) {
      cachedMedia.exifData = {}
    }
    if (metadataInputs.value.camera) cachedMedia.exifData.camera = metadataInputs.value.camera
    if (metadataInputs.value.focalLength) cachedMedia.exifData.focalLength = metadataInputs.value.focalLength
    if (metadataInputs.value.iso) cachedMedia.exifData.iso = metadataInputs.value.iso
    if (metadataInputs.value.exposureTime) cachedMedia.exifData.exposureTime = metadataInputs.value.exposureTime
  }

  // Update the current media item (triggers reactivity)
  currentMedia.value.timestamp = new Date(metadataInputs.value.timestamp).toISOString()
  if (metadataInputs.value.lat !== null && metadataInputs.value.lng !== null) {
    currentMedia.value.location = {
      lat: metadataInputs.value.lat,
      lng: metadataInputs.value.lng,
      isInferred: false
    }
  }
  if (!currentMedia.value.exifData) {
    currentMedia.value.exifData = {}
  }
  if (metadataInputs.value.camera) currentMedia.value.exifData.camera = metadataInputs.value.camera
  if (metadataInputs.value.focalLength) currentMedia.value.exifData.focalLength = metadataInputs.value.focalLength
  if (metadataInputs.value.iso) currentMedia.value.exifData.iso = metadataInputs.value.iso
  if (metadataInputs.value.exposureTime) currentMedia.value.exifData.exposureTime = metadataInputs.value.exposureTime

  // Save to Firestore
  try {
    const mediaRef = doc(db, 'media', currentMedia.value.id)
    const updateData: any = {
      timestamp: new Date(metadataInputs.value.timestamp).toISOString()
    }

    if (metadataInputs.value.lat !== null && metadataInputs.value.lng !== null) {
      updateData.location = {
        lat: metadataInputs.value.lat,
        lng: metadataInputs.value.lng,
        isInferred: false
      }
    }

    const exifData: any = {}
    if (metadataInputs.value.camera) exifData.camera = metadataInputs.value.camera
    if (metadataInputs.value.focalLength) exifData.focalLength = metadataInputs.value.focalLength
    if (metadataInputs.value.iso) exifData.iso = metadataInputs.value.iso
    if (metadataInputs.value.exposureTime) exifData.exposureTime = metadataInputs.value.exposureTime

    if (Object.keys(exifData).length > 0) {
      updateData.exifData = exifData
    }

    await updateDoc(mediaRef, updateData)
    console.log('Metadata saved to Firestore')
  } catch (error) {
    console.error('Failed to save metadata to Firestore:', error)
    alert('Failed to save metadata. Check console for details.')
  }

  editingMetadata.value = false
}

function cancelEditMetadata() {
  editingMetadata.value = false
}
</script>

<template>
  <div class="lightbox-overlay" @click.self="close">
    <div class="lightbox-container">
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

      <!-- Media content -->
      <div class="media-content">
        <!-- Video -->
        <video
          v-if="isVideo"
          ref="videoRef"
          :src="currentMedia.url"
          controls
          class="media-video"
        />

        <!-- Photo -->
        <img
          v-else
          :src="currentMedia.url"
          :alt="currentMedia.caption || 'Media'"
          class="media-image"
        />
      </div>

      <!-- Sidebar -->
      <div class="media-sidebar">
        <div class="sidebar-content">
          <!-- Caption -->
          <div class="caption-section">
            <div v-if="!editingCaption" class="caption-display">
              <h3 class="caption-title">
                {{ currentMedia.caption || 'No caption' }}
              </h3>
              <button v-if="canEdit" @click="startEditCaption" class="btn-edit-caption">
                Edit Caption
              </button>
            </div>

            <div v-else class="caption-edit">
              <input
                v-model="captionInput"
                type="text"
                placeholder="Enter caption..."
                class="caption-input"
                @keydown.enter="saveCaption"
                @keydown.escape="cancelEditCaption"
              />
              <div class="caption-actions">
                <button @click="cancelEditCaption" class="btn-cancel">Cancel</button>
                <button @click="saveCaption" class="btn-save">Save</button>
              </div>
            </div>
          </div>

          <!-- Metadata -->
          <div class="metadata-section">
            <div v-if="!editingMetadata" class="metadata-display">
              <div class="metadata-item">
                <span class="metadata-label">Date:</span>
                <span class="metadata-value">{{ formattedDate }}</span>
              </div>

              <div v-if="locationText" class="metadata-item">
                <span class="metadata-label">Location:</span>
                <span class="metadata-value">{{ locationText }}</span>
              </div>

              <div v-if="currentMedia.exifData?.camera" class="metadata-item">
                <span class="metadata-label">Camera:</span>
                <span class="metadata-value">{{ currentMedia.exifData.camera }}</span>
              </div>

              <div v-if="currentMedia.exifData?.focalLength" class="metadata-item">
                <span class="metadata-label">Focal Length:</span>
                <span class="metadata-value">{{ currentMedia.exifData.focalLength }}</span>
              </div>

              <div v-if="currentMedia.exifData?.iso" class="metadata-item">
                <span class="metadata-label">ISO:</span>
                <span class="metadata-value">{{ currentMedia.exifData.iso }}</span>
              </div>

              <div v-if="currentMedia.exifData?.exposureTime" class="metadata-item">
                <span class="metadata-label">Exposure:</span>
                <span class="metadata-value">{{ currentMedia.exifData.exposureTime }}</span>
              </div>

              <div class="metadata-item">
                <span class="metadata-label">Type:</span>
                <span class="metadata-value">{{ currentMedia.type }}</span>
              </div>

              <button v-if="canEdit" @click="startEditMetadata" class="btn-edit-metadata">
                Edit Metadata
              </button>
            </div>

            <div v-else class="metadata-edit">
              <div class="metadata-edit-form">
                <div class="form-group">
                  <label class="form-label">Date & Time</label>
                  <input
                    v-model="metadataInputs.timestamp"
                    type="datetime-local"
                    class="form-input"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">Location</label>
                  <div class="location-inputs">
                    <input
                      v-model.number="metadataInputs.lat"
                      type="number"
                      step="any"
                      placeholder="Latitude"
                      class="form-input"
                    />
                    <input
                      v-model.number="metadataInputs.lng"
                      type="number"
                      step="any"
                      placeholder="Longitude"
                      class="form-input"
                    />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Camera</label>
                  <input
                    v-model="metadataInputs.camera"
                    type="text"
                    placeholder="e.g., iPhone 14 Pro"
                    class="form-input"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">Focal Length</label>
                  <input
                    v-model="metadataInputs.focalLength"
                    type="text"
                    placeholder="e.g., 24mm"
                    class="form-input"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">ISO</label>
                  <input
                    v-model="metadataInputs.iso"
                    type="text"
                    placeholder="e.g., 100"
                    class="form-input"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">Exposure Time</label>
                  <input
                    v-model="metadataInputs.exposureTime"
                    type="text"
                    placeholder="e.g., 1/250"
                    class="form-input"
                  />
                </div>
              </div>

              <div class="metadata-actions">
                <button @click="cancelEditMetadata" class="btn-cancel">Cancel</button>
                <button @click="saveMetadata" class="btn-save">Save</button>
              </div>
            </div>
          </div>

          <!-- Comments -->
          <MediaComments :media-id="currentMedia.id" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lightbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.95);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lightbox-container {
  width: 100%;
  height: 100%;
  display: flex;
  position: relative;
}

.btn-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 10;
  background: rgba(0, 0, 0, 0.5);
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
  background: rgba(0, 0, 0, 0.7);
  transform: scale(1.1);
}

.btn-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  background: rgba(0, 0, 0, 0.5);
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
  background: rgba(0, 0, 0, 0.7);
  transform: translateY(-50%) scale(1.1);
}

.btn-nav-prev {
  left: 1rem;
}

.btn-nav-next {
  left: calc(100% - 480px - 5rem);
}

.media-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  overflow: hidden;
}

.media-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
}

.media-video {
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
}

.media-sidebar {
  width: 480px;
  background: white;
  overflow-y: auto;
  flex-shrink: 0;
}

.sidebar-content {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.caption-section {
  border-bottom: 1px solid rgba(15, 23, 42, 0.1);
  padding-bottom: 1.5rem;
}

.caption-display {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.caption-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
  word-break: break-word;
}

.btn-edit-caption {
  align-self: flex-start;
  padding: 0.5rem 1rem;
  background: rgba(15, 23, 42, 0.05);
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-edit-caption:hover {
  background: rgba(15, 23, 42, 0.1);
}

.caption-edit {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.caption-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid rgba(15, 23, 42, 0.1);
  border-radius: 6px;
  font-size: 1rem;
  font-family: inherit;
  font-weight: 600;
}

.caption-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.caption-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.btn-cancel,
.btn-save {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: rgba(15, 23, 42, 0.05);
  color: #64748b;
}

.btn-cancel:hover {
  background: rgba(15, 23, 42, 0.1);
}

.btn-save {
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
}

.btn-save:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.metadata-section {
  border-bottom: 1px solid rgba(15, 23, 42, 0.1);
  padding-bottom: 1.5rem;
}

.metadata-display {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.metadata-item {
  display: flex;
  gap: 0.75rem;
}

.metadata-label {
  font-size: 0.875rem;
  font-weight: 700;
  color: #64748b;
  min-width: 100px;
}

.metadata-value {
  font-size: 0.875rem;
  color: #1f2937;
  word-break: break-word;
}

.btn-edit-metadata {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(15, 23, 42, 0.05);
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
  align-self: flex-start;
}

.btn-edit-metadata:hover {
  background: rgba(15, 23, 42, 0.1);
}

.metadata-edit {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.metadata-edit-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-input {
  padding: 0.5rem;
  border: 2px solid rgba(15, 23, 42, 0.1);
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.location-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.metadata-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

@media (max-width: 1024px) {
  .media-sidebar {
    width: 400px;
  }

  .btn-nav-next {
    left: calc(100% - 400px - 5rem);
  }
}

@media (max-width: 768px) {
  .lightbox-container {
    flex-direction: column;
  }

  .media-content {
    flex: 1;
    padding: 4rem 1rem 1rem;
  }

  .media-sidebar {
    width: 100%;
    max-height: 50vh;
  }

  .sidebar-content {
    padding: 1.5rem;
  }

  .btn-nav {
    width: 48px;
    height: 48px;
  }

  .btn-nav-prev {
    left: 0.5rem;
  }

  .btn-nav-next {
    left: auto;
    right: 0.5rem;
  }
}
</style>
