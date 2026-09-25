<script setup lang="ts">
import { computed } from 'vue'
import { useTripStore } from '../stores/trip'
import LayerChips from './LayerChips.vue'
import { dateSpan } from '../lib/format'

const store = useTripStore()

const shown = computed(() => store.visibleCount)
const total = computed(() => store.media.length)
const filtersActive = computed(
  () => !!store.dateFrom || !!store.dateTo || store.stopFilter != null || !store.atEnd || Object.values(store.layers).some((v) => !v),
)

function onStop(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  store.setStop(v === '' ? null : Number(v))
}
function onDate(which: 'from' | 'to', e: Event) {
  const v = (e.target as HTMLInputElement).value || null
  if (which === 'from') store.dateFrom = v
  else store.dateTo = v
}
</script>

<template>
  <div class="grid gap-5">
    <section>
      <h3 class="label">Layers</h3>
      <LayerChips vertical counts />
    </section>

    <section>
      <h3 class="label">Stop</h3>
      <select class="field w-full" :value="store.stopFilter ?? ''" aria-label="Filter by stop" @change="onStop">
        <option value="">All stops</option>
        <option v-for="s in store.stops" :key="s.id" :value="s.id">
          {{ s.name }} — {{ dateSpan(s.start, s.end) }} ({{ store.stopCounts.get(s.id) || 0 }})
        </option>
      </select>
    </section>

    <section>
      <h3 class="label">Dates</h3>
      <div class="grid grid-cols-2 gap-2">
        <label class="grid gap-1 text-xs text-muted font-ui uppercase tracking-wider">
          From
          <input class="field" type="date" :min="store.trip.start" :max="store.trip.end" :value="store.dateFrom ?? ''" @change="onDate('from', $event)" />
        </label>
        <label class="grid gap-1 text-xs text-muted font-ui uppercase tracking-wider">
          To
          <input class="field" type="date" :min="store.trip.start" :max="store.trip.end" :value="store.dateTo ?? ''" @change="onDate('to', $event)" />
        </label>
      </div>
    </section>

    <section class="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-2 px-3 py-2.5">
      <p class="font-ui text-sm text-muted">
        Showing <b class="text-ivory font-pixel text-xs">{{ shown.toLocaleString('en-US') }}</b> of
        <span class="font-pixel text-xs">{{ total.toLocaleString('en-US') }}</span> photos &amp; videos
      </p>
      <button class="btn !min-h-8 !text-xs" :disabled="!filtersActive" @click="store.resetFilters()">Reset</button>
    </section>

    <section v-if="store.isFixture || store.manifestMissing || store.routeSource === 'fallback'" class="note">
      <p v-if="store.manifestMissing">The media manifest isn't published yet, so only the route is shown.</p>
      <p v-else-if="store.isFixture">Preview data: this is a stand-in manifest with placeholder media.</p>
      <p v-if="store.routeSource === 'fallback'">Route drawn from the bundled Google timeline (route.json not found).</p>
    </section>
  </div>
</template>

<style scoped>
.label {
  font-family: var(--font-ui);
  font-weight: 700;
  font-size: 0.8rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #ae7e36;
  margin-bottom: 0.5rem;
}
.field {
  background: #0a1116;
  border: 1px solid #22303a;
  border-radius: 0.5rem;
  color: #f5f1e7;
  padding: 0.5rem 0.6rem;
  font-family: var(--font-body);
  font-size: 0.9rem;
  min-width: 0;
  color-scheme: dark;
}
.field:focus {
  border-color: #ae7e36;
  outline: none;
}
.note {
  border-left: 3px solid #e6b56a;
  background: #0a1116;
  padding: 0.6rem 0.8rem;
  border-radius: 6px;
  font-size: 0.82rem;
  color: #a8b6bb;
  display: grid;
  gap: 0.3rem;
}
</style>
