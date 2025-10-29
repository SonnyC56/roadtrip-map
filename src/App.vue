<script setup lang="ts">
import RoadTripMap from './components/RoadTripMap.vue'
import Sidebar from './components/Sidebar.vue'
import LayersControl from './components/LayersControl.vue'
import AdminPanel from './components/AdminPanel.vue'
</script>

<template>
  <div class="relative h-screen w-screen overflow-hidden bg-slate-950">
    <RoadTripMap />

    <div class="pointer-events-none absolute inset-0">
      <div class="absolute inset-0 bg-gradient-to-br from-slate-950/70 via-slate-900/25 to-transparent"></div>
      <div class="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent"></div>
    </div>

    <AdminPanel />
    <LayersControl />
    <Sidebar />
  </div>
</template>
