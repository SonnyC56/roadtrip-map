<script setup lang="ts">
import { computed } from 'vue'
import { useTripStore } from '../stores/trip'
import { pad2 } from '../lib/format'

defineProps<{ compact?: boolean }>()
const store = useTripStore()

const day = computed(() => (store.atEnd ? store.trip.days : store.currentDay))
const miles = computed(() => store.currentMiles.toLocaleString('en-US'))
const ep = computed(() => {
  if (store.atEnd) return store.episodes.length ? pad2(store.episodes[store.episodes.length - 1]!.ep) : '--'
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
        <p v-if="!compact" class="font-ui text-muted text-sm tracking-wide mt-1">{{ store.trip.tagline }}</p>
      </div>
    </div>

    <dl class="counters flex gap-1.5" :class="compact ? 'ml-auto' : 'w-full mt-1'">
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
