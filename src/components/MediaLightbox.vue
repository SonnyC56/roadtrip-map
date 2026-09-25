<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTripStore } from '../stores/trip'
import { mediaUrl, toLegacyItem } from '../lib/manifest'
import { TYPE_META, LOC_NOTE } from '../lib/typeMeta'
import { localDateTime, pad2 } from '../lib/format'
const dateOnly = (d: string) => (d ? localDateTime(d) : '')

const Media360Viewer = defineAsyncComponent(() => import('./Media360Viewer.vue'))
import Flat360 from './Flat360.vue'
import { hasWebGL2, markWebGLUnavailable } from '../lib/webgl'
const StorySplatViewer = defineAsyncComponent(() => import('./StorySplatViewer.vue'))
const XRGalleryViewer = defineAsyncComponent(() => import('./XRGalleryViewer.vue'))

const store = useTripStore()
const lb = computed(() => store.lightbox)
const item = computed(() => (lb.value ? lb.value.list[lb.value.index] || null : null))
const meta = computed(() => (item.value ? TYPE_META[item.value.type] : null))
const hasPrev = computed(() => !!lb.value && lb.value.index > 0)
const hasNext = computed(() => !!lb.value && lb.value.index < lb.value.list.length - 1)
const stop = computed(() => (item.value?.stop != null ? store.stopById.get(item.value.stop) : undefined))
const episode = computed(() => (item.value?.episode != null ? store.episodeByNum.get(item.value.episode) : undefined))
const locNote = computed(() => (item.value && item.value.loc && item.value.loc !== 'gps' ? LOC_NOTE[item.value.loc] || 'Approximate location' : ''))
const isImmersive = computed(() => item.value?.type === 'splat' || item.value?.type === 'xr-scene')
const legacy = computed(() => (item.value && isImmersive.value ? toLegacyItem(item.value) : null))
const legacyList = computed(() => (legacy.value ? [legacy.value] : []))

// 360 needs WebGL 2; without it (or if the viewer fails to start) show the flat equirect instead
const flat360 = ref(false)
function on360Unsupported() {
  markWebGLUnavailable()
  flat360.value = true
}

const imgLoaded = ref(false)
const imgFailed = ref(false)
watch(item, () => {
  imgLoaded.value = false
  imgFailed.value = false
  preloadNeighbours()
})

function preloadNeighbours() {
  const l = lb.value
  if (!l) return
  for (const d of [1, -1]) {
    const n = l.list[l.index + d]
    if (n && n.type === 'photo') {
      const im = new Image()
      im.src = mediaUrl(n.src)
    }
  }
}

function close() {
  store.closeMedia()
}
function prev() {
  store.stepMedia(-1)
}
function next() {
  store.stepMedia(1)
}
function openEpisode() {
  if (!episode.value) return
  const ep = episode.value.ep
  close()
  store.showEpisode(ep)
}
function showOnMap() {
  if (!item.value) return
  store.focusOn([[item.value.lat, item.value.lon]])
  close()
}

function onKey(e: KeyboardEvent) {
  if (!item.value || isImmersive.value) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowLeft' && item.value.type !== 'pano' && item.value.type !== 'pano-video') prev()
  else if (e.key === 'ArrowRight' && item.value.type !== 'pano' && item.value.type !== 'pano-video') next()
}

