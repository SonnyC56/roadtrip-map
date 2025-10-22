<script setup lang="ts">
import { useRoadTripStore } from '../stores/roadtrip'
import { MapPinIcon, MapIcon, CalendarIcon, PhotoIcon } from '@heroicons/vue/24/outline'

const store = useRoadTripStore()
</script>

<template>
  <div class="grid grid-cols-2 gap-3">
    <div class="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
      <div class="flex items-center gap-2 mb-1">
        <MapIcon class="h-5 w-5 text-red-600" />
        <span class="text-xs font-medium text-red-700">Route Points</span>
      </div>
      <p class="text-2xl font-bold text-red-900">{{ store.totalPoints.toLocaleString() }}</p>
    </div>

    <div class="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
      <div class="flex items-center gap-2 mb-1">
        <MapPinIcon class="h-5 w-5 text-blue-600" />
        <span class="text-xs font-medium text-blue-700">Stops</span>
      </div>
      <p class="text-2xl font-bold text-blue-900">{{ store.totalVisits }}</p>
    </div>

    <div class="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
      <div class="flex items-center gap-2 mb-1">
        <CalendarIcon class="h-5 w-5 text-green-600" />
        <span class="text-xs font-medium text-green-700">Duration</span>
      </div>
      <p class="text-2xl font-bold text-green-900">62 days</p>
    </div>

    <div class="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
      <div class="flex items-center gap-2 mb-1">
        <PhotoIcon class="h-5 w-5 text-purple-600" />
        <span class="text-xs font-medium text-purple-700">Media</span>
      </div>
      <p class="text-2xl font-bold text-purple-900">{{ store.allMedia.length }}</p>
    </div>

    <div class="col-span-2 bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-lg border border-teal-200">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs font-medium text-teal-700">Total Distance</span>
      </div>
      <div class="flex items-baseline gap-2">
        <p class="text-3xl font-bold text-teal-900">{{ store.distanceMiles.toLocaleString() }}</p>
        <span class="text-sm text-teal-700">miles</span>
      </div>
      <p class="text-sm text-teal-600 mt-1">{{ store.distanceKm.toLocaleString() }} km</p>
    </div>
  </div>
</template>
