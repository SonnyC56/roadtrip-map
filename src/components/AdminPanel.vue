<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useRoadTripStore } from '../stores/roadtrip'
import { storageService } from '../services/storage'
import AdminLogin from './AdminLogin.vue'
import AddMediaForm from './AddMediaForm.vue'
import MediaLightbox from './MediaLightbox.vue'
import type { MediaItem } from '../stores/roadtrip'

const { currentUser, isAuthenticated, isLoading, signOut } = useAuth()
const store = useRoadTripStore()

const isExpanded = ref(false)
const showAddMediaForm = ref(false)
const activeTab = ref<'overview' | 'media' | 'storage'>('overview')
const deletingMediaId = ref<string | null>(null)
const showMediaLightbox = ref(false)
const currentMediaItem = ref<MediaItem | null>(null)
const currentMediaIndex = ref(0)

const totalMediaCount = computed(() => store.allMediaMarkers.length)
const totalSegments = computed(() => store.segments.length)

const allMediaWithLocations = computed(() => {
  return store.allMediaMarkers.map(marker => {
    const segment = store.segments[marker.segmentIndex]
    const segmentDate = segment ? new Date(segment.startTime).toLocaleDateString() : 'Unknown'
    const segmentType = segment?.visit ? 'Visit' : segment?.activity ? 'Activity' : 'Segment'

    // Get cached full details if available, otherwise create minimal MediaItem from marker
    const cachedDetails = store.loadedMediaDetails.get(marker.id)
    const mediaItem = cachedDetails || {
      ...marker,
      url: marker.thumbnail || '',
      caption: undefined,
      exifData: undefined,
      comments: undefined
    }

    return {
      ...mediaItem,
      segmentType,
      segmentDate,
      segmentIndex: marker.segmentIndex
    }
  })
})

function togglePanel() {
  isExpanded.value = !isExpanded.value
}

function closePanel() {
  isExpanded.value = false
}

async function handleSignOut() {
  const result = await signOut()
  if (result.success) {
    closePanel()
  }
}

function openAddMediaForm() {
  showAddMediaForm.value = true
}

function closeAddMediaForm() {
  showAddMediaForm.value = false
}

function handleMediaAdded() {
  showAddMediaForm.value = false
}

function openMediaLightbox(media: MediaItem, index: number) {
  currentMediaItem.value = media
  currentMediaIndex.value = index
  showMediaLightbox.value = true
}

function closeMediaLightbox() {
  showMediaLightbox.value = false
}

function nextMedia() {
  if (currentMediaIndex.value < allMediaWithLocations.value.length - 1) {
    currentMediaIndex.value++
    const nextItem = allMediaWithLocations.value[currentMediaIndex.value]
    if (nextItem) {
      currentMediaItem.value = nextItem
    }
  }
}

function previousMedia() {
  if (currentMediaIndex.value > 0) {
    currentMediaIndex.value--
    const prevItem = allMediaWithLocations.value[currentMediaIndex.value]
    if (prevItem) {
      currentMediaItem.value = prevItem
    }
  }
}

async function deleteMedia(mediaId: string, mediaUrl: string) {
  if (!confirm('Are you sure you want to delete this media? This cannot be undone.')) {
    return
  }

  deletingMediaId.value = mediaId

  try {
    // Delete from Firebase Storage
    await storageService.deleteFile(mediaUrl)

    // Remove from store
    store.removeMedia(mediaId)

    console.log('Media deleted successfully')
  } catch (error) {
    console.error('Failed to delete media:', error)
    alert('Failed to delete media. Check console for details.')
  } finally {
    deletingMediaId.value = null
  }
}
</script>

