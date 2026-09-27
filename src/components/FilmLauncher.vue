<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTripStore } from '../stores/trip'
import { startFilm, type FlatFormat } from '../lib/film'
import { playableFormat, type EpisodeFormatKey } from '../lib/manifest'
import { enterVRPlaylist, episodePlaylist, xrSupported } from '../lib/xr'
import { fmtDuration } from '../lib/format'
const store = useTripStore()
const error = ref('')
const duration = computed(() => store.episodes.reduce((n, e) => n + (e.duration || 0), 0))
function ready(format: EpisodeFormatKey) { return !!store.episodes.length && store.episodes.every(e => playableFormat(e, format)) }
function watchFlat(format: FlatFormat) { store.showEpisode(null); store.closeMedia(); startFilm(store.episodes, format) }
function watchVR() {
  store.showEpisode(null); store.closeMedia(); error.value = ''
  enterVRPlaylist(episodePlaylist(store.episodes), 0, 'The whole journey', 0, undefined, !xrSupported.value)
    .catch(() => { error.value = 'Could not start VR. Please try again.' })
}
</script>

<template>
  <section class="film-launcher mb-3 rounded-xl p-3" aria-label="Watch the whole film">
    <div class="flex items-center justify-between gap-2">
      <h2 class="font-display text-2xl text-ivory">Watch the whole film</h2>
      <span class="font-ui text-xs text-muted">{{ fmtDuration(duration) }}</span>
    </div>
    <p class="font-ui text-sm text-muted mb-2">Intro to credits. Chapters play automatically.</p>
    <div class="grid grid-cols-3 gap-2">
      <button class="format" :disabled="!ready('16x9')" aria-label="Watch whole film in landscape 16:9" @click="watchFlat('16x9')"><strong>16:9</strong><span>Landscape</span></button>
      <button class="format" :disabled="!ready('9x16')" aria-label="Watch whole film in portrait 9:16" @click="watchFlat('9x16')"><strong>9:16</strong><span>Portrait</span></button>
      <button class="format" :disabled="!ready('vr')" aria-label="Watch whole film in 360 or VR" @click="watchVR"><strong>360° / VR</strong><span>{{ ready('vr') ? (xrSupported ? 'Headset' : 'Look around') : 'Preparing' }}</span></button>
    </div>
    <p v-if="error" role="alert" class="text-sm text-ivory mt-2">{{ error }}</p>
  </section>
</template>

<style scoped>
.film-launcher { background: linear-gradient(145deg, #22303a, #14222b); border: 1px solid #43514b; }
.format { min-height: 60px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 2px; border: 1px solid #8c7147; border-radius: 9px; color: #f5f1e7; touch-action: manipulation; }
.format strong { color: #e6b56a; font-family: var(--font-ui); font-size: 15px; }
.format span { font-family: var(--font-ui); font-size: 12px; }
.format:not(:disabled):hover { background: #394036; }
.format:disabled { opacity: .42; }
.format:focus-visible { outline: 2px solid #e6b56a; outline-offset: 2px; }
</style>
