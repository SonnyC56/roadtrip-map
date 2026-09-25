<script setup lang="ts">
import { computed } from 'vue'
import { useTripStore, type LayerKey } from '../stores/trip'
import { TYPE_META } from '../lib/typeMeta'
import type { MediaType } from '../lib/manifest'

const props = defineProps<{ vertical?: boolean; counts?: boolean }>()
const store = useTripStore()

const items = computed(() => {
  const out: { key: LayerKey; label: string; color: string; count?: number }[] = [
    { key: 'episodes', label: 'Episodes', color: '#FFF0CC', count: store.episodeCount },
  ]
  for (const t of ['photo', 'video', 'pano', 'pano-video', 'splat', 'xr-scene'] as MediaType[]) {
    const n = store.typeCounts[t] || 0
    // always show the four core types; the immersive extras only if present
    if (!n && (t === 'splat' || t === 'xr-scene')) continue
    out.push({ key: t, label: TYPE_META[t].label, color: TYPE_META[t].color, count: n })
  }
  if (store.medals.length) out.push({ key: 'medals', label: 'Park medals', color: '#DDAA5E', count: store.medals.length })
  if (store.magnets.length) out.push({ key: 'magnets', label: 'Magnets', color: '#AE7E36', count: store.magnets.length })
  return out
})
</script>

<template>
  <div :class="props.vertical ? 'grid gap-1.5' : 'flex gap-1.5'" role="group" aria-label="Map layers">
    <button
      v-for="it in items"
      :key="it.key"
      :class="props.vertical ? 'toggle-row' : 'chip'"
      :aria-pressed="store.layers[it.key]"
      @click="store.setLayer(it.key, !store.layers[it.key])"
    >
      <span class="inline-flex items-center gap-2"><span class="dot" :style="{ background: it.color }"></span>{{ it.label }}</span>
      <span v-if="props.counts && it.count != null" class="font-pixel text-[10px] opacity-80 ml-auto">{{ it.count.toLocaleString('en-US') }}</span>
      <span v-if="props.vertical" class="switch" aria-hidden="true"><i></i></span>
    </button>
  </div>
</template>

<style scoped>
.toggle-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  border-radius: 0.6rem;
  border: 1px solid #22303a;
  background: #0a1116;
  font-family: var(--font-ui);
  font-weight: 600;
  font-size: 0.95rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #a8b6bb;
  transition: border-color 0.12s, color 0.12s;
}
.toggle-row[aria-pressed='true'] {
  color: #f5f1e7;
  border-color: #4e3312;
}
.toggle-row .dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 999px;
}
.toggle-row[aria-pressed='false'] .dot {
  opacity: 0.35;
}
.switch {
  width: 2.1rem;
  height: 1.2rem;
  border-radius: 999px;
  background: #22303a;
  position: relative;
  flex: none;
  transition: background 0.15s;
}
.switch i {
  position: absolute;
  top: 0.15rem;
  left: 0.15rem;
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 999px;
  background: #a8b6bb;
  transition: transform 0.15s, background 0.15s;
}
.toggle-row[aria-pressed='true'] .switch {
  background: #7e5620;
}
.toggle-row[aria-pressed='true'] .switch i {
  transform: translateX(0.9rem);
  background: #f4d38f;
}
</style>
