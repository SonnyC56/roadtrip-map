<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useTripStore } from '../stores/trip'
import { startFilm, type FlatFormat } from '../lib/film'
import { playableFormat, epKind, type EpisodeFormatKey } from '../lib/manifest'
import { mediaUrl } from '../lib/manifest'
import { uninterrupted, verifiedMaster, type Master, type MasterFormat } from '../lib/uninterrupted'
import { fmtDuration } from '../lib/format'
const store = useTripStore()
const masters = ref<Partial<Record<MasterFormat, Master>>>({})
let timer: ReturnType<typeof setTimeout> | undefined
let disposed = false
let request: AbortController | undefined
async function refreshMasters() {
  request = new AbortController()
  const timeout = setTimeout(() => request?.abort(), 12000)
  await Promise.all((['16x9', '9x16', 'vr'] as const).map(async format => {
    try {
      const prefix = format === 'vr' ? 'masters/vr-v06' : format === '9x16' ? 'masters/portrait-v08' : 'masters/v06'
      const response = await fetch(mediaUrl(`${prefix}/index.json`), { cache: 'no-cache', signal: request?.signal })
      const master = response.ok ? verifiedMaster(await response.json(), format) : null
      if (!disposed) { if (master) masters.value[format] = master; else delete masters.value[format] }
    } catch { /* Keep Coming soon when readiness cannot be established. */ }
  }))
  clearTimeout(timeout)
  if (!disposed) timer = setTimeout(refreshMasters, 60000)
}
function watchMaster(format: MasterFormat) {
  const master = masters.value[format]
  if (!master) return
  store.showEpisode(null); store.closeMedia(); uninterrupted.value = master
}
onMounted(refreshMasters)
onBeforeUnmount(() => { disposed = true; clearTimeout(timer); request?.abort() })
const mainEpisodes = computed(() => store.episodes.filter(e => epKind(e) !== 'epilogue'))
const duration = computed(() => mainEpisodes.value.reduce((n, e) => n + (e.duration || 0), 0))
function ready(format: EpisodeFormatKey) { return !!mainEpisodes.value.length && mainEpisodes.value.every(e => playableFormat(e, format)) }
function watchFlat(format: FlatFormat) { store.showEpisode(null); store.closeMedia(); startFilm(mainEpisodes.value, format) }
function watch360() {
  store.showEpisode(null)
  store.closeMedia()
  store.openEpisode360()
}
</script>

<template>
  <section class="film-launcher mb-3 rounded-xl p-3" aria-label="Watch the whole film">
    <div class="flex items-center justify-between gap-2">
      <h2 class="font-display text-2xl text-ivory">Watch the whole film</h2>
      <span class="font-ui text-xs text-muted">{{ fmtDuration(duration) }}</span>
    </div>
    <p class="font-ui text-sm text-muted mb-2">Intro to the fridge finale. Chapters play automatically. The epilogue remains a separate chapter.</p>
    <div class="grid grid-cols-3 gap-2">
      <button class="format" :disabled="!ready('16x9')" aria-label="Watch whole film in landscape 16:9" @click="watchFlat('16x9')"><strong>16:9</strong><span>Landscape</span></button>
      <button class="format" :disabled="!ready('9x16')" aria-label="Watch whole film in portrait 9:16" @click="watchFlat('9x16')"><strong>9:16</strong><span>Portrait</span></button>
      <button class="format" :disabled="!ready('vr')" aria-label="Watch whole film in 360" @click="watch360"><strong>360°</strong><span>{{ ready('vr') ? 'Look around' : 'Preparing' }}</span></button>
    </div>
    <p class="font-ui text-xs text-muted mt-2">360° works on your screen: drag or swipe to look around. Enter VR inside the viewer to use a headset.</p>
    <details class="uninterrupted mt-3 font-ui">
      <summary>Watch uninterrupted <span class="text-muted">· Optional</span></summary>
      <p class="text-sm text-muted my-2">Single-file playback, without chapter loading breaks. Best on a fast, stable connection.</p>
      <div class="grid grid-cols-3 gap-2" aria-live="polite">
        <button class="format" :disabled="!masters['16x9']" @click="watchMaster('16x9')"><strong>16:9 Landscape</strong><span>{{ masters['16x9'] ? 'Watch uninterrupted' : 'Coming soon' }}</span></button>
        <button class="format" :disabled="!masters['9x16']" @click="watchMaster('9x16')"><strong>9:16 Portrait</strong><span>{{ masters['9x16'] ? 'Watch uninterrupted' : 'Coming soon' }}</span></button>
        <button class="format" :disabled="!masters.vr" @click="watchMaster('vr')"><strong>360° Look around</strong><span>{{ masters.vr ? 'Watch uninterrupted' : 'Coming soon' }}</span></button>
      </div>
      <p class="text-xs text-muted mt-2">Available automatically once each full-film upload is verified. Chapter playback above remains the default.</p>
    </details>
    <a class="methodology-link" href="/methodology/">How this film was made <span aria-hidden="true">&rarr;</span></a>
  </section>
</template>

<style scoped>
.film-launcher { background: linear-gradient(145deg, #22303a, #14222b); border: 1px solid #43514b; }
.format { min-height: 60px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 2px; border: 1px solid #8c7147; border-radius: 9px; color: #f5f1e7; touch-action: manipulation; }
.format strong { color: #e6b56a; font-family: var(--font-ui); font-size: 15px; }
.format span { font-family: var(--font-ui); font-size: 12px; }
.format:not(:disabled):hover { background: #394036; }
.format:disabled { opacity: .65; }
summary { cursor: pointer; min-height: 44px; padding: 12px 0; color: #e6b56a; }
.format:focus-visible { outline: 2px solid #e6b56a; outline-offset: 2px; }
.methodology-link { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; margin-top: 8px; border-top: 1px solid #43514b; color: #e6b56a; font-family: var(--font-ui); font-size: 15px; text-decoration: none; }
.methodology-link:hover { color: #fff0cc; }
.methodology-link:focus-visible { outline: 2px solid #e6b56a; outline-offset: 2px; border-radius: 3px; }
</style>
