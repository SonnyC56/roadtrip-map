<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useTripStore } from '../stores/trip'
import { epKind, epLabel, mediaUrl, playableFormat } from '../lib/manifest'
import { dateSpan, fmtDuration } from '../lib/format'
import { enterVRPlaylist, episodePlaylist, xrSupported } from '../lib/xr'

const store = useTripStore()
const listEl = ref<HTMLElement | null>(null)

// "Watch the whole film in VR": only on a headset, and only once the manifest has VR episodes (formats.vr)
const vrItems = computed(() => episodePlaylist(store.episodes))
const vrError = ref('')
function watchFilmVR() {
  enterVRPlaylist(vrItems.value, 0, 'Episodes').catch((e) => {
    console.warn('[vr] session failed', e)
    vrError.value = 'VR could not start.'
    setTimeout(() => (vrError.value = ''), 3000)
  })
}

function stopNames(ids: number[]) {
  return ids
    .map((i) => store.stopById.get(i)?.name)
    .filter(Boolean)
    .join(' · ')
}

function poster(ep: number) {
  const e = store.episodeByNum.get(ep)
  return mediaUrl(e?.formats['16x9']?.poster || e?.formats['9x16']?.poster)
}

// keep the playing episode in view during playback
watch(
  () => store.currentEpisode?.ep,
  async (ep) => {
    if (!store.playing || ep == null) return
    await nextTick()
    listEl.value?.querySelector(`[data-ep="${ep}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  },
)
</script>

<template>
  <button
    v-if="xrSupported && vrItems.length"
    class="vr-film w-full mb-2 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 font-ui text-sm uppercase tracking-widest"
    title="Plays every episode in your headset, one after another, through the credits"
    @click="watchFilmVR"
  >
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M3 7h18a1 1 0 011 1v8a1 1 0 01-1 1h-5.2l-2-2.6a2.25 2.25 0 00-3.6 0L8.2 17H3a1 1 0 01-1-1V8a1 1 0 011-1zm4.5 3a2 2 0 100 4 2 2 0 000-4zm9 0a2 2 0 100 4 2 2 0 000-4z" /></svg>
    Watch the whole film in VR
  </button>
  <p v-if="vrError" class="text-xs text-ivory mb-2">{{ vrError }}</p>
  <ol ref="listEl" class="grid gap-1.5" aria-label="Episodes">
    <li v-for="e in store.episodes" :key="e.ep" :data-ep="e.ep">
      <button
        class="ep w-full text-left flex gap-3 items-center rounded-xl p-1.5 pr-2 border border-transparent"
        :class="{
          'is-current': !store.atEnd && store.currentEpisode?.ep === e.ep,
          'is-open': store.openEpisode === e.ep,
        }"
        @click="store.showEpisode(e.ep)"
        @mouseenter="store.hoverEpisode = e.ep"
        @mouseleave="store.hoverEpisode === e.ep && (store.hoverEpisode = null)"
        @focus="store.hoverEpisode = e.ep"
        @blur="store.hoverEpisode === e.ep && (store.hoverEpisode = null)"
      >
        <div class="thumb relative shrink-0 w-[92px] aspect-video rounded-lg overflow-hidden bg-ink-3 border border-line">
          <img v-if="poster(e.ep)" :src="poster(e.ep)" alt="" loading="lazy" decoding="async" class="w-full h-full object-cover" @error="($event.target as HTMLImageElement).style.display = 'none'" />
          <span class="absolute left-1 top-1 font-pixel text-[10px] px-1 rounded bg-ink/85 text-brass-5">{{ epLabel(e) }}</span>
          <span v-if="e.duration" class="absolute right-1 bottom-1 font-ui text-[11px] px-1 rounded bg-ink/85 text-ivory">{{ fmtDuration(e.duration) }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-display text-[1.2rem] leading-none text-ivory truncate">{{ e.title }}</div>
          <div class="font-ui text-[0.82rem] text-amber mt-1 tracking-wide uppercase">
            {{ dateSpan(e.start, e.end) }}
            <span v-if="epKind(e) === 'epilogue'" class="text-muted"> · Epilogue · at home</span>
            <span v-else-if="epKind(e) === 'intro'" class="text-muted"> · The film's opening</span>
            <span v-if="!playableFormat(e, '16x9') && !playableFormat(e, '9x16')" class="soon">Soon</span>
          </div>
          <div v-if="e.stops?.length" class="text-[0.78rem] text-muted truncate">{{ stopNames(e.stops) }}</div>
        </div>
        <svg class="play shrink-0" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>
      </button>
    </li>
  </ol>
</template>

<style scoped>
.vr-film {
  background: #e6b56a;
  color: #101b23;
}
.vr-film:hover {
  background: #f0c88a;
}
.ep {
  transition: background 0.12s, border-color 0.12s;
}
.ep:hover,
.ep:focus-visible {
  background: #16242e;
  border-color: #22303a;
}
.ep .play {
  color: #4e3312;
  transition: color 0.12s;
}
.ep:hover .play {
  color: #e6b56a;
}
.ep.is-current {
  background: rgb(230 181 106 / 0.08);
  border-color: rgb(174 126 54 / 0.5);
}
.ep.is-open {
  border-color: #e6b56a;
}
.soon {
  margin-left: 0.4rem;
  padding: 0 0.3rem;
  border-radius: 3px;
  border: 1px solid #4e3312;
  color: #ae7e36;
  font-size: 0.7rem;
}
</style>
