<script setup lang="ts">
/**
 * MediaViewer - Unified media viewer dispatcher
 *
 * Routes media items to the appropriate viewer based on type:
 * - photo, video → MediaLightbox
 * - 360-photo, 360-video → Media360Viewer
 * - splat → StorySplatViewer
 * - xr-scene → XRGalleryViewer
 */

import { computed } from 'vue'
import { useRoadTripStore, type MediaItem } from '../stores/roadtrip'
import MediaLightbox from './MediaLightbox.vue'
import Media360Viewer from './Media360Viewer.vue'
import StorySplatViewer from './StorySplatViewer.vue'
import XRGalleryViewer from './XRGalleryViewer.vue'

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
}>()

const store = useRoadTripStore()

// Determine which viewer component to use
const viewerComponent = computed(() => {
  switch (props.mediaItem.type) {
    case 'photo':
    case 'video':
      return MediaLightbox
    case '360-photo':
    case '360-video':
      return Media360Viewer
    case 'splat':
      return StorySplatViewer
    case 'xr-scene':
      return XRGalleryViewer
    default:
      return MediaLightbox
  }
})

// Props to pass to the viewer component
const viewerProps = computed(() => {
  const baseProps = {
    mediaItem: props.mediaItem,
    allMedia: props.allMedia,
    currentIndex: props.currentIndex
  }

  // MediaLightbox needs canEdit prop
  if (props.mediaItem.type === 'photo' || props.mediaItem.type === 'video') {
    return {
      ...baseProps,
      canEdit: props.canEdit
    }
  }

  return baseProps
})

function handleClose() {
  emit('close')
}

function handleNext() {
  emit('next')
}

function handlePrevious() {
  emit('previous')
}
</script>

<template>
  <component
    :is="viewerComponent"
    v-bind="viewerProps"
    @close="handleClose"
    @next="handleNext"
    @previous="handlePrevious"
  />
</template>
