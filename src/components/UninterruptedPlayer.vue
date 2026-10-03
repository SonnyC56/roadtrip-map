<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onBeforeUnmount, ref } from 'vue'
import { uninterrupted } from '../lib/uninterrupted'
import { mediaUrl, type Media } from '../lib/manifest'
import { useTripStore } from '../stores/trip'
import legacyChapters from '../lib/film-chapters.json'
const Media360Viewer = defineAsyncComponent(() => import('./Media360Viewer.vue'))
const store = useTripStore()
const master = uninterrupted.value!
const chapters = master.version === 'v08' ? master.chapters! : legacyChapters
const dialog = ref<HTMLElement | null>(null)
const video = ref<HTMLVideoElement | null>(null)
const sphere = ref<{ seek: (seconds: number) => void } | null>(null)
const time = ref(0)
const error = ref('')
const previousFocus = document.activeElement as HTMLElement | null
const chapter = computed(() => Math.max(0, chapters.reduce((found, c, i) => c.start <= time.value ? i : found, 0)))
const poster = store.episodes.find(e => e.ep === 0)?.formats[master.format]?.poster
const item: Media = { id: `whole-journey-${master.version}`, type: 'pano-video', src: master.src, poster,
  caption: "Sonny's Roadtrip 2025 — uninterrupted", duration: master.duration, time_utc: null,
  lat: 0, lon: 0, t: 0, day: '2025-08-13' }
function seek(index: number) {
  const c = chapters[index]; if (!c) return
  if (master.format === 'vr') sphere.value?.seek(c.start)
  else if (video.value) video.value.currentTime = c.start
  time.value = c.start
}
function close() { uninterrupted.value = null }
function key(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
  if (event.key !== 'Tab' || !dialog.value) return
  const nodes = [...dialog.value.querySelectorAll<HTMLElement>('button:not(:disabled), select, video, [tabindex="0"]')]
  const first = nodes[0], last = nodes[nodes.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
function fullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen()
  else void dialog.value?.requestFullscreen().catch(() => {})
}
onMounted(() => { dialog.value?.focus(); window.addEventListener('keydown', key) })
onBeforeUnmount(() => { video.value?.pause(); window.removeEventListener('keydown', key); previousFocus?.focus() })
</script>
<template>
  <section ref="dialog" class="master-player" role="dialog" aria-modal="true" aria-label="Watch uninterrupted" tabindex="-1">
    <header><span>Whole journey · {{ master.format === 'vr' ? '360°' : master.format === '9x16' ? '9:16' : '16:9' }} · Uninterrupted</span><button class="btn" @click="close">Close</button></header>
    <div class="picture">
      <Media360Viewer v-if="master.format === 'vr'" ref="sphere" :item="item" continuous single-file @time="time = $event" @fullscreen="fullscreen" />
      <video v-else ref="video" controls playsinline autoplay preload="metadata" crossorigin="anonymous" :src="mediaUrl(master.src)" :poster="mediaUrl(poster)" @timeupdate="time = video?.currentTime || 0" @error="error = 'The film could not load. Close this player to use chapter playback instead.'">
        <track v-if="master.vtt" kind="captions" label="English" srclang="en" :src="mediaUrl(master.vtt)" />
      </video>
    </div>
    <footer><button class="btn" :disabled="chapter === 0" @click="seek(chapter - 1)">Previous</button><select aria-label="Jump to chapter" :value="chapter" @change="seek(Number(($event.target as HTMLSelectElement).value))"><option v-for="(c, i) in chapters" :key="c.ep" :value="i">{{ c.ep === 0 ? 'Intro' : `E${c.ep}` }} · {{ c.title }}</option></select><button class="btn" :disabled="chapter === chapters.length - 1" @click="seek(chapter + 1)">Next</button></footer>
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>
<style scoped>
.master-player { position: fixed; inset: 0; z-index: 1200; background: #101b23; color: #f5f1e7; display: flex; flex-direction: column; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }
header, footer { display: flex; align-items: center; gap: 8px; padding: 10px; font-family: var(--font-ui); }
header { justify-content: space-between; } header span { font-size: 14px; }
.picture { flex: 1; min-height: 0; background: black; } video { width: 100%; height: 100%; object-fit: contain; }
select { min-width: 0; flex: 1; min-height: 44px; background: #22303a; color: #f5f1e7; border-radius: 6px; } button { min-height: 44px; } button:disabled { opacity: .4; }
</style>
