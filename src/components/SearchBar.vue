<script setup lang="ts">
import { ref } from 'vue'
import { useRoadTripStore } from '../stores/roadtrip'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/vue/24/outline'

const store = useRoadTripStore()
const searchInput = ref('')

function handleSearch() {
  store.setSearchQuery(searchInput.value)
}

function clearSearch() {
  searchInput.value = ''
  store.setSearchQuery('')
}
</script>

<template>
  <div class="relative">
    <div class="relative">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <MagnifyingGlassIcon class="h-5 w-5 text-gray-400" />
      </div>
      <input
        v-model="searchInput"
        @input="handleSearch"
        type="text"
        placeholder="Search locations..."
        class="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
      />
      <button
        v-if="searchInput"
        @click="clearSearch"
        class="absolute inset-y-0 right-0 pr-3 flex items-center"
      >
        <XMarkIcon class="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
      </button>
    </div>
  </div>
</template>
