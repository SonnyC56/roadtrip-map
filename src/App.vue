<script setup lang="ts">
import { onMounted, watch } from 'vue'
import TripMap from './components/TripMap.vue'
import TripPanel from './components/TripPanel.vue'
import TimelineBar from './components/TimelineBar.vue'
import LayerChips from './components/LayerChips.vue'
import BrandHeader from './components/BrandHeader.vue'
import EpisodePlayer from './components/EpisodePlayer.vue'
import MediaLightbox from './components/MediaLightbox.vue'
import { useTripStore } from './stores/trip'
import { useViewport } from './composables/useViewport'
import { logoUrl } from './lib/brand'

const store = useTripStore()
const { isMobile } = useViewport()

// ---- deep links: #e12 opens episode 12, #m=<media id> opens a photo/video ----
function readHash() {
  const h = decodeURIComponent(location.hash.slice(1))
  const ep = /^e(\d+)$/i.exec(h)
  if (ep) {
    store.showEpisode(Number(ep[1]))
    return
  }
  const m = /^m=(.+)$/.exec(h)
  if (m) store.openMediaById(m[1]!)
}
function writeHash() {
  let h = ''
  if (store.lightbox) {
    const it = store.lightbox.list[store.lightbox.index]
    if (it) h = `m=${it.id}`
  } else if (store.openEpisode != null) h = `e${store.openEpisode}`
  const want = h ? `#${h}` : ''
  if (location.hash !== want) history.replaceState(null, '', want || location.pathname + location.search)
}
watch(() => [store.openEpisode, store.lightbox], writeHash)

onMounted(async () => {
  await store.init()
  readHash()
  window.addEventListener('hashchange', readHash)
})
</script>

<template>
  <div class="relative h-full w-full overflow-hidden bg-ink">
    <TripMap />

    <!-- soft vignette so chrome reads on top of the map -->
    <div class="pointer-events-none absolute inset-0 z-[400] vignette"></div>

    <!-- desktop -->
    <template v-if="!isMobile">
      <TripPanel />
      <div class="absolute z-[450] top-4 left-[calc(var(--panel-w)+2rem)] right-16 flex flex-wrap gap-1.5">
        <LayerChips />
      </div>
      <div class="absolute z-[450] bottom-6 left-[calc(var(--panel-w)+2rem)] right-4 max-w-[900px]">
        <TimelineBar />
      </div>
    </template>

    <!-- mobile -->
    <template v-else>
      <div class="absolute z-[450] inset-x-0 top-0 pt-[env(safe-area-inset-top)]">
        <div class="panel mx-2 mt-2 rounded-xl px-3 py-2">
          <BrandHeader compact />
        </div>
        <div class="chips-scroll mt-2 px-2 overflow-x-auto">
          <LayerChips class="w-max pb-1" />
        </div>
      </div>
      <div class="absolute z-[450] inset-x-2 transition-[bottom] duration-200" :style="{ bottom: 'calc(var(--sheet-h, 148px) + 8px)' }">
        <TimelineBar />
      </div>
      <TripPanel />
    </template>

    <!-- loading / error -->
    <Transition name="fade">
      <div v-if="store.status === 'loading'" class="absolute inset-0 z-[900] grid place-items-center bg-ink">
        <div class="text-center grid justify-items-center">
          <img :src="logoUrl" alt="Sonny's Roadtrip 2025" class="w-56 max-w-[60vw] mb-2" @error="($event.target as HTMLImageElement).style.display = 'none'" />
          <p class="font-pixel text-xs text-brass-4 mt-3 loading-dots">LOADING THE ROAD</p>
        </div>
      </div>
    </Transition>
    <div v-if="store.status === 'error'" class="absolute inset-x-4 top-24 z-[900] mx-auto max-w-md panel rounded-xl p-4 text-sm">
      <p class="font-display text-2xl text-amber">Map data unavailable</p>
      <p class="text-muted mt-1">{{ store.error }}</p>
    </div>

    <EpisodePlayer />
    <MediaLightbox />
  </div>
</template>

<style scoped>
.vignette {
  background: radial-gradient(120% 90% at 60% 45%, transparent 55%, rgb(10 17 22 / 0.55) 100%);
}
.chips-scroll {
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.chips-scroll::-webkit-scrollbar {
  display: none;
}
.loading-dots::after {
  content: '';
  animation: dots 1.2s steps(4) infinite;
}
@keyframes dots {
  0% {
    content: '';
  }
  25% {
    content: '.';
  }
  50% {
    content: '..';
  }
  75% {
    content: '...';
  }
}
.fade-leave-active {
  transition: opacity 0.4s;
}
.fade-leave-to {
  opacity: 0;
}
</style>
