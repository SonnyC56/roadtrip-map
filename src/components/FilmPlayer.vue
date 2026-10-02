<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { closeFilm, filmState, type FlatFormat } from '../lib/film'
import { useTripStore } from '../stores/trip'
import { epLabel, mediaUrl, playableFormat, type Episode } from '../lib/manifest'
function title(e: Episode) { return epLabel(e).toUpperCase() === e.title.toUpperCase() ? e.title : `${epLabel(e)} · ${e.title}` }
const store = useTripStore()
const video = ref<HTMLVideoElement | null>(null)
const episode = computed(() => filmState.value?.episodes[filmState.value.index])
const source = computed(() => playableFormat(episode.value, filmState.value?.format || '16x9'))
const next = computed(() => { const s = filmState.value; return s?.episodes[s.index + 1] })
const failed = ref(false)
const needsPlay = ref(false)
const finished = ref(false)
let seekTo = 0
let shouldPlay = true
async function play() {
  try { await video.value?.play(); needsPlay.value = false }
  catch { needsPlay.value = true }
}
function metadata() {
  if (video.value && seekTo) video.value.currentTime = Math.min(seekTo, Math.max(0, video.value.duration - .05))
  seekTo = 0
  if (shouldPlay) void play()
}
function go(index: number) {
  const s = filmState.value
  if (!s || index < 0 || index >= s.episodes.length) return
  failed.value = false; finished.value = false; needsPlay.value = false; shouldPlay = true; seekTo = 0
  filmState.value = { ...s, index }
}
function ended() {
  if (next.value) go(filmState.value!.index + 1)
  else finished.value = true
}
function format(fmt: FlatFormat) {
  const s = filmState.value
  if (!s || s.format === fmt || !s.episodes.every(e => playableFormat(e, fmt))) return
  seekTo = video.value?.currentTime || 0
  shouldPlay = !!video.value && !video.value.paused
  failed.value = false; needsPlay.value = false
  filmState.value = { ...s, format: fmt }
}
function watch360() {
  if (!episode.value || !playableFormat(episode.value, 'vr')) return
  if (store.openEpisode360(episode.value.ep)) closeFilm()
}
function retry() { failed.value = false; shouldPlay = true; video.value?.load() }
function key(e: KeyboardEvent) { if (e.key === 'Escape') closeFilm() }
onMounted(() => window.addEventListener('keydown', key))
onBeforeUnmount(() => { window.removeEventListener('keydown', key); video.value?.pause() })
</script>

<template>
  <div v-if="filmState && episode" class="film" role="dialog" aria-modal="true" aria-label="Watch the whole film">
    <header class="flex items-center gap-3 px-3 sm:px-6 py-3">
      <div class="min-w-0 flex-1">
        <p class="font-ui text-xs text-amber uppercase tracking-wider">The whole journey · {{ filmState.index + 1 }} / {{ filmState.episodes.length }}</p>
        <h2 class="font-display text-xl sm:text-3xl text-ivory truncate">{{ title(episode) }}</h2>
      </div>
      <button class="control" aria-label="Close film" @click="closeFilm">✕</button>
    </header>
    <div class="film-stage relative flex-1 min-h-0 bg-black">
      <!-- Keep one media element across chapters: preserves volume and native fullscreen. -->
      <video ref="video" class="w-full h-full object-contain" :src="mediaUrl(source?.src)" :poster="mediaUrl(source?.poster)"
        controls playsinline preload="auto" autoplay @loadedmetadata="metadata" @ended="ended" @playing="needsPlay = false" @error="failed = true"></video>
      <div v-if="failed || needsPlay || finished" class="absolute inset-0 grid place-items-center bg-black/65 p-6">
        <div class="text-center text-ivory">
          <p class="font-display text-3xl">{{ failed ? 'This chapter could not load' : finished ? 'Thanks for riding along' : 'Ready to keep watching' }}</p>
          <button class="btn mt-4" @click="failed ? retry() : finished ? go(0) : play()">{{ failed ? 'Retry chapter' : finished ? 'Watch again' : 'Play film' }}</button>
        </div>
      </div>
    </div>
    <footer class="film-controls px-3 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div class="flex gap-2 items-center flex-wrap">
        <button class="control" :disabled="filmState.index === 0" aria-label="Previous chapter" @click="go(filmState.index - 1)">←</button>
        <label class="min-w-0 flex-1 font-ui text-xs text-muted"><span class="sr-only">Choose chapter</span>
          <select aria-label="Choose chapter" class="chapter-select w-full" :value="filmState.index" @change="go(Number(($event.target as HTMLSelectElement).value))">
            <option v-for="(e, i) in filmState.episodes" :key="e.ep" :value="i">{{ title(e) }}</option>
          </select>
        </label>
        <button class="control" :disabled="!next" aria-label="Next chapter" @click="go(filmState.index + 1)">→</button>
        <div class="flex gap-1" role="group" aria-label="Film format">
          <button class="control text-sm" :aria-pressed="filmState.format === '16x9'" aria-label="Watch film in landscape" @click="format('16x9')">16:9</button>
          <button class="control text-sm" :aria-pressed="filmState.format === '9x16'" aria-label="Watch film in portrait" @click="format('9x16')">9:16</button>
          <button class="control text-sm" :disabled="!playableFormat(episode, 'vr')" aria-label="Watch film in 360" @click="watch360">360°</button>
        </div>
      </div>
      <p class="font-ui text-xs text-muted mt-2 truncate" aria-live="polite">{{ next ? `Up next: ${next.title} · plays automatically` : 'The final chapter' }}</p>
    </footer>
  </div>
</template>

<style scoped>
.film { position: fixed; inset: 0; z-index: 1200; background: #101b23; height: 100dvh; display: flex; flex-direction: column; padding-top: env(safe-area-inset-top); }
.control { min-width: 44px; min-height: 44px; padding: 0 10px; border: 1px solid #43514b; border-radius: 9px; color: #e6b56a; touch-action: manipulation; }
.control[aria-pressed='true'] { background: #e6b56a; color: #101b23; }
.control:disabled { opacity: .3; }
.control:focus-visible, .chapter-select:focus-visible { outline: 2px solid #e6b56a; outline-offset: 2px; }
.chapter-select { min-height: 44px; background: #16242e; color: #f5f1e7; border: 1px solid #43514b; border-radius: 9px; padding: 0 8px; font-size: 16px; }
@media (max-height: 480px) and (orientation: landscape) { header { padding-top: 4px; padding-bottom: 4px; } .film-controls { padding-top: 4px; } .film-controls p { display: none; } }
</style>
