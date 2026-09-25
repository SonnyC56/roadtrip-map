<script setup lang="ts">
import { computed } from 'vue'
import { useTripStore, type LayerKey } from '../stores/trip'
import { TYPE_META } from '../lib/typeMeta'
import type { MediaType } from '../lib/manifest'

const props = defineProps<{ vertical?: boolean; counts?: boolean }>()
const store = useTripStore()

const items = computed(() => {
  const out: { key: LayerKey; label: string; color: string; count?: number }[] = [
    { key: 'episodes', label: 'Episodes', color: '#FFF0CC', count: store.episodes.length },
  ]
  for (const t of ['photo', 'video', 'pano', 'pano-video', 'splat', 'xr-scene'] as MediaType[]) {
    const n = store.typeCounts[t] || 0
    // always show the four core types; the immersive extras only if present
    if (!n && (t === 'splat' || t === 'xr-scene')) continue
    out.push({ key: t, label: TYPE_META[t].label, color: TYPE_META[t].color, count: n })
  }
  if (store.magnets.length) out.push({ key: 'magnets', label: 'Magnets', color: '#AE7E36', count: store.magnets.length })
  return out
})
</script>

<template>
  <div :class="props.vertical ? 'grid gap-1.5' : 'flex gap-1.5'" role="group" aria-label="Map layers">
    <button
      v-for="it in items"
      :key="it.key"
      class="chip"
      :class="props.vertical ? 'justify-between !py-2 !text-[0.95rem]' : ''"
      :aria-pressed="store.layers[it.key]"
      @click="store.setLayer(it.key, !store.layers[it.key])"
    >
      <span class="inline-flex items-center gap-2"><span class="dot" :style="{ background: it.color }"></span>{{ it.label }}</span>
      <span v-if="props.counts && it.count != null" class="font-pixel text-[10px] opacity-80">{{ it.count.toLocaleString('en-US') }}</span>
    </button>
  </div>
</template>
