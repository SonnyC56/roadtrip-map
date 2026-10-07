<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useTripStore } from '../stores/trip'
import { startFilm, type FlatFormat } from '../lib/film'
import { playableFormat, epKind, type EpisodeFormatKey } from '../lib/manifest'
import { mediaUrl } from '../lib/manifest'
import { uninterrupted, type Master, type MasterFormat } from '../lib/uninterrupted'
import { readyMasters, readyCollections, verifiedPending360 } from '../lib/readyV8'
import { fmtDuration } from '../lib/format'
import { trackEvent } from '../lib/analytics'
const store = useTripStore()
const masters = ref<Partial<Record<MasterFormat, Master>>>({ ...readyMasters })
const collectionId = ref(readyCollections[0]!.id)
const selectedCollection = computed(() => readyCollections.find(c => c.id === collectionId.value)!)
let timer: ReturnType<typeof setTimeout> | undefined
let disposed = false
let request: AbortController | undefined
async function refreshMasters() {
  request = new AbortController()
  const timeout = setTimeout(() => request?.abort(), 12000)
  try {
    const response = await fetch(mediaUrl('masters/vr-v08/index.json'), { cache: 'no-cache', signal: request.signal })
    const master = response.ok ? verifiedPending360(await response.json()) : null
    if (!disposed && master) masters.value.vr = master
  } catch { /* Full 360 stays Coming soon until the final corrected upload is verified. */ }
  clearTimeout(timeout)
  if (!disposed) timer = setTimeout(refreshMasters, 60000)
}
function watchCollection(format: MasterFormat) {
  const movie = selectedCollection.value.formats[format]
  if (!movie) return
  trackEvent('collection_select', { collection: selectedCollection.value.id, format: format === 'vr' ? '360' : format })
  store.showEpisode(null); store.closeMedia(); uninterrupted.value = movie
}
function watchMaster(format: MasterFormat) {
  const master = masters.value[format]
  if (!master) return
  trackEvent('film_select', { format: format === 'vr' ? '360' : format, mode: 'single-file' })
  store.showEpisode(null); store.closeMedia(); uninterrupted.value = master
}
onMounted(refreshMasters)
onBeforeUnmount(() => { disposed = true; clearTimeout(timer); request?.abort() })
const mainEpisodes = computed(() => store.episodes.filter(e => epKind(e) !== 'epilogue'))
const duration = computed(() => mainEpisodes.value.reduce((n, e) => n + (e.duration || 0), 0))
function ready(format: EpisodeFormatKey) { return !!mainEpisodes.value.length && mainEpisodes.value.every(e => playableFormat(e, format)) }
function watchFlat(format: FlatFormat) { store.showEpisode(null); store.closeMedia(); startFilm(mainEpisodes.value, format) }
function watch360() {
  trackEvent('film_select', { format: '360', mode: 'film-queue' })
  store.showEpisode(null)
  store.closeMedia()
  store.openEpisode360()
}
</script>

<template>
  <section class="film-launcher mb-3 rounded-xl p-3" aria-label="Watch the whole film">
    <div class="flex items-center justify-between gap-2">
      <h2 class="font-display text-2xl text-ivory">Watch the whole film <span class="edition">V8</span></h2>
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
        <button class="format" :disabled="!masters['16x9']" @click="watchMaster('16x9')"><strong>16:9 Landscape</strong><span>{{ masters['16x9'] ? 'Watch V8 uninterrupted' : 'Coming soon' }}</span></button>
        <button class="format" :disabled="!masters['9x16']" @click="watchMaster('9x16')"><strong>9:16 Portrait</strong><span>{{ masters['9x16'] ? 'Watch V8 uninterrupted' : 'Coming soon' }}</span></button>
        <button class="format" :disabled="!masters.vr" @click="watchMaster('vr')"><strong>360° Look around</strong><span>{{ masters.vr ? 'Watch V8 uninterrupted' : 'Coming soon' }}</span></button>
      </div>
      <p class="text-xs text-muted mt-2">Available automatically once each full-film upload is verified. Chapter playback above remains the default.</p>
    </details>
    <details class="collections mt-2 font-ui">
      <summary>Watch a chapter collection <span class="text-muted">· V8</span></summary>
      <p class="text-sm text-muted mb-2">Choose a shorter, uninterrupted part of the journey.</p>
      <label for="film-collection" class="text-sm text-muted">Chapter collection</label>
      <select id="film-collection" v-model="collectionId" class="collection-select">
        <option v-for="collection in readyCollections" :key="collection.id" :value="collection.id">{{ collection.title }}</option>
      </select>
      <p class="text-xs text-muted mb-2">{{ fmtDuration(selectedCollection.formats['16x9']?.duration || 0) }} · Single-file playback</p>
      <div class="grid grid-cols-3 gap-2">
        <button class="format" :disabled="!selectedCollection.formats['16x9']" @click="watchCollection('16x9')"><strong>16:9</strong><span>Landscape</span></button>
        <button class="format" :disabled="!selectedCollection.formats['9x16']" @click="watchCollection('9x16')"><strong>9:16</strong><span>Portrait</span></button>
        <button class="format" :disabled="!selectedCollection.formats.vr" @click="watchCollection('vr')"><strong>360°</strong><span>Look around</span></button>
      </div>
    </details>
    <a class="methodology-link" href="/methodology/">How this film was made <span aria-hidden="true">&rarr;</span></a>
    <a class="methodology-link" href="/privacy/">Privacy &amp; analytics</a>
  </section>
</template>

<style scoped>
.film-launcher { background: linear-gradient(145deg, #22303a, #14222b); border: 1px solid #43514b; }
.edition { font-family: var(--font-ui); font-size: 12px; color: #e6b56a; vertical-align: middle; }
.collection-select { width: 100%; min-height: 44px; margin: 6px 0 8px; padding: 8px 10px; border: 1px solid #8c7147; border-radius: 8px; color: #f5f1e7; background: #22303a; }
.collection-select:focus-visible { outline: 2px solid #e6b56a; outline-offset: 2px; }
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
