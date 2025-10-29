<script setup lang="ts">
import { ref } from 'vue'
import { useRoadTripStore, type MediaItem } from '../stores/roadtrip'

const emit = defineEmits<{
  close: []
  imported: [count: number]
}>()

const store = useRoadTripStore()
const fileInput = ref<HTMLInputElement | null>(null)
const parseError = ref<string | null>(null)
const previewData = ref<Omit<MediaItem, 'id' | 'segmentIndex'>[] | null>(null)
const isImporting = ref(false)

interface BulkImportJSON {
  media: Omit<MediaItem, 'id' | 'segmentIndex'>[]
}

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  parseError.value = null
  previewData.value = null

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const jsonData = JSON.parse(e.target?.result as string) as BulkImportJSON

      // Validate structure
      if (!jsonData.media || !Array.isArray(jsonData.media)) {
        throw new Error('Invalid JSON structure: missing "media" array')
      }

      // Validate each media item
      jsonData.media.forEach((item, index) => {
        if (!item.url) throw new Error(`Media item ${index}: missing "url"`)
        if (!item.type) throw new Error(`Media item ${index}: missing "type"`)
        if (!['photo', 'video', '360-photo', '360-video'].includes(item.type)) {
          throw new Error(`Media item ${index}: invalid type "${item.type}"`)
        }
        if (!item.timestamp) throw new Error(`Media item ${index}: missing "timestamp"`)
      })

      previewData.value = jsonData.media
    } catch (error) {
      parseError.value = error instanceof Error ? error.message : 'Failed to parse JSON file'
      previewData.value = null
    }
  }
  reader.onerror = () => {
    parseError.value = 'Failed to read file'
  }
  reader.readAsText(file)
}

function getMediaBreakdown() {
  if (!previewData.value) return null

  const breakdown = {
    photo: 0,
    video: 0,
    '360-photo': 0,
    '360-video': 0
  }

  previewData.value.forEach(item => {
    breakdown[item.type]++
  })

  return breakdown
}

async function importMedia() {
  if (!previewData.value) return

  isImporting.value = true

  try {
    const count = await store.addMediaBulk(previewData.value)
    emit('imported', count)
    emit('close')
  } catch (error) {
    parseError.value = error instanceof Error ? error.message : 'Failed to import media'
  } finally {
    isImporting.value = false
  }
}

function close() {
  emit('close')
}
</script>

<template>
  <div class="bulk-import-overlay" @click.self="close">
    <div class="bulk-import-modal">
      <div class="modal-header">
        <h3 class="modal-title">Bulk Import Media</h3>
        <button @click="close" class="btn-close">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- File Upload -->
        <div v-if="!previewData" class="upload-section">
          <p class="instructions">
            Upload a JSON file containing your media metadata. The file should have the following structure:
          </p>

          <pre class="json-example">{
  "media": [
    {
      "url": "https://storage.googleapis.com/.../photo.jpg",
      "thumbnail": "https://storage.googleapis.com/.../thumb.jpg",
      "type": "photo",
      "timestamp": "2025-08-12T14:30:00Z",
      "location": {
        "lat": 34.0522,
        "lng": -118.2437,
        "isInferred": false
      },
      "caption": "Optional caption",
      "exifData": {
        "camera": "iPhone 14 Pro"
      }
    }
  ]
}</pre>

          <button @click="triggerFileInput" class="btn-upload">
            📁 Select JSON File
          </button>

          <input
            ref="fileInput"
            type="file"
            accept=".json"
            @change="handleFileUpload"
            class="file-input-hidden"
          />

          <div v-if="parseError" class="error-message">
            {{ parseError }}
          </div>
        </div>

        <!-- Preview -->
        <div v-else class="preview-section">
          <div class="preview-header">
            <h4 class="preview-title">Preview Import</h4>
            <button @click="previewData = null" class="btn-change-file">
              Change File
            </button>
          </div>

          <div class="preview-stats">
            <div class="stat-item">
              <span class="stat-label">Total Media:</span>
              <span class="stat-value">{{ previewData.length }}</span>
            </div>

            <div v-if="getMediaBreakdown()" class="breakdown">
              <div v-if="getMediaBreakdown()!.photo > 0" class="breakdown-item">
                <span class="breakdown-icon">📷</span>
                <span class="breakdown-label">Photos:</span>
                <span class="breakdown-value">{{ getMediaBreakdown()!.photo }}</span>
              </div>
              <div v-if="getMediaBreakdown()!['360-photo'] > 0" class="breakdown-item">
                <span class="breakdown-icon">🌐</span>
                <span class="breakdown-label">360° Photos:</span>
                <span class="breakdown-value">{{ getMediaBreakdown()!['360-photo'] }}</span>
              </div>
              <div v-if="getMediaBreakdown()!.video > 0" class="breakdown-item">
                <span class="breakdown-icon">🎥</span>
                <span class="breakdown-label">Videos:</span>
                <span class="breakdown-value">{{ getMediaBreakdown()!.video }}</span>
              </div>
              <div v-if="getMediaBreakdown()!['360-video'] > 0" class="breakdown-item">
                <span class="breakdown-icon">🎬</span>
                <span class="breakdown-label">360° Videos:</span>
                <span class="breakdown-value">{{ getMediaBreakdown()!['360-video'] }}</span>
              </div>
            </div>
          </div>

          <div class="preview-list">
            <div class="preview-list-header">
              Media Items (showing first 10)
            </div>
            <div
              v-for="(item, index) in previewData.slice(0, 10)"
              :key="index"
              class="preview-item"
            >
              <span class="preview-type">{{ item.type }}</span>
              <span class="preview-caption">{{ item.caption || 'No caption' }}</span>
              <span class="preview-timestamp">{{ new Date(item.timestamp).toLocaleDateString() }}</span>
            </div>
            <div v-if="previewData.length > 10" class="preview-more">
              + {{ previewData.length - 10 }} more items
            </div>
          </div>

          <button
            @click="importMedia"
            class="btn-import"
            :disabled="isImporting"
          >
            {{ isImporting ? 'Importing...' : `Import ${previewData.length} Media Items` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bulk-import-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
}

.bulk-import-modal {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 700px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.1);
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  cursor: pointer;
  color: white;
  padding: 0.25rem;
  border-radius: 6px;
  transition: background 0.2s;
}

