<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoadTripStore } from '../stores/roadtrip'
import { format } from 'date-fns'
import { CalendarIcon } from '@heroicons/vue/24/outline'

const store = useRoadTripStore()

const startDate = ref(new Date('2025-08-10'))
const endDate = ref(new Date('2025-10-10'))

const minDate = '2025-08-10'
const maxDate = '2025-10-10'

const startDateString = computed(() => format(startDate.value, 'MMM dd, yyyy'))
const endDateString = computed(() => format(endDate.value, 'MMM dd, yyyy'))

watch([startDate, endDate], () => {
  store.setDateRange([startDate.value, endDate.value])
})

function resetDates() {
  startDate.value = new Date('2025-08-10')
  endDate.value = new Date('2025-10-10')
}
</script>

<template>
  <div class="space-y-4 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <CalendarIcon class="h-5 w-5 text-gray-500" />
        <h3 class="font-semibold text-gray-900">Timeline Filter</h3>
      </div>
      <button
        @click="resetDates"
        class="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
      >
        Reset
      </button>
    </div>

    <div class="space-y-4">
      <!-- Start Date -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Start Date
        </label>
        <input
          v-model="startDate"
          type="date"
          :min="minDate"
          :max="maxDate"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <p class="mt-1 text-xs text-gray-500">{{ startDateString }}</p>
      </div>

      <!-- End Date -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          End Date
        </label>
        <input
          v-model="endDate"
          type="date"
          :min="minDate"
          :max="maxDate"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <p class="mt-1 text-xs text-gray-500">{{ endDateString }}</p>
      </div>

      <!-- Visual Timeline -->
      <div class="pt-2">
        <div class="h-2 bg-gradient-to-r from-red-400 via-teal-400 to-green-300 rounded-full relative">
          <div class="absolute inset-0 flex justify-between items-center px-1">
            <div class="w-3 h-3 bg-white border-2 border-red-500 rounded-full shadow-sm"></div>
            <div class="w-3 h-3 bg-white border-2 border-green-500 rounded-full shadow-sm"></div>
          </div>
        </div>
        <div class="flex justify-between mt-2 text-xs text-gray-500">
          <span>Aug 10</span>
          <span>Sep 10</span>
          <span>Oct 10</span>
        </div>
      </div>
    </div>
  </div>
</template>
