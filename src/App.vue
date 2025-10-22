<script setup lang="ts">
import Sidebar from './components/Sidebar.vue'
import RoadTripMap from './components/RoadTripMap.vue'
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden bg-gray-100">
    <!-- Sidebar -->
    <Sidebar />

    <!-- Map -->
    <div class="flex-1 relative">
      <RoadTripMap />
    </div>
  </div>
</template>
