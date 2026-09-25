<script setup lang="ts">
import { computed } from 'vue'
import { useTripStore } from '../stores/trip'
import { pad2 } from '../lib/format'

defineProps<{ compact?: boolean }>()
const store = useTripStore()

const day = computed(() => (store.atEnd ? store.trip.days : store.currentDay))
const miles = computed(() => store.currentMiles.toLocaleString('en-US'))
const ep = computed(() => {
  if (store.atEnd) return store.episodeCount ? pad2(store.episodes[store.episodes.length - 1]!.ep) : '--'
  return store.currentEpisode ? pad2(store.currentEpisode.ep) : '--'
})
</script>

<template>
  <header class="flex items-center gap-3 min-w-0" :class="compact ? '' : 'flex-wrap'">
    <div class="flex items-center gap-2.5 min-w-0">

      <div class="min-w-0 leading-none">
        <h1 v-if="compact" class="font-display text-ivory leading-[0.85]">
          <span class="block text-[0.8rem] text-muted tracking-[0.2em]">SONNY'S</span>
          <span class="text-[1.45rem] whitespace-nowrap">ROADTRIP <span class="text-amber">2025</span></span>
        </h1>
        <h1 v-else class="font-display text-ivory truncate text-[2.1rem]">SONNY'S ROADTRIP <span class="text-amber">2025</span></h1>
        <p v-if="!compact" class="font-ui text-muted text-sm tracking-wide mt-1 flex items-center gap-2 flex-wrap">
          {{ store.trip.tagline }}
          <button v-if="store.intro" class="intro-btn" @click="store.showEpisode(store.intro.ep)">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>
            Watch the intro
          </button>
        </p>
      </div>
    </div>

    <button v-if="compact && store.intro" class="intro-btn intro-icon ml-auto" aria-label="Watch the intro" title="Watch the intro" @click="store.showEpisode(store.intro.ep)">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>
    </button>
    <dl class="counters flex gap-1.5" :class="compact ? (store.intro ? '' : 'ml-auto') : 'w-full mt-1'">
      <div class="plate">
        <dt>DAY</dt>
        <dd>{{ pad2(day) }}<small>/{{ store.trip.days }}</small></dd>
      </div>
      <div class="plate" :class="compact ? '' : 'flex-1'">
        <dt>MILES</dt>
        <dd>{{ miles }}</dd>
      </div>
      <div v-if="!compact" class="plate">
        <dt>EP</dt>
        <dd>{{ ep }}</dd>
      </div>
    </dl>
  </header>
</template>

<style scoped>
.intro-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  border: 1px solid #7e5620;
  color: #f4d38f;
  font-family: var(--font-ui);
  font-weight: 600;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: background 0.12s, color 0.12s;
}
.intro-btn:hover {
  background: #e6b56a;
  color: #101b23;
}
.intro-icon {
  width: 2rem;
  height: 2rem;
  padding: 0;
  justify-content: center;
  flex: none;
}
.plate {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  padding: 0.35rem 0.55rem;
  border-radius: 6px;
  background: #0a1116;
  border: 1px solid #4e3312;
  box-shadow: inset 0 0 0 1px rgb(174 126 54 / 0.18);
  font-family: var(--font-pixel);
  -webkit-font-smoothing: none;
}
.plate dt {
  font-size: 9px;
  color: #ae7e36;
  letter-spacing: 0.08em;
}
.plate dd {
  margin: 0;
  font-size: 13px;
  color: #f4d38f;
  font-variant-numeric: tabular-nums;
}
.plate small {
  font-size: 9px;
  color: #7e5620;
}
</style>
