<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useTripStore } from '../stores/trip'
import { useViewport } from '../composables/useViewport'
import BrandHeader from './BrandHeader.vue'
import EpisodeList from './EpisodeList.vue'
import ExploreFilters from './ExploreFilters.vue'

const store = useTripStore()
const { isMobile } = useViewport()
const tab = ref<'episodes' | 'explore'>('episodes')

// ---- mobile bottom sheet ----
type Snap = 'peek' | 'half' | 'full'
const snap = ref<Snap>('peek')
const dragY = ref<number | null>(null) // px offset while dragging
let startY = 0
let startH = 0
const sheetEl = ref<HTMLElement | null>(null)

function snapHeight(s: Snap): number {
  const vh = window.innerHeight
  if (s === 'peek') return 148
  if (s === 'half') return Math.round(vh * 0.52)
  return Math.round(vh * 0.9)
}
const height = computed(() => (dragY.value != null ? dragY.value : snapHeight(snap.value)))

watchEffect(() => {
  document.documentElement.style.setProperty('--sheet-h', isMobile.value ? `${Math.min(height.value, window.innerHeight * 0.52)}px` : '0px')
})

function onDown(e: PointerEvent) {
  startY = e.clientY
  startH = height.value
  dragY.value = startH
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onMove(e: PointerEvent) {
  if (dragY.value == null) return
  dragY.value = Math.max(120, Math.min(window.innerHeight * 0.92, startH + (startY - e.clientY)))
}
function onUp(e: PointerEvent) {
  if (dragY.value == null) return
  const h = dragY.value
  const moved = Math.abs(e.clientY - startY) > 6
  dragY.value = null
  if (!moved) {
    snap.value = snap.value === 'peek' ? 'half' : snap.value === 'half' ? 'full' : 'peek'
    return
  }
  const opts: Snap[] = ['peek', 'half', 'full']
  snap.value = opts.reduce((best, s) => (Math.abs(snapHeight(s) - h) < Math.abs(snapHeight(best) - h) ? s : best), 'peek' as Snap)
}
function pickTab(t: 'episodes' | 'explore') {
  tab.value = t
  if (isMobile.value && snap.value === 'peek') snap.value = 'half'
}
</script>

<template>
  <!-- Desktop: floating left column -->
  <aside v-if="!isMobile" class="panel absolute left-4 top-4 bottom-4 z-[500] w-[var(--panel-w)] rounded-2xl flex flex-col overflow-hidden">
    <div class="px-5 pt-5 pb-4 border-b border-line">
      <BrandHeader />
    </div>
    <nav class="tabs px-3 pt-3" role="tablist">
      <button role="tab" :aria-selected="tab === 'episodes'" @click="pickTab('episodes')">Episodes <span>{{ store.episodes.length }}</span></button>
      <button role="tab" :aria-selected="tab === 'explore'" @click="pickTab('explore')">Explore</button>
    </nav>
    <div class="flex-1 overflow-y-auto px-3 pt-3 pb-4">
      <EpisodeList v-if="tab === 'episodes'" />
      <ExploreFilters v-else class="px-1" />
    </div>
  </aside>

  <!-- Mobile: bottom sheet -->
  <section
    v-else
    ref="sheetEl"
    class="sheet panel fixed inset-x-0 bottom-0 z-[500] rounded-t-2xl flex flex-col"
    :class="{ dragging: dragY != null }"
    :style="{ height: height + 'px' }"
    aria-label="Trip panel"
  >
    <div
      class="handle shrink-0 pt-2 pb-1 touch-none cursor-grab"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <div class="mx-auto h-1.5 w-12 rounded-full bg-brass-2"></div>
    </div>
    <nav class="tabs px-3" role="tablist">
      <button role="tab" :aria-selected="tab === 'episodes'" @click="pickTab('episodes')">Episodes <span>{{ store.episodes.length }}</span></button>
      <button role="tab" :aria-selected="tab === 'explore'" @click="pickTab('explore')">Explore</button>
    </nav>
    <div class="flex-1 overflow-y-auto overscroll-contain px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <EpisodeList v-if="tab === 'episodes'" />
      <ExploreFilters v-else class="px-1" />
    </div>
  </section>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid #22303a;
}
.tabs button {
  flex: 1;
  padding: 0.5rem 0.25rem 0.6rem;
  font-family: var(--font-display);
  font-size: 1.25rem;
  letter-spacing: 0.06em;
  color: #a8b6bb;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.tabs button span {
  font-family: var(--font-pixel);
  font-size: 10px;
  color: #7e5620;
  margin-left: 0.25rem;
}
.tabs button[aria-selected='true'] {
  color: #f5f1e7;
  border-color: #e6b56a;
}
.sheet {
  transition: height 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  border-bottom: 0;
  max-width: 100vw;
}
.sheet.dragging {
  transition: none;
}
</style>
