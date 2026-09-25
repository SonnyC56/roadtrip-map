<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useTripStore } from '../stores/trip'
import { shortDate, pad2 } from '../lib/format'

const store = useTripStore()

const SPEEDS = [0.5, 1, 2, 4]
const FULL_TRIP_SECONDS = 48 // whole trip at 1x

const span = computed(() => Math.max(1, store.tEnd - store.tStart))
const pct = computed(() => (store.atEnd ? 100 : ((Math.min(store.t, store.tEnd) - store.tStart) / span.value) * 100))

const ticks = computed(() =>
  store.episodes
    .filter((e) => store.episodePaths.has(e.ep))
    .map((e) => {
      const t0 = Date.parse(`${e.start}T12:00:00-06:00`)
      return { ep: e.ep, title: e.title, left: ((t0 - store.tStart) / span.value) * 100 }
    })
    .filter((x) => x.left >= 0 && x.left <= 100),
)

const dateLabel = computed(() => (store.atEnd ? `ALL ${store.trip.days} DAYS` : shortDate(store.currentLocalDate).toUpperCase()))

let raf = 0
let last = 0
function frame(now: number) {
  if (!store.playing) return
  const dt = last ? Math.min(100, now - last) : 16
  last = now
  const next = store.t + (span.value / (FULL_TRIP_SECONDS * 1000)) * dt * store.speed
  if (next >= store.tEnd) {
    store.setTime(store.tEnd)
    pause()
    return
  }
  store.setTime(next)
  raf = requestAnimationFrame(frame)
}

function play() {
  if (store.atEnd) store.setTime(store.tStart)
  store.playing = true
  last = 0
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(frame)
}
function pause() {
  store.playing = false
  cancelAnimationFrame(raf)
}
function toggle() {
  if (store.playing) pause()
  else play()
}
function restart() {
  store.setTime(store.tStart)
}
function showAll() {
  pause()
  store.setTime(store.tEnd)
}
function jumpDay(d: number) {
  const base = store.atEnd ? store.tEnd : store.t
  store.setTime(base + d * 86_400_000)
}
function cycleSpeed() {
  store.speed = SPEEDS[(SPEEDS.indexOf(store.speed) + 1) % SPEEDS.length] || 1
}

let pending = 0
function onInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  cancelAnimationFrame(pending)
  pending = requestAnimationFrame(() => store.setTime(store.tStart + (v / 1000) * span.value))
}

watch(
  () => store.status,
  () => pause(),
)
onBeforeUnmount(pause)
defineExpose({ toggle })
</script>

<template>
  <div class="tl panel rounded-2xl px-3 pt-2 pb-2.5 sm:px-4">
    <div class="flex items-center gap-1.5 sm:gap-2">
      <button class="btn btn-icon !w-9 !h-9" title="Back to day 1" aria-label="Back to day 1" @click="restart">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
      </button>
      <button class="btn btn-icon !w-9 !h-9 hidden sm:inline-flex" title="Back one day" aria-label="Back one day" @click="jumpDay(-1)">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M11 5v14L3 12zM21 5v14l-8-7z" /></svg>
      </button>
      <button
        class="btn btn-icon btn-amber"
        :title="store.playing ? 'Pause' : 'Play the trip'"
        :aria-label="store.playing ? 'Pause' : 'Play the trip'"
        @click="toggle"
      >
        <svg v-if="!store.playing" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M7 4v16l13-8z" /></svg>
        <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
      </button>
      <button class="btn btn-icon !w-9 !h-9 hidden sm:inline-flex" title="Forward one day" aria-label="Forward one day" @click="jumpDay(1)">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 5v14l8-7zM13 5v14l8-7z" /></svg>
      </button>
      <button class="btn !min-h-9 !px-2 font-pixel !text-[11px] w-12" title="Playback speed" @click="cycleSpeed">{{ store.speed }}x</button>

      <div class="ml-auto flex items-baseline gap-2 min-w-0">
        <span class="font-pixel text-[11px] text-muted hidden sm:inline">DAY</span>
        <span class="font-pixel text-amber text-sm">{{ store.atEnd ? store.trip.days : pad2(store.currentDay) }}</span>
        <span class="font-display text-lg sm:text-xl text-ivory truncate">{{ dateLabel }}</span>
      </div>
      <button v-if="!store.atEnd" class="btn !min-h-8 !px-2 !text-xs" title="Show the whole trip" @click="showAll">All</button>
    </div>

    <div class="relative mt-2 h-6">
      <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-ink-3 overflow-hidden">
        <div class="h-full rounded-full" :style="{ width: pct + '%', background: 'linear-gradient(90deg,#7E5620,#AE7E36 40%,#E6B56A)' }"></div>
      </div>
      <span
        v-for="tk in ticks"
        :key="tk.ep"
        class="tick absolute top-1/2 -translate-y-1/2 w-px h-3 bg-brass-3/70 pointer-events-none"
        :style="{ left: tk.left + '%' }"
      ></span>
      <input
        class="tl-range absolute inset-0 w-full"
        type="range"
        min="0"
        max="1000"
        step="1"
        :value="Math.round(pct * 10)"
        aria-label="Trip timeline"
        @input="onInput"
        @pointerdown="pause"
      />
    </div>
  </div>
</template>

<style scoped>
.tl-range {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  margin: 0;
  height: 24px;
  cursor: pointer;
}
.tl-range::-webkit-slider-runnable-track {
  background: transparent;
  height: 24px;
}
.tl-range::-moz-range-track {
  background: transparent;
  height: 24px;
}
.tl-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  margin-top: 3px;
  border-radius: 4px;
  background: #fff0cc;
  border: 2px solid #e6b56a;
  box-shadow: 0 0 10px rgb(230 181 106 / 0.7);
  transform: rotate(45deg);
}
.tl-range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: #fff0cc;
  border: 2px solid #e6b56a;
  box-shadow: 0 0 10px rgb(230 181 106 / 0.7);
  transform: rotate(45deg);
}
</style>