.btn-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.upload-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.instructions {
  font-size: 0.875rem;
  color: #475569;
  line-height: 1.6;
  margin: 0;
}

.json-example {
  background: #1e293b;
  color: #e2e8f0;
  padding: 1rem;
  border-radius: 8px;
  font-size: 0.75rem;
  overflow-x: auto;
  margin: 0;
}

.btn-upload {
  padding: 0.875rem 1.5rem;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-upload:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

.file-input-hidden {
  display: none;
}

.error-message {
  padding: 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #dc2626;
  font-size: 0.875rem;
  font-weight: 500;
}

.preview-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-title {
  font-size: 1rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.btn-change-file {
  padding: 0.5rem 1rem;
  background: rgba(15, 23, 42, 0.08);
  color: #1f2937;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-change-file:hover {
  background: rgba(15, 23, 42, 0.12);
}

.preview-stats {
  background: rgba(248, 250, 252, 0.8);
  padding: 1rem;
  border-radius: 8px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 600;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
}

.breakdown {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
}

.breakdown-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.breakdown-icon {
  font-size: 1.25rem;
}

.breakdown-label {
  color: #64748b;
  font-weight: 500;
}

.breakdown-value {
  color: #1f2937;
  font-weight: 700;
  margin-left: auto;
}

.preview-list {
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.preview-list-header {
  background: rgba(248, 250, 252, 0.8);
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(15, 23, 42, 0.6);
}

.preview-item {
  display: flex;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid rgba(15, 23, 42, 0.05);
  align-items: center;
}

.preview-type {
  display: inline-block;
  padding: 0.25rem 0.625rem;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  border-radius: 4px;
  white-space: nowrap;
}

.preview-caption {
  flex: 1;
  font-size: 0.875rem;
  color: #475569;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-timestamp {
  font-size: 0.75rem;
  color: #94a3b8;
  white-space: nowrap;
}

.preview-more {
  padding: 0.75rem 1rem;
  text-align: center;
  font-size: 0.875rem;
  color: #64748b;
  background: rgba(248, 250, 252, 0.5);
  border-top: 1px solid rgba(15, 23, 42, 0.05);
}

.btn-import {
  width: 100%;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-import:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
}

.btn-import:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .bulk-import-modal {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }

  .modal-header,
  .modal-body {
    padding: 1rem;
  }

  .json-example {
    font-size: 0.625rem;
  }

  .breakdown {
    grid-template-columns: 1fr;
  }
}
</style>
