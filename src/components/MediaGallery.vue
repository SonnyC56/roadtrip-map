<script setup lang="ts">
import { computed } from 'vue'
import { useRoadTripStore } from '../stores/roadtrip'
import { XMarkIcon, TrashIcon, GlobeAltIcon } from '@heroicons/vue/24/outline'
import type { MediaItem } from '../stores/roadtrip'

const store = useRoadTripStore()

const media = computed(() => store.segmentMedia)

function deleteMedia(id: string) {
  if (confirm('Are you sure you want to delete this media?')) {
    store.removeMedia(id)
  }
}

function getMediaIcon(type: MediaItem['type']) {
  if (type.includes('360')) {
    return GlobeAltIcon
  }
  return null
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="font-semibold text-gray-900">Media Gallery</h3>
      <span class="text-sm text-gray-500">{{ media.length }} items</span>
    </div>

    <div v-if="media.length === 0" class="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
      <p class="text-gray-500">No media added yet</p>
      <p class="text-sm text-gray-400 mt-1">Add photos, videos, or 360° content to this location</p>
    </div>

    <div v-else class="grid grid-cols-2 gap-3">
      <div
        v-for="item in media"
        :key="item.id"
        class="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-primary-400 transition-all cursor-pointer"
      >
        <!-- Media Preview -->
        <img
          v-if="item.type === 'photo' || item.type === '360-photo'"
          :src="item.thumbnail || item.url"
          :alt="item.caption"
          class="w-full h-full object-cover"
        />
        <video
          v-else
          :src="item.url"
          class="w-full h-full object-cover"
        ></video>

        <!-- 360 Badge -->
        <div
          v-if="item.type.includes('360')"
          class="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1"
        >
          <GlobeAltIcon class="h-3 w-3" />
          360°
        </div>

        <!-- Overlay on Hover -->
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-end p-2">
          <div class="opacity-0 group-hover:opacity-100 transition-opacity w-full">
            <p v-if="item.caption" class="text-white text-sm font-medium mb-2 line-clamp-2">
              {{ item.caption }}
            </p>
            <button
              @click.stop="deleteMedia(item.id)"
              class="w-full py-1.5 px-3 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1"
            >
              <TrashIcon class="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
