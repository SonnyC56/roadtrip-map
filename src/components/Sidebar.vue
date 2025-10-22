<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoadTripStore } from '../stores/roadtrip'
import SearchBar from './SearchBar.vue'
import TimelineSlider from './TimelineSlider.vue'
import TimelinePlayer from './TimelinePlayer.vue'
import StatsPanel from './StatsPanel.vue'
import MediaUpload from './MediaUpload.vue'
import MediaGallery from './MediaGallery.vue'
import CommentsSection from './CommentsSection.vue'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MapIcon,
  PlayCircleIcon
} from '@heroicons/vue/24/outline'

const store = useRoadTripStore()

const isCollapsed = ref(false)
const activeTab = ref<'overview' | 'details'>('overview')

const hasSelectedSegment = computed(() => store.selectedSegmentIndex !== null)

function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value
}

function handleTimeUpdate(timestamp: number) {
  store.setTimelineTimestamp(timestamp)
}

function toggleTimelineMode() {
  if (store.isTimelineModeActive) {
    store.deactivateTimelineMode()
  } else {
    store.activateTimelineMode()
  }
}
</script>

<template>
  <div
    :class="[
      'relative h-full bg-white shadow-2xl transition-all duration-300 ease-in-out flex flex-col',
      isCollapsed ? 'w-0' : 'w-96'
    ]"
  >
    <!-- Toggle Button -->
    <button
      @click="toggleSidebar"
      class="absolute -right-10 top-4 z-10 p-2 bg-white rounded-r-lg shadow-lg hover:bg-gray-50 transition-colors"
    >
      <ChevronRightIcon v-if="isCollapsed" class="h-5 w-5 text-gray-600" />
      <ChevronLeftIcon v-else class="h-5 w-5 text-gray-600" />
    </button>

    <!-- Sidebar Content -->
    <div v-if="!isCollapsed" class="flex flex-col h-full overflow-hidden">
      <!-- Header -->
      <div class="p-6 border-b border-gray-200 bg-gradient-to-r from-primary-500 to-primary-600">
        <h1 class="text-2xl font-bold text-white flex items-center gap-2">
          <MapIcon class="h-7 w-7" />
          Road Trip 2025
        </h1>
        <p class="text-primary-100 text-sm mt-1">August 10 - October 10</p>
      </div>

      <!-- Tabs -->
      <div class="flex border-b border-gray-200">
        <button
          @click="activeTab = 'overview'"
          :class="[
            'flex-1 py-3 px-4 font-medium text-sm transition-colors',
            activeTab === 'overview'
              ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          ]"
        >
          Overview
        </button>
        <button
          @click="activeTab = 'details'"
          :class="[
            'flex-1 py-3 px-4 font-medium text-sm transition-colors relative',
            activeTab === 'details'
              ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          ]"
          :disabled="!hasSelectedSegment"
        >
          Location Details
          <span
            v-if="!hasSelectedSegment"
            class="absolute top-1 right-1 text-xs text-gray-400"
          >
            (Select a location)
          </span>
        </button>
      </div>

      <!-- Scrollable Content -->
      <div class="flex-1 overflow-y-auto">
        <!-- Overview Tab -->
        <div v-if="activeTab === 'overview'" class="p-6 space-y-6">
          <StatsPanel />

          <!-- Timeline Mode Toggle -->
          <button
            @click="toggleTimelineMode"
            :class="[
              'w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
              store.isTimelineModeActive
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            ]"
          >
            <PlayCircleIcon class="h-5 w-5" />
            {{ store.isTimelineModeActive ? 'Timeline Mode Active' : 'Activate Timeline Playback' }}
          </button>

          <!-- Timeline Player (when active) -->
          <TimelinePlayer
            v-if="store.isTimelineModeActive"
            @time-update="handleTimeUpdate"
          />

          <!-- Regular filters (when timeline inactive) -->
          <template v-if="!store.isTimelineModeActive">
            <SearchBar />
            <TimelineSlider />
          </template>

          <div class="pt-4 border-t border-gray-200">
            <h3 class="text-sm font-semibold text-gray-700 mb-3">Quick Tips</h3>
            <ul class="space-y-2 text-sm text-gray-600">
              <li class="flex items-start gap-2">
                <span class="text-primary-500">•</span>
                <span>Click on any route segment for details</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-primary-500">•</span>
                <span>Blue markers show stops and visits</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-primary-500">•</span>
                <span>Use Timeline Mode to watch your route grow!</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-primary-500">•</span>
                <span>Add photos, videos, and 360° content to locations</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Details Tab -->
        <div v-if="activeTab === 'details'" class="p-6 space-y-6">
          <div v-if="!hasSelectedSegment" class="text-center py-12">
            <MapIcon class="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p class="text-gray-500 font-medium">No location selected</p>
            <p class="text-sm text-gray-400 mt-2">
              Click on a route or marker on the map to view details
            </p>
          </div>

          <div v-else class="space-y-6">
            <!-- Location Info -->
            <div class="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
              <h3 class="font-semibold text-blue-900 mb-2">Location Information</h3>
              <div class="space-y-1 text-sm text-blue-800">
                <p v-if="store.selectedSegment?.visit">
                  <strong>Type:</strong>
                  {{ store.selectedSegment.visit.topCandidate.semanticType || 'Unknown' }}
                </p>
                <p>
                  <strong>Time:</strong>
                  {{ new Date(store.selectedSegment!.startTime).toLocaleString() }}
                </p>
                <p v-if="store.selectedSegment?.activity">
                  <strong>Distance:</strong>
                  {{ (store.selectedSegment.activity.distanceMeters / 1609.34).toFixed(1) }} miles
                </p>
              </div>
            </div>

            <!-- Media Upload -->
            <MediaUpload />

            <!-- Media Gallery -->
            <MediaGallery />

            <!-- Comments -->
            <CommentsSection />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Add smooth animations */
.animate-fade-in {
  animation: fadeIn 0.2s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
