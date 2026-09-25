<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTripStore } from '../stores/trip'
import { useViewport } from '../composables/useViewport'
import { mediaUrl } from '../lib/manifest'
import { dateSpan, fmtDuration, pad2 } from '../lib/format'

const store = useTripStore()
const { isMobile, isPortrait } = useViewport()

const episode = computed(() => (store.openEpisode != null ? store.episodeByNum.get(store.openEpisode) || null : null))
const idx = computed(() => store.episodes.findIndex((e) => e.ep === store.openEpisode))
const prev = computed(() => (idx.value > 0 ? store.episodes[idx.value - 1] : null))
const next = computed(() => (idx.value >= 0 && idx.value < store.episodes.length - 1 ? store.episodes[idx.value + 1] : null))

type Fmt = '16x9' | '9x16'
const override = ref<Fmt | null>(null)
const autoFmt = computed<Fmt>(() => (isPortrait.value && isMobile.value ? '9x16' : '16x9'))
const fmt = computed<Fmt>(() => {
  const want = override.value || autoFmt.value
  const f = episode.value?.formats
  if (f?.[want]) return want
  return f?.['16x9'] ? '16x9' : '9x16'
})
const source = computed(() => episode.value?.formats[fmt.value] || null)
const hasBoth = computed(() => !!(episode.value?.formats['16x9'] && episode.value?.formats['9x16']))
const video = ref<HTMLVideoElement | null>(null)
const failed = ref(false)

const stops = computed(() =>
  (episode.value?.stops || []).map((id) => store.stopById.get(id)).filter((s): s is NonNullable<typeof s> => !!s),
)

async function toggleFmt() {
  const v = video.value
  const at = v?.currentTime || 0
  const wasPlaying = v && !v.paused
  override.value = fmt.value === '16x9' ? '9x16' : '16x9'
  await nextTick()
  const nv = video.value
  if (nv) {
    const seek = () => {
      nv.currentTime = at
      if (wasPlaying) nv.play().catch(() => {})
    }
    if (nv.readyState >= 1) seek()
    else nv.addEventListener('loadedmetadata', seek, { once: true })
  }
}

function close() {
  store.showEpisode(null)
}

function onKey(e: KeyboardEvent) {
  if (!episode.value || store.lightbox) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowRight' && (e.target as HTMLElement)?.tagName !== 'VIDEO') next.value && store.showEpisode(next.value.ep)
  else if (e.key === 'ArrowLeft' && (e.target as HTMLElement)?.tagName !== 'VIDEO') prev.value && store.showEpisode(prev.value.ep)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

watch(
  () => store.openEpisode,
  () => {
    failed.value = false
  },
)
</script>

<template>
  <Transition name="fade">
    <div
      v-if="episode"
      class="fixed inset-0 z-[1000] flex items-center justify-center bg-ink/80 backdrop-blur-sm p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      :aria-label="`Episode ${episode.ep}: ${episode.title}`"
      @click.self="close"
    >
      <div
        class="player panel w-full flex flex-col overflow-hidden sm:rounded-2xl"
        :class="fmt === '9x16' ? 'is-portrait' : 'is-landscape'"
      >
        <!-- header -->
        <div class="flex items-start gap-3 px-4 pt-3 pb-2">
          <div class="min-w-0 flex-1">
            <div class="font-pixel text-[11px] text-brass-4">EPISODE {{ pad2(episode.ep) }}<span class="text-brass-2"> / {{ store.episodes.length }}</span></div>
            <h2 class="font-display text-[1.9rem] sm:text-[2.3rem] leading-none text-ivory mt-0.5">{{ episode.title }}</h2>
          </div>
          <button class="btn btn-icon shrink-0" aria-label="Close" title="Close (Esc)" @click="close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <!-- video -->
        <div class="stage relative bg-black mx-auto">
          <video
            v-if="source && !failed"
            ref="video"
            :key="`${episode.ep}-${fmt}`"
            class="w-full h-full object-contain bg-black"
            :src="mediaUrl(source.src)"
            :poster="mediaUrl(source.poster)"
            controls
            playsinline
            preload="metadata"
            @error="failed = true"
          ></video>
          <div v-else class="absolute inset-0 grid place-items-center text-center p-6">
            <div>
              <img v-if="source?.poster" :src="mediaUrl(source.poster)" alt="" class="absolute inset-0 w-full h-full object-cover opacity-30" />
              <p class="relative font-display text-2xl text-amber">Coming soon</p>
              <p class="relative text-muted text-sm mt-1">This episode's video isn't uploaded yet.</p>
            </div>
          </div>
        </div>

        <!-- meta -->
        <div class="px-4 pt-3 pb-3 grid grid-cols-1 gap-2 [&>*]:min-w-0">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 font-ui uppercase tracking-wide text-sm">
            <span class="text-amber">{{ dateSpan(episode.start, episode.end) }}</span>
            <span v-if="episode.duration" class="text-muted">{{ fmtDuration(episode.duration) }}</span>
            <span v-if="!store.episodePaths.has(episode.ep)" class="text-muted">Epilogue · at home</span>
            <button v-if="hasBoth" class="chip ml-auto !py-1" :aria-pressed="fmt === '9x16'" :title="`Switch to ${fmt === '16x9' ? 'vertical 9:16' : 'wide 16:9'}`" @click="toggleFmt">
              <svg v-if="fmt === '16x9'" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="3" width="10" height="18" rx="2" /></svg>
              <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="10" rx="2" /></svg>
              {{ fmt === '16x9' ? '9:16' : '16:9' }}
            </button>
          </div>
          <div v-if="stops.length" class="flex flex-wrap gap-1.5">
            <button
              v-for="s in stops"
              :key="s.id"
              class="chip !normal-case !text-[0.85rem]"
              :title="`Show photos from ${s.name}`"
              @click="store.setStop(s.id); close()"
            >
              <span class="dot" style="background: #e6b56a"></span>{{ s.name }}
            </button>
          </div>
          <div class="flex items-center gap-2 pt-1">
            <button class="btn flex-1 sm:flex-none justify-start min-w-0" :disabled="!prev" @click="prev && store.showEpisode(prev.ep)">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M15 5v14L6 12z" /></svg>
              <span class="truncate min-w-0">{{ prev ? `E${pad2(prev.ep)} ${prev.title}` : 'Start' }}</span>
            </button>
            <button class="btn flex-1 sm:flex-none sm:ml-auto justify-end min-w-0" :disabled="!next" @click="next && store.showEpisode(next.ep)">
              <span class="truncate min-w-0">{{ next ? `E${pad2(next.ep)} ${next.title}` : 'The end' }}</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M9 5v14l9-7z" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.player {
  max-height: 100dvh;
}
.player.is-landscape {
  max-width: min(1100px, calc((100dvh - 230px) * 16 / 9));
  min-width: min(100%, 560px);
}
.player.is-landscape .stage {
  width: 100%;
  aspect-ratio: 16 / 9;
}
.player.is-portrait {
  max-width: min(100vw, calc((100dvh - 230px) * 9 / 16 + 2rem), 520px);
}
.player.is-portrait .stage {
  width: 100%;
  aspect-ratio: 9 / 16;
  max-height: calc(100dvh - 230px);
}
@media (max-width: 639px) {
  .player {
    height: 100dvh;
    border-radius: 0;
    max-width: 100vw !important;
    min-width: 0 !important;
  }
  .player .stage {
    flex: 1 1 auto;
    min-height: 0;
    aspect-ratio: auto !important;
    max-height: none !important;
  }
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
