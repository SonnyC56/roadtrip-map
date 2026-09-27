<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
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
let startTime = 0
let activePointer: number | null = null
let dragged = false
const viewportHeight = ref(window.visualViewport?.height || window.innerHeight)
const sheetEl = ref<HTMLElement | null>(null)
const snaps: Snap[] = ['peek', 'half', 'full']
function resize() { viewportHeight.value = window.visualViewport?.height || window.innerHeight }
onMounted(() => { window.addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize) })
onBeforeUnmount(() => { window.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('resize', resize) })

function snapHeight(s: Snap): number {
  const vh = viewportHeight.value
  if (s === 'peek') return Math.min(172, vh * 0.4)
  if (s === 'half') return Math.round(vh * 0.52)
  return Math.round(vh * 0.9)
}
const height = computed(() => (dragY.value != null ? dragY.value : snapHeight(snap.value)))

watchEffect(() => {
  document.documentElement.style.setProperty('--sheet-h', isMobile.value ? `${Math.min(height.value, viewportHeight.value * 0.52)}px` : '0px')
})

function onDown(e: PointerEvent) {
  if (!e.isPrimary || e.button !== 0) return
  activePointer = e.pointerId
  startTime = performance.now()
  dragged = false
  startY = e.clientY
  startH = height.value
  dragY.value = startH
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onMove(e: PointerEvent) {
  if (dragY.value == null || e.pointerId !== activePointer) return
  dragY.value = Math.max(snapHeight('peek'), Math.min(snapHeight('full'), startH + (startY - e.clientY)))
}
function onUp(e: PointerEvent) {
  if (dragY.value == null || e.pointerId !== activePointer) return
  const h = dragY.value
  const distance = startY - e.clientY
  dragged = Math.abs(distance) > 6
  activePointer = null
  dragY.value = null
  if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  if (!dragged) return
  if (Math.abs(distance) > 18 && Math.abs(distance) / Math.max(1, performance.now() - startTime) > 0.45) {
    stepSnap(distance > 0 ? 1 : -1)
  } else {
    snap.value = snaps.reduce((best, s) => Math.abs(snapHeight(s) - h) < Math.abs(snapHeight(best) - h) ? s : best, 'peek' as Snap)
  }
}
function cancelDrag() { activePointer = null; dragY.value = null; dragged = true }
function stepSnap(direction: number) { snap.value = snaps[Math.max(0, Math.min(2, snaps.indexOf(snap.value) + direction))]! }
function tapHandle(e: MouseEvent) {
  if (!dragged || e.detail === 0) snap.value = snaps[(snaps.indexOf(snap.value) + 1) % 3]!
  dragged = false
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
      <button role="tab" :aria-selected="tab === 'episodes'" @click="pickTab('episodes')">Episodes <span>{{ store.episodeCount }}</span></button>
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
    <div class="sheet-controls shrink-0 flex items-center px-2">
    <button
      type="button"
      class="handle flex-1 min-h-[52px] touch-none cursor-grab select-none flex flex-col items-center justify-center gap-1.5"
      aria-label="Resize trip panel"
      :aria-expanded="snap !== 'peek'"
      aria-controls="mobile-trip-content"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="cancelDrag"
      @lostpointercapture="activePointer != null && cancelDrag()"
      @click="tapHandle"
      @keydown.up.prevent="stepSnap(1)"
      @keydown.down.prevent="stepSnap(-1)"
      @keydown.home.prevent="snap = 'peek'"
      @keydown.end.prevent="snap = 'full'"
    >
      <span class="h-1.5 w-14 rounded-full bg-brass-4"></span>
      <span class="font-ui text-[10px] uppercase tracking-wider text-muted">Drag or tap</span>
    </button>
    <button class="sheet-size" aria-label="Collapse trip panel" :disabled="snap === 'peek'" @click="stepSnap(-1)">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    <button class="sheet-size" aria-label="Expand trip panel" :disabled="snap === 'full'" @click="stepSnap(1)">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 15 6-6 6 6" /></svg>
    </button>
    </div>
    <nav class="tabs px-3" role="tablist">
      <button role="tab" :aria-selected="tab === 'episodes'" @click="pickTab('episodes')">Episodes <span>{{ store.episodeCount }}</span></button>
      <button role="tab" :aria-selected="tab === 'explore'" @click="pickTab('explore')">Explore</button>
    </nav>
    <div id="mobile-trip-content" class="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <EpisodeList v-if="tab === 'episodes'" />
      <ExploreFilters v-else class="px-1" />
    </div>
  </section>
</template>

<style scoped>
.sheet-size { min-width: 44px; min-height: 44px; display: grid; place-items: center; border-radius: 12px; color: #e6b56a; touch-action: manipulation; }
.sheet-size:disabled { opacity: 0.3; }
.sheet-size:not(:disabled):active { background: #22303a; }
.handle:focus-visible, .sheet-size:focus-visible { outline: 2px solid #e6b56a; outline-offset: -3px; }
.handle:active { cursor: grabbing; }
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
