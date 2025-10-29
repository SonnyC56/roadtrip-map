<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoadTripStore } from '../stores/roadtrip'
import { storageService } from '../services/storage'
import BulkMediaImport from './BulkMediaImport.vue'
import AddMediaForm from './AddMediaForm.vue'

const store = useRoadTripStore()
const isExpanded = ref(false)
const showBulkMediaImport = ref(false)
const showAddMediaForm = ref(false)

const totalMediaCount = computed(() => store.allMedia.length)

// Storage testing
const testStatus = ref<string | null>(null)
const isTesting = ref(false)

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
}

function openBulkMediaImport() {
  showBulkMediaImport.value = true
}

function closeBulkMediaImport() {
  showBulkMediaImport.value = false
}

function handleMediaImported(count: number) {
  console.log(`Imported ${count} media items`)
  showBulkMediaImport.value = false
}

function openAddMediaForm() {
  showAddMediaForm.value = true
}

function closeAddMediaForm() {
  showAddMediaForm.value = false
}

function handleMediaAdded() {
  console.log('Media added successfully')
  showAddMediaForm.value = false
}

async function testStorageConnection() {
  isTesting.value = true
  testStatus.value = 'Testing connection...'

  try {
    const result = await storageService.testConnection()
    testStatus.value = result.success ? `✓ ${result.message}` : `✗ ${result.message}`
  } catch (error) {
    testStatus.value = `✗ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  } finally {
    isTesting.value = false
  }
}
</script>

<template>
  <div class="settings-control">
    <!-- Settings Button -->
    <button
      @click="toggleExpanded"
      class="settings-toggle-btn"
      :class="{ 'settings-toggle-active': isExpanded }"
      title="Settings"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v6m0 6v6m8.66-10l-5.2 3m-2.92 1.68l-5.2 3M20.66 19l-5.2-3m-2.92-1.68l-5.2-3"/>
      </svg>
    </button>

    <!-- Settings Panel -->
    <Transition name="panel-slide">
      <div v-if="isExpanded" class="settings-panel">
        <div class="panel-header">
          <h3 class="panel-title">Settings</h3>
          <button @click="toggleExpanded" class="panel-close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="panel-body">
          <!-- Media Management Section -->
          <div class="section">
            <h4 class="section-title">Media Management</h4>

            <div class="media-info">
              <div class="info-card">
                <span class="info-icon">📸</span>
                <div class="info-text">
                  <span class="info-label">Total Media</span>
                  <span class="info-value">{{ totalMediaCount }}</span>
                </div>
              </div>
            </div>

            <div class="button-group">
              <button @click="openAddMediaForm" class="action-button">
                ➕ Add Media
              </button>
              <button @click="openBulkMediaImport" class="action-button action-button-secondary">
                📥 Bulk Import
              </button>
            </div>

            <div class="help-text">
              Upload photos and videos to display them on your trip timeline and map.
            </div>
          </div>

          <!-- Storage Configuration Section -->
          <div class="section">
            <h4 class="section-title">Cloud Storage</h4>

            <div class="info-card">
              <span class="info-icon">☁️</span>
              <div class="info-text">
                <span class="info-label">Provider</span>
                <span class="info-value-small">Firebase Storage</span>
              </div>
            </div>

            <button
              @click="testStorageConnection"
              class="action-button action-button-secondary"
              style="width: 100%; margin-top: 0.75rem;"
              :disabled="isTesting"
            >
              {{ isTesting ? '⏳ Testing Connection...' : '🧪 Test Connection' }}
            </button>

            <div v-if="testStatus" class="test-status" :class="{ 'test-success': testStatus.startsWith('✓'), 'test-error': testStatus.startsWith('✗') }" style="margin-top: 0.75rem;">
              {{ testStatus }}
            </div>

            <div class="help-text" style="margin-top: 0.75rem;">
              Media is stored in Firebase Storage. Configure via .env.local file (see FIREBASE_SETUP.md).
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Media Modals -->
    <BulkMediaImport
      v-if="showBulkMediaImport"
      @close="closeBulkMediaImport"
      @imported="handleMediaImported"
    />

    <AddMediaForm
      v-if="showAddMediaForm"
      @close="closeAddMediaForm"
      @added="handleMediaAdded"
    />
  </div>
</template>

<style scoped>
.settings-control {
  position: fixed;
  top: 1.5rem;
  right: 5.5rem;
  z-index: 1000;
}

.settings-toggle-btn {
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

.settings-toggle-btn:hover {
  background: white;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.settings-toggle-active {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
}

.settings-panel {
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
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
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

.media-info {
  margin-bottom: 0.75rem;
}

.info-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(248, 250, 252, 0.5);
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.05);
}

.info-icon {
  font-size: 1.5rem;
}

.info-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.info-label {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(15, 23, 42, 0.5);
}

.info-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
}

.button-group {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.action-button {
  flex: 1;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  border: none;
  font-size: 0.875rem;
  font-weight: 600;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.action-button-secondary {
  background: rgba(15, 23, 42, 0.08);
  color: #1f2937;
}

.action-button-secondary:hover {
  background: rgba(15, 23, 42, 0.12);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.help-text {
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.5;
}

.info-value-small {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
}

.storage-config-form {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(248, 250, 252, 0.5);
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.05);
}

.form-group-small {
  margin-bottom: 0.75rem;
}

.form-label-tiny {
  display: block;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(15, 23, 42, 0.6);
  margin-bottom: 0.375rem;
}

.form-input-tiny,
.form-select-small {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid rgba(15, 23, 42, 0.2);
  border-radius: 6px;
  font-size: 0.75rem;
  font-family: inherit;
  color: #000000;
  background: white;
}

.form-input-tiny:focus,
.form-select-small:focus {
  outline: none;
  border-color: #f59e0b;
}

.help-text-tiny {
  font-size: 0.625rem;
  color: #94a3b8;
  margin-top: 0.25rem;
  line-height: 1.4;
}

.action-button-small {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  border: none;
  font-size: 0.75rem;
  font-weight: 600;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button-small:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.action-button-small:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-button-small.action-button-secondary {
  background: rgba(15, 23, 42, 0.08);
  color: #1f2937;
}

.action-button-small.action-button-secondary:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.12);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.test-status {
  margin-top: 0.75rem;
  padding: 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
}

.test-success {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.test-error {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.2);
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
  .settings-control {
    top: 1rem;
    right: 4.5rem;
  }

  .settings-toggle-btn {
    width: 44px;
    height: 44px;
  }

  .settings-panel {
    width: calc(100vw - 2rem);
    max-width: 320px;
  }
}
</style>