// swipe (photos / videos only; 360 uses drag to look around)
let sx = 0
let sy = 0
function onTouchStart(e: TouchEvent) {
  sx = e.touches[0]!.clientX
  sy = e.touches[0]!.clientY
}
function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0]!.clientX - sx
  const dy = e.changedTouches[0]!.clientY - sy
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? next : prev)()
  else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) close()
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <!-- Sonny's immersive viewers bring their own full-screen chrome -->
  <component
    :is="item?.type === 'splat' ? StorySplatViewer : XRGalleryViewer"
    v-if="item && isImmersive && legacy"
    :media-item="legacy"
    :all-media="legacyList"
    :current-index="0"
    @close="close"
    @next="next"
    @previous="prev"
  />

  <Transition name="fade">
    <div
      v-if="item && !isImmersive"
      class="lb fixed inset-0 z-[1100] bg-ink flex flex-col"
      role="dialog"
      aria-modal="true"
      :aria-label="meta?.short"
    >
      <!-- top bar -->
      <div class="flex items-center gap-2 px-3 sm:px-4 py-2 shrink-0">
        <span class="chip !py-1" :style="{ color: meta?.color }"><span class="dot" :style="{ background: meta?.color }"></span>{{ meta?.short }}</span>
        <span class="font-pixel text-[11px] text-muted">{{ (lb!.index + 1).toLocaleString('en-US') }} / {{ lb!.list.length.toLocaleString('en-US') }}</span>
        <button class="btn btn-icon ml-auto" aria-label="Close" title="Close (Esc)" @click="close">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <!-- stage -->
      <div class="relative flex-1 min-h-0" @touchstart.passive="onTouchStart" @touchend="item.type === 'photo' || item.type === 'video' ? onTouchEnd($event) : undefined">
        <template v-if="item.type === 'photo'">
          <img
            v-if="item.thumb && !imgLoaded"
            :src="mediaUrl(item.thumb)"
            alt=""
            class="absolute inset-0 m-auto max-w-full max-h-full object-contain blur-sm opacity-70"
            :style="{ aspectRatio: item.w && item.h ? `${item.w}/${item.h}` : undefined }"
          />
          <img
            :key="item.id"
            :src="mediaUrl(item.src)"
            :alt="item.caption || `Photo from ${stop?.name || 'the trip'}`"
            class="absolute inset-0 m-auto max-w-full max-h-full object-contain transition-opacity duration-200"
            :class="imgLoaded ? 'opacity-100' : 'opacity-0'"
            decoding="async"
            @load="imgLoaded = true"
            @error="imgFailed = true"
          />
          <p v-if="imgFailed" class="absolute inset-0 grid place-items-center text-muted">This photo couldn't be loaded.</p>
        </template>

        <video
          v-else-if="item.type === 'video'"
          :key="item.id"
          class="absolute inset-0 w-full h-full object-contain bg-black"
          :src="mediaUrl(item.src)"
          :poster="mediaUrl(item.poster || item.thumb)"
          controls
          autoplay
          playsinline
          preload="metadata"
        ></video>

        <template v-else-if="item.type === 'pano' || item.type === 'pano-video'">
          <Media360Viewer v-if="!flat360 && hasWebGL2()" :key="item.id" :item="item" class="absolute inset-0" @unsupported="on360Unsupported" />
          <Flat360 v-else :item="item" class="absolute inset-0" />
        </template>

        <!-- side arrows -->
        <button v-if="hasPrev" class="nav left-2 sm:left-4" :class="{ mid: item.type === 'pano' || item.type === 'pano-video' }" aria-label="Previous" title="Previous (←)" @click="prev">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <button v-if="hasNext" class="nav right-2 sm:right-4" :class="{ mid: item.type === 'pano' || item.type === 'pano-video' }" aria-label="Next" title="Next (→)" @click="next">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <!-- caption -->
      <div class="shrink-0 px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-line bg-ink">
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span class="font-display text-xl sm:text-2xl text-ivory leading-tight">{{ stop?.name || 'On the road' }}</span>
          <span class="font-ui text-sm text-amber uppercase tracking-wide">{{ item.local_time || item.time_utc ? localDateTime((item.local_time || item.time_utc)!) : dateOnly(item.day) }}</span>
        </div>
        <p v-if="item.caption" class="text-sm text-ivory/90 mt-1">{{ item.caption }}</p>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted">
          <span v-if="locNote" class="inline-flex items-center gap-1">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6a2.5 2.5 0 010 5.5z" /></svg>
            {{ locNote }}
          </span>
          <button v-if="episode" class="underline decoration-brass-2 underline-offset-2 hover:text-amber" @click="openEpisode">
            Watch episode {{ pad2(episode.ep) }} · {{ episode.title }}
          </button>
          <button class="underline decoration-brass-2 underline-offset-2 hover:text-amber" @click="showOnMap">Show on map</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgb(16 27 35 / 0.75);
  border: 1px solid #22303a;
  color: #f5f1e7;
  z-index: 5;
  transition: background 0.12s, color 0.12s;
}
.nav:hover {
  background: #e6b56a;
  color: #101b23;
}
@media (hover: none) {
  .nav:not(.mid) {
    top: auto;
    bottom: 12px;
    transform: none;
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
