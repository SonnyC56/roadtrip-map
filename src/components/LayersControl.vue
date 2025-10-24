<script setup lang="ts">
import { ref } from 'vue'
import { useRoadTripStore } from '../stores/roadtrip'

const store = useRoadTripStore()
const isExpanded = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const uploadError = ref<string | null>(null)

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
}

function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  uploadError.value = null

  const reader = new FileReader()
  reader.onload = async (e) => {
    try {
      const jsonData = JSON.parse(e.target?.result as string)
      await store.loadCustomData(jsonData)
      isExpanded.value = false // Close panel after successful upload
    } catch (error) {
      uploadError.value = error instanceof Error ? error.message : 'Failed to parse JSON file'
    }
  }
  reader.onerror = () => {
    uploadError.value = 'Failed to read file'
  }
  reader.readAsText(file)
}

function triggerFileInput() {
  fileInput.value?.click()
}

function loadDefaultData() {
  store.loadData()
  isExpanded.value = false
}
</script>

<template>
  <div class="layers-control">
    <!-- Toggle Button -->
    <button
      @click="toggleExpanded"
      class="layers-toggle-btn"
      :class="{ 'layers-toggle-active': isExpanded }"
      title="Layers & Data"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    </button>

    <!-- Control Panel -->
    <Transition name="panel-slide">
      <div v-if="isExpanded" class="layers-panel">
        <div class="panel-header">
          <h3 class="panel-title">Layers & Data</h3>
          <button @click="toggleExpanded" class="panel-close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="panel-body">
          <!-- Data Source Section -->
          <div class="section">
            <h4 class="section-title">Data Source</h4>
            <div class="data-source-info">
              <span class="data-badge" :class="store.dataSource === 'default' ? 'data-badge-default' : 'data-badge-custom'">
                {{ store.dataSource === 'default' ? '📍 Default Trip' : '📤 Custom Data' }}
              </span>
            </div>

            <div class="button-group">
              <button @click="triggerFileInput" class="action-button">
                📁 Upload JSON
              </button>
              <button
                v-if="store.dataSource === 'custom'"
                @click="loadDefaultData"
                class="action-button action-button-secondary"
              >
                ↩️ Load Default
              </button>
            </div>

            <input
              ref="fileInput"
              type="file"
              accept=".json"
              @change="handleFileUpload"
              class="file-input-hidden"
            />

            <div v-if="uploadError" class="error-message">
              {{ uploadError }}
            </div>
          </div>

          <!-- Layer Toggles Section -->
          <div class="section">
            <h4 class="section-title">Map Layers</h4>
            <div class="layer-toggles">
              <label class="layer-toggle">
                <input
                  type="checkbox"
                  v-model="store.layerVisibility.baselineRoute"
                />
                <span class="toggle-label">Baseline Route</span>
              </label>

              <label class="layer-toggle">
                <input
                  type="checkbox"
                  v-model="store.layerVisibility.routeSegments"
                />
                <span class="toggle-label">Route Segments</span>
              </label>

              <label class="layer-toggle">
                <input
                  type="checkbox"
                  v-model="store.layerVisibility.visitMarkers"
                />
                <span class="toggle-label">Visit Markers</span>
              </label>

              <label v-if="store.dataSource === 'default'" class="layer-toggle">
                <input
                  type="checkbox"
                  v-model="store.layerVisibility.destinationIcons"
                />
                <span class="toggle-label">Destination Icons</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.layers-control {
  position: fixed;
  top: 1.5rem;
  right: 1.5rem;
  z-index: 1000;
}

.layers-toggle-btn {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(15, 23, 42, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #1f2937;
}

.layers-toggle-btn:hover {
  background: white;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.layers-toggle-active {
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
}

.layers-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 320px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.1);
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
}

.panel-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
}

.panel-close {
  background: none;
  border: none;
  cursor: pointer;
  color: white;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s ease;
}

.panel-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.panel-body {
  padding: 1.25rem;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.section {
  margin-bottom: 1.5rem;
}

.section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(15, 23, 42, 0.6);
  margin: 0 0 0.75rem;
}

.data-source-info {
  margin-bottom: 0.75rem;
}

.data-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
}

.data-badge-default {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.data-badge-custom {
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
}

.button-group {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.action-button {
  flex: 1;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  border: none;
  font-size: 0.875rem;
  font-weight: 600;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.action-button-secondary {
  background: rgba(15, 23, 42, 0.08);
  color: #1f2937;
}

.action-button-secondary:hover {
  background: rgba(15, 23, 42, 0.12);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.file-input-hidden {
  display: none;
}

.error-message {
  margin-top: 0.5rem;
  padding: 0.625rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #dc2626;
  font-size: 0.75rem;
  font-weight: 500;
}

.layer-toggles {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.layer-toggle {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem;
  background: rgba(248, 250, 252, 0.5);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.layer-toggle:hover {
  background: rgba(248, 250, 252, 1);
}

.layer-toggle input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #3b82f6;
}

.toggle-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1f2937;
  user-select: none;
}

.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: all 0.3s ease;
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  opacity: 0;
  transform: translateX(20px) scale(0.95);
}

@media (max-width: 640px) {
  .layers-control {
    top: 1rem;
    right: 1rem;
  }

  .layers-toggle-btn {
    width: 44px;
    height: 44px;
  }

  .layers-panel {
    width: calc(100vw - 2rem);
    max-width: 320px;
  }
}
</style>
