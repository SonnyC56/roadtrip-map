<script setup lang="ts">
// 360 photos: photo-sphere-viewer + equirectangular TILES adapter (preview first, full-res tiles on demand).
// 360 videos: photo-sphere-viewer + equirectangular VIDEO adapter + video plugin.
// Both: drag / pinch to look around, gyroscope on phones, fullscreen.
// Loaded lazily (defineAsyncComponent) so none of this ships with the map.
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Viewer } from '@photo-sphere-viewer/core'
import '@photo-sphere-viewer/core/index.css'
import type { VideoPlugin as VideoPluginT } from '@photo-sphere-viewer/video-plugin'
import { mediaUrl, type Media } from '../lib/manifest'
import { enterVR, xrSupported } from '../lib/xr'
import { useTripStore } from '../stores/trip'
const store = useTripStore()

const props = defineProps<{ item: Media }>()
const emit = defineEmits<{ error: [string]; unsupported: [] }>()

const host = ref<HTMLDivElement | null>(null)
const viewer = shallowRef<Viewer | null>(null)
const loading = ref(true)
const failed = ref('')
let VideoPluginClass: typeof VideoPluginT | null = null

// ---- headset: hand the current item (and view direction / video position) to the WebXR viewer ----
const vrError = ref('')
function onEnterVR() {
  const m = props.item
  const v = viewer.value
  const video = m.type === 'pano-video' && v && VideoPluginClass ? v.getPlugin<VideoPluginT>(VideoPluginClass) : null
  const title = m.caption || (m.stop != null && store.stopById.get(m.stop)?.name) || 'Roadtrip 360'
  const p = m.pano
  // no awaits before enterVR: the session must be requested inside the click gesture
  enterVR(
    m.type === 'pano-video'
      ? { kind: 'video', title, src: mediaUrl(m.src), poster: mediaUrl(m.poster) || undefined, startAt: video?.getTime() || 0, yaw: v?.getPosition().yaw }
      : {
          kind: 'image',
          title,
          src: mediaUrl(p?.preview || m.src),
          yaw: v?.getPosition().yaw,
          tiles: p
            ? { cols: p.cols, rows: p.rows, width: p.width, url: (c, r) => mediaUrl(p.tiles.replace('{col}', String(c)).replace('{row}', String(r))) }
            : undefined,
        },
  )
    .then(() => video?.pause())
    .catch((e) => {
      console.warn('[vr] session failed', e)
      vrError.value = 'VR could not start.'
      setTimeout(() => (vrError.value = ''), 3000)
    })
}

async function build() {
  destroy()
  if (!host.value) return
  loading.value = true
  failed.value = ''
  const m = props.item
  try {
    const { GyroscopePlugin } = await import('@photo-sphere-viewer/gyroscope-plugin')
    if (m.type === 'pano-video') {
      const [{ EquirectangularVideoAdapter }, { VideoPlugin }] = await Promise.all([
        import('@photo-sphere-viewer/equirectangular-video-adapter'),
        import('@photo-sphere-viewer/video-plugin'),
      ])
      VideoPluginClass = VideoPlugin
      await import('@photo-sphere-viewer/video-plugin/index.css')
      viewer.value = new Viewer({
        container: host.value,
        adapter: [EquirectangularVideoAdapter, { autoplay: true, muted: false }],
        panorama: { source: mediaUrl(m.src) },
        loadingImg: undefined,
        defaultZoomLvl: 20,
        touchmoveTwoFingers: false,
        mousewheelCtrlKey: false,
        navbar: ['videoPlay', 'videoVolume', 'videoTime', 'zoom', 'gyroscope', 'fullscreen'],
        plugins: [
          [VideoPlugin, { progressbar: true, bigbutton: true }],
          [GyroscopePlugin, { touchmove: true }],
        ],
      })
    } else {
      const { EquirectangularTilesAdapter } = await import('@photo-sphere-viewer/equirectangular-tiles-adapter')
      const p = m.pano
      const panorama = p
        ? {
            width: p.width,
            cols: p.cols,
            rows: p.rows,
            baseUrl: mediaUrl(p.preview),
            tileUrl: (col: number, row: number) =>
              mediaUrl(p.tiles.replace('{col}', String(col)).replace('{row}', String(row))),
          }
        : null
      viewer.value = new Viewer({
        container: host.value,
        adapter: panorama ? [EquirectangularTilesAdapter, { showErrorTile: true, baseBlur: true }] : undefined,
        // no tile info → fall back to the plain equirectangular image
        panorama: panorama ?? mediaUrl(m.src),
        defaultZoomLvl: 20,
        touchmoveTwoFingers: false,
        mousewheelCtrlKey: false,
        navbar: ['zoom', 'move', 'gyroscope', 'fullscreen'],
        plugins: [[GyroscopePlugin, { touchmove: true }]],
      })
    }
    // PSV catches a WebGL failure itself (shows an overlay, no throw) and leaves no renderer behind
    if (!(viewer.value as unknown as { renderer?: unknown }).renderer) throw new Error('WebGL unavailable')
    viewer.value.addEventListener('ready', () => (loading.value = false), { once: true })
    viewer.value.addEventListener('panorama-error', () => {
      failed.value = 'Could not load this 360 view.'
      loading.value = false
      emit('error', failed.value)
    })
  } catch (e) {
    console.warn('[360] viewer could not start, falling back to flat view', e)
    destroy()
    loading.value = false
    emit('unsupported')
  }
}

