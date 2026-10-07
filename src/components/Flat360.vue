<script setup lang="ts">
// Fallback when 360 can't run (no WebGL 2 / viewer failed): the equirectangular image or video shown flat.
// Photos are full-height and pan horizontally (scroll, swipe or drag); videos play in a normal <video>.
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useVideoAnalytics } from '../composables/useVideoAnalytics'
import { mediaContext } from '../lib/mediaAnalytics'
import { useTripStore } from '../stores/trip'
import { mediaUrl, type Media } from '../lib/manifest'

const props = defineProps<{ item: Media; continuous?: boolean }>()
const emit = defineEmits<{ ended: [id: string] }>()
const scroller = ref<HTMLDivElement | null>(null)
const video = ref<HTMLVideoElement | null>(null)
const store = useTripStore()
useVideoAnalytics(video, computed(() => ({ ...mediaContext(props.item, store.episodes, props.continuous), mode: 'fallback' })))

function center() {
  const el = scroller.value
  if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
}
onMounted(() => nextTick(center))
watch(() => props.item.id, () => nextTick(center))

// mouse drag to pan (touch already scrolls natively)
let dragX: number | null = null
let startLeft = 0
function down(e: PointerEvent) {
  if (e.pointerType !== 'mouse' || !scroller.value) return
  dragX = e.clientX
  startLeft = scroller.value.scrollLeft
  scroller.value.setPointerCapture(e.pointerId)
}
function move(e: PointerEvent) {
  if (dragX == null || !scroller.value) return
  scroller.value.scrollLeft = startLeft - (e.clientX - dragX)
}
function up() {
  dragX = null
}
</script>

<template>
  <div class="relative w-full h-full bg-black flex flex-col">
    <video
      v-if="item.type === 'pano-video'"
      ref="video"
      :key="continuous ? 'film360' : item.id"
      class="flex-1 min-h-0 w-full object-contain bg-black"
      :src="mediaUrl(item.src)"
      :poster="mediaUrl(item.poster || item.thumb)"
      controls
      autoplay
      playsinline
      preload="metadata"
      @ended="emit('ended', item.id)"
    ></video>
    <div
      v-else
      ref="scroller"
      class="flat-scroll flex-1 min-h-0 overflow-x-auto overflow-y-hidden cursor-grab active:cursor-grabbing"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="up"
    >
      <img
        :key="item.id"
        :src="mediaUrl(item.pano?.preview || item.src)"
        alt="360 photo shown flat"
        class="h-full w-auto max-w-none select-none"
        draggable="false"
        @load="center"
      />
    </div>
    <p class="note absolute left-1/2 top-3 -translate-x-1/2 max-w-[92%] text-center font-ui text-[0.8rem] tracking-wide px-3 py-1 rounded-full pointer-events-none">
      360 view needs WebGL / hardware acceleration — showing flat version
    </p>
  </div>
</template>

<style scoped>
.note {
  background: rgb(16 27 35 / 0.88);
  border: 1px solid #7e5620;
  color: #f4d38f;
}
.flat-scroll {
  scrollbar-color: #7e5620 transparent;
}
</style>