<template>
  <!-- Admin Panel Button (always show) -->
  <div class="admin-panel-container">
    <button
      @click="togglePanel"
      class="admin-toggle-btn"
      :class="{ 'admin-toggle-active': isExpanded }"
      title="Admin Panel"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </button>

    <!-- Show login modal if not authenticated and panel is opened -->
    <AdminLogin v-if="!isLoading && !isAuthenticated && isExpanded" @close="closePanel" />

    <!-- Admin Panel (only show when authenticated) -->
    <Transition name="panel-slide">
      <div v-if="isExpanded && isAuthenticated" class="admin-panel">
        <div class="panel-header">
          <h3 class="panel-title">Admin Panel</h3>
          <button @click="closePanel" class="panel-close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="panel-tabs">
          <button
            @click="activeTab = 'overview'"
            class="tab-button"
            :class="{ 'tab-active': activeTab === 'overview' }"
          >
            Overview
          </button>
          <button
            @click="activeTab = 'media'"
            class="tab-button"
            :class="{ 'tab-active': activeTab === 'media' }"
          >
            Media
          </button>
          <button
            @click="activeTab = 'storage'"
            class="tab-button"
            :class="{ 'tab-active': activeTab === 'storage' }"
          >
            Storage
          </button>
        </div>

        <div class="panel-body">
          <!-- Overview Tab -->
          <div v-if="activeTab === 'overview'" class="tab-content">
            <div class="section">
              <h4 class="section-title">Statistics</h4>

              <div class="stats-grid">
                <div class="stat-card">
                  <span class="stat-icon">📍</span>
                  <div class="stat-info">
                    <span class="stat-label">Segments</span>
                    <span class="stat-value">{{ totalSegments }}</span>
                  </div>
                </div>

                <div class="stat-card">
                  <span class="stat-icon">📸</span>
                  <div class="stat-info">
                    <span class="stat-label">Media</span>
                    <span class="stat-value">{{ totalMediaCount }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="section">
              <h4 class="section-title">Quick Actions</h4>

              <div class="button-group-vertical">
                <button @click="openAddMediaForm" class="action-button">
                  ➕ Add Media
                </button>
              </div>
            </div>

            <div class="section">
              <h4 class="section-title">Account</h4>

              <div class="info-card">
                <span class="info-icon">👤</span>
                <div class="info-text">
                  <span class="info-label">Signed in as</span>
                  <span class="info-value-small">{{ currentUser?.email }}</span>
                </div>
              </div>

              <button @click="handleSignOut" class="action-button action-button-danger" style="width: 100%; margin-top: 0.75rem;">
                🚪 Sign Out
              </button>
            </div>
          </div>

          <!-- Media Tab -->
          <div v-if="activeTab === 'media'" class="tab-content">
            <div class="section">
              <div class="section-header">
                <h4 class="section-title">All Media ({{ totalMediaCount }})</h4>
                <button @click="openAddMediaForm" class="icon-button" title="Add Media">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
              </div>

              <div v-if="allMediaWithLocations.length === 0" class="empty-state">
                <p>No media uploaded yet</p>
                <button @click="openAddMediaForm" class="action-button" style="margin-top: 1rem;">
                  ➕ Add Your First Media
                </button>
              </div>

              <div v-else class="media-list">
                <div
                  v-for="(media, index) in allMediaWithLocations"
                  :key="media.id"
                  class="media-item"
                >
                  <div
                    class="media-thumbnail-wrapper"
                    @click="openMediaLightbox(media, index)"
                  >
                    <img
                      v-if="media.type === 'photo' || media.type === '360-photo'"
                      :src="media.thumbnail || media.url"
                      :alt="media.caption || 'Media'"
                      class="media-thumbnail"
                    />
                    <video
                      v-else
                      :src="media.url"
                      class="media-thumbnail"
                      muted
                    ></video>
                  </div>

                  <div class="media-info" @click="openMediaLightbox(media, index)">
                    <div class="media-title">{{ media.caption || 'Untitled' }}</div>
                    <div class="media-meta">
                      <span>{{ media.segmentType }} #{{ media.segmentIndex }}</span>
                      <span class="meta-separator">•</span>
                      <span>{{ media.segmentDate }}</span>
                    </div>
                  </div>

                  <button
                    @click="deleteMedia(media.id, media.url)"
                    class="delete-button"
                    :disabled="deletingMediaId === media.id"
                    title="Delete media"
                  >
                    <svg v-if="deletingMediaId !== media.id" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    <span v-else class="spinner">⏳</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Storage Tab -->
          <div v-if="activeTab === 'storage'" class="tab-content">
            <div class="section">
              <h4 class="section-title">Firebase Storage</h4>

              <div class="info-card">
                <span class="info-icon">☁️</span>
                <div class="info-text">
                  <span class="info-label">Provider</span>
                  <span class="info-value-small">Firebase Storage</span>
                </div>
              </div>

              <div class="info-card" style="margin-top: 0.75rem;">
                <span class="info-icon">🔐</span>
                <div class="info-text">
                  <span class="info-label">User ID</span>
                  <span class="info-value-tiny">{{ currentUser?.uid }}</span>
                </div>
              </div>

              <div class="help-text" style="margin-top: 1rem;">
                Your Firebase Storage is configured via .env.local file. Only authenticated users can upload media.
              </div>

              <div class="help-text" style="margin-top: 0.5rem;">
                <strong>Next steps:</strong>
                <ol style="margin-top: 0.5rem; padding-left: 1.25rem;">
                  <li>Copy your User ID above</li>
                  <li>Update storage.rules with your UID</li>
                  <li>Deploy rules: <code>firebase deploy --only storage</code></li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Media Modals -->
    <AddMediaForm
      v-if="showAddMediaForm"
      @close="closeAddMediaForm"
      @added="handleMediaAdded"
    />

    <!-- Media Lightbox -->
    <MediaLightbox
      v-if="showMediaLightbox && currentMediaItem"
      :media-item="currentMediaItem"
      :all-media="allMediaWithLocations"
      :current-index="currentMediaIndex"
      :can-edit="true"
      @close="closeMediaLightbox"
      @next="nextMedia"
      @previous="previousMedia"
      @open360="() => {}"
    />
  </div>
</template>

<style scoped>
.admin-panel-container {
  position: fixed;
  top: 1.5rem;
  right: 1.5rem;
  z-index: 2000;
}

.admin-toggle-btn {
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

.admin-toggle-btn:hover {
  background: white;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.admin-toggle-active {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
}

.admin-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 400px;
  max-height: calc(100vh - 3rem);
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.1);
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  flex-shrink: 0;
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

.panel-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid rgba(15, 23, 42, 0.1);
  background: #f9fafb;
  flex-shrink: 0;
}

.tab-button {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  background: none;
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 2px solid transparent;
}

.tab-button:hover {
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.05);
}