function destroy() {
  viewer.value?.destroy()
  viewer.value = null
}

onMounted(build)
watch(() => props.item.id, build)
onBeforeUnmount(destroy)
</script>

<template>
  <div class="relative w-full h-full bg-black">
    <div ref="host" class="absolute inset-0"></div>
    <div v-if="loading && !failed" class="absolute inset-0 grid place-items-center pointer-events-none">
      <img v-if="item.pano?.preview || item.poster" :src="mediaUrl(item.pano?.preview || item.poster)" alt="" class="absolute inset-0 w-full h-full object-cover opacity-40" />
      <span class="relative font-pixel text-xs text-amber bg-ink/80 px-2 py-1 rounded">LOADING 360…</span>
    </div>
    <div v-if="failed" class="absolute inset-0 grid place-items-center text-center p-6 text-muted">{{ failed }}</div>
    <div class="hint absolute left-1/2 top-3 -translate-x-1/2 font-ui text-xs uppercase tracking-widest text-ivory/80 bg-ink/60 rounded-full px-3 py-1 pointer-events-none">
      Drag to look around
    </div>
    <button
      v-if="xrSupported && !failed"
      class="vr-btn absolute left-3 top-3 z-10 inline-flex items-center gap-2 font-ui text-sm uppercase tracking-widest rounded-full px-4 py-2"
      title="View in your VR headset"
      @click="onEnterVR"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M3 7h18a1 1 0 011 1v8a1 1 0 01-1 1h-5.2l-2-2.6a2.25 2.25 0 00-3.6 0L8.2 17H3a1 1 0 01-1-1V8a1 1 0 011-1zm4.5 3a2 2 0 100 4 2 2 0 000-4zm9 0a2 2 0 100 4 2 2 0 000-4z" /></svg>
      Enter VR
    </button>
    <div v-if="vrError" class="absolute left-3 top-14 z-10 font-ui text-xs text-ivory bg-ink/80 rounded px-2 py-1">{{ vrError }}</div>
  </div>
</template>

<style scoped>
.hint {
  animation: hint-out 4s forwards;
}
@keyframes hint-out {
  0%,
  70% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
.vr-btn {
  background: #e6b56a;
  color: #101b23;
  box-shadow: 0 2px 12px rgb(0 0 0 / 0.4);
}
.vr-btn:hover {
  background: #f0c88a;
}
:deep(.psv-container) {
  background: #000;
}
:deep(.psv-navbar) {
  background: rgb(16 27 35 / 0.85);
}
:deep(.psv-button:hover),
:deep(.psv-button--active) {
  color: #e6b56a;
}
:deep(.psv-video-progressbar__progress) {
  background: #e6b56a;
}
</style>
