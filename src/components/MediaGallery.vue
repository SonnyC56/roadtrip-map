<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoadTripStore, type MediaItem } from '../stores/roadtrip'

const props = defineProps<{
  segmentIndex: number | null
}>()

const emit = defineEmits<{
  openMedia: [mediaItem: MediaItem, index: number]
  addMedia: []
}>()

const store = useRoadTripStore()

const mediaItems = computed(() => {
  if (props.segmentIndex === null) {
    console.log('🎬 MediaGallery: segmentIndex is null, returning empty array')
    return []
  }
  const items = store.getMediaForSegment(props.segmentIndex)
  console.log(`🎬 MediaGallery: Found ${items.length} media items for segment ${props.segmentIndex}`, items)
  return items
})

onMounted(() => {
  console.log('🎬 MediaGallery: Component mounted with segmentIndex:', props.segmentIndex)
})

watch(() => props.segmentIndex, (newIndex, oldIndex) => {
  console.log(`🎬 MediaGallery: segmentIndex changed from ${oldIndex} to ${newIndex}`)
}, { immediate: true })

watch(mediaItems, (newItems) => {
  console.log(`🎬 MediaGallery: mediaItems updated, count: ${newItems.length}`)
}, { immediate: true })

async function openMedia(mediaItem: MediaItem, index: number) {
  // Ensure full details are loaded before opening
  await store.loadMediaDetails(mediaItem.id)
  const fullMedia = store.loadedMediaDetails.get(mediaItem.id)
  if (fullMedia) {
    emit('openMedia', fullMedia, index)
  } else {
    // Fallback to original if loading failed
    emit('openMedia', mediaItem, index)
  }
}

function addMedia() {
  emit('addMedia')
}

function getMediaIcon(type: string) {
  switch (type) {
    case 'photo':
      return '📷'
    case 'video':
      return '🎥'
    case '360-photo':
      return '🌐'
    case '360-video':
      return '🎬'
    default:
      return '📷'
  }
}

function getMediaLabel(type: string) {
  switch (type) {
    case 'photo':
      return 'Photo'
    case 'video':
      return 'Video'
    case '360-photo':
      return '360° Photo'
    case '360-video':
      return '360° Video'
    default:
      return 'Media'
  }
}

function is360(type: string) {
  return type === '360-photo' || type === '360-video'
}

function isVideo(type: string) {
  return type === 'video' || type === '360-video'
}

function getCommentCount(mediaItem: MediaItem) {
  return mediaItem.comments?.length || 0
}
</script>

<template>
  <div class="media-gallery">
    <div class="gallery-header">
      <h4 class="gallery-title">
        Media
        <span v-if="mediaItems.length > 0" class="media-count">{{ mediaItems.length }}</span>
      </h4>
      <button @click="addMedia" class="btn-add-media" title="Add Media">
        + Add
      </button>
    </div>

    <div v-if="mediaItems.length === 0" class="empty-state">
      <div class="empty-icon">📷</div>
      <p class="empty-text">No media for this segment yet</p>
      <button @click="addMedia" class="btn-add-first">
        Add Media
      </button>
    </div>

    <div v-else class="gallery-grid">
      <div
        v-for="(item, index) in mediaItems"
        :key="item.id"
        @click="openMedia(item, index)"
        class="gallery-item"
        :class="{ 'is-360': is360(item.type), 'is-video': isVideo(item.type) }"
      >
        <!-- Thumbnail -->
        <div class="thumbnail-container">
          <img
            v-if="item.thumbnail"
            :src="item.thumbnail"
            :alt="item.caption || 'Media thumbnail'"
            class="thumbnail-image"
          />
          <div v-else class="thumbnail-placeholder">
            <span class="placeholder-icon">{{ getMediaIcon(item.type) }}</span>
          </div>

          <!-- Type badge -->
          <div class="type-badge">
            <span class="badge-icon">{{ getMediaIcon(item.type) }}</span>
            <span class="badge-label">{{ getMediaLabel(item.type) }}</span>
          </div>

          <!-- Video play icon -->
          <div v-if="isVideo(item.type)" class="play-icon">
            ▶
          </div>

          <!-- 360° badge -->
          <div v-if="is360(item.type)" class="badge-360">
            360°
          </div>

          <!-- Comment count -->
          <div v-if="getCommentCount(item) > 0" class="comment-badge">
            💬 {{ getCommentCount(item) }}
          </div>
        </div>

        <!-- Caption -->
        <div v-if="item.caption" class="item-caption">
          {{ item.caption }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.media-gallery {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

.gallery-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.gallery-title {
  font-size: 1rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.media-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  min-width: 24px;
}

.btn-add-media {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-media:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  opacity: 0.3;
  margin-bottom: 1rem;
}

.empty-text {
  color: #94a3b8;
  font-size: 0.875rem;
  margin: 0 0 1.5rem;
}

.btn-add-first {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-first:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

.gallery-item {
  cursor: pointer;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.gallery-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.3);
}

.gallery-item:active {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}

.thumbnail-container {
  position: relative;
  width: 100%;
  padding-top: 100%; /* 1:1 aspect ratio */
  background: #f1f5f9;
  overflow: hidden;
}

.thumbnail-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
}

.placeholder-icon {
  font-size: 3rem;
  opacity: 0.3;
}

.type-badge {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.625rem;
  font-weight: 700;
  color: white;
}

.badge-icon {
  font-size: 0.875rem;
}

.badge-label {
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.play-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.25rem;
  padding-left: 0.25rem;
}

.badge-360 {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.comment-badge {
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.625rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.item-caption {
  padding: 0.625rem;
  font-size: 0.75rem;
  color: #475569;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .gallery-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.75rem;
  }

  .type-badge {
    padding: 0.2rem 0.4rem;
  }

  .badge-label {
    display: none;
  }

  .play-icon {
    width: 40px;
    height: 40px;
    font-size: 1rem;
  }
}

@media (max-width: 640px) {
  .media-gallery {
    padding: 0.75rem;
  }

  .gallery-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.5rem;
  }

  .btn-add-media {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }
}
</style>