.tab-active {
  color: #8b5cf6;
  border-bottom-color: #8b5cf6;
  background: white;
}

.panel-body {
  padding: 1.25rem;
  overflow-y: auto;
  flex: 1;
}

.tab-content {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.icon-button {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.icon-button:hover {
  background: rgba(139, 92, 246, 0.2);
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(248, 250, 252, 0.8);
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.05);
}

.stat-icon {
  font-size: 2rem;
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.stat-label {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(15, 23, 42, 0.5);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
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
  flex: 1;
  min-width: 0;
}

.info-label {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(15, 23, 42, 0.5);
}

.info-value-small {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
}

.info-value-tiny {
  font-size: 0.625rem;
  font-weight: 500;
  color: #1f2937;
  font-family: monospace;
  word-break: break-all;
}

.button-group-vertical {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.action-button {
  width: 100%;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  border: none;
  font-size: 0.875rem;
  font-weight: 600;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.action-button-secondary {
  background: rgba(15, 23, 42, 0.08);
  color: #1f2937;
}

.action-button-secondary:hover {
  background: rgba(15, 23, 42, 0.12);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.action-button-danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
}

.action-button-danger:hover {
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.help-text {
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.5;
}

.help-text code {
  padding: 0.125rem 0.375rem;
  background: rgba(15, 23, 42, 0.08);
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.7rem;
}

.help-text ol {
  line-height: 1.75;
}

.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: #64748b;
}

.media-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.media-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(248, 250, 252, 0.5);
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.05);
  transition: all 0.2s ease;
}

.media-item:hover {
  background: rgba(248, 250, 252, 0.8);
  border-color: rgba(15, 23, 42, 0.1);
}

.media-thumbnail-wrapper {
  width: 60px;
  height: 60px;
  flex-shrink: 0;
  cursor: pointer;
  border-radius: 6px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.media-thumbnail-wrapper:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.media-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.media-info {
  flex: 1;
  min-width: 0;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.media-info:hover {
  opacity: 0.7;
}

.media-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-meta {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-separator {
  margin: 0 0.375rem;
}

.delete-button {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.delete-button:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
}

.delete-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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
  .admin-panel-container {
    top: 1rem;
    right: 1rem;
  }

  .admin-toggle-btn {
    width: 44px;
    height: 44px;
  }

  .admin-panel {
    width: calc(100vw - 2rem);
    max-width: 400px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
