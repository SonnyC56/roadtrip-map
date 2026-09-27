<script setup lang="ts">
// 360 photos: photo-sphere-viewer + equirectangular TILES adapter (preview first, full-res tiles on demand).
// 360 videos: photo-sphere-viewer + equirectangular VIDEO adapter + video plugin.
// Both: drag / pinch to look around, gyroscope on phones, fullscreen.
// Loaded lazily (defineAsyncComponent) so none of this ships with the map.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Viewer } from '@photo-sphere-viewer/core'
import '@photo-sphere-viewer/core/index.css'
import type { VideoPlugin as VideoPluginT } from '@photo-sphere-viewer/video-plugin'
import { mediaUrl, type Media } from '../lib/manifest'
import { textureUrl } from '../lib/textureUrl'
import { enterVR, enterVRPlaylist, episodePlaylist, xrSupported, type VRItem } from '../lib/xr'
import { useTripStore } from '../stores/trip'
const store = useTripStore()

const props = defineProps<{ item: Media; continuous?: boolean }>()
const emit = defineEmits<{ error: [string]; unsupported: []; ended: [id: string]; fullscreen: [] }>()

const host = ref<HTMLDivElement | null>(null)
const viewer = shallowRef<Viewer | null>(null)
const loading = ref(true)
const failed = ref('')
let VideoPluginClass: typeof VideoPluginT | null = null
let generation = 0
let mediaVideo: HTMLVideoElement | null = null
let watchdog: ReturnType<typeof setTimeout> | undefined
let videoEvents: AbortController | null = null
let playAttempt = 0
const needsPlay = ref(false)
const canPlay = ref(false)
const playMessage = ref('')
const preview = computed(() => props.item.type === 'pano'
  ? textureUrl(props.item.pano?.preview || props.item.src)
  : mediaUrl(props.item.poster || props.item.thumb))

function play(unmute = true) {
  const video = mediaVideo
  if (!video) return
  const attempt = ++playAttempt
  playMessage.value = ''
  // Keep this synchronous with the tap: iOS requires a user gesture for sound.
  if (unmute) video.muted = false
  video.play().catch(() => {
    if (video !== mediaVideo || attempt !== playAttempt) return
    needsPlay.value = true
    playMessage.value = 'Tap Play to start this video.'
  })
}

// ---- headset: hand the current item (and view direction / video position) to the WebXR viewer ----
const vrError = ref('')
function titleOf(m: Media) {
  return m.caption || (m.stop != null && store.stopById.get(m.stop)?.name) || 'Roadtrip 360'
}
function onEnterVR() {
  const m = props.item
  const v = viewer.value
  const video = m.type === 'pano-video' && v && VideoPluginClass ? v.getPlugin<VideoPluginT>(VideoPluginClass) : null
  const title = titleOf(m)
  const p = m.pano
  // 360 videos: the lightbox's list (current filters, time order) becomes the in-VR playlist
  const clips = m.type === 'pano-video' ? (store.lightbox?.list || [m]).filter((x) => x.type === 'pano-video') : []
  if (!clips.includes(m)) clips.splice(0, clips.length, m)
  const items: VRItem[] = props.continuous ? episodePlaylist(store.episodes) : clips.map((x) => ({
    id: x.id,
    label: new Date(`${x.day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(),
    title: titleOf(x),
    src: textureUrl(x.src),
    poster: mediaUrl(x.poster) || undefined,
    duration: x.duration,
  }))
  // no awaits before enterVR: the session must be requested inside the click gesture
  ;(m.type === 'pano-video'
    ? enterVRPlaylist(items, props.continuous ? items.findIndex(x => x.id === `ep${m.episode}`) : clips.indexOf(m), props.continuous ? 'Episodes' : '360 clips', video?.getTime() || 0, v?.getPosition().yaw)
    : enterVR({
        kind: 'image',
        title,
        src: textureUrl(p?.preview || m.src),
        yaw: v?.getPosition().yaw,
        tiles: p
          ? { cols: p.cols, rows: p.rows, width: p.width, url: (c, r) => textureUrl(p.tiles.replace('{col}', String(c)).replace('{row}', String(r))) }
          : undefined,
      })
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
  const token = generation
  const current = () => token === generation && !!host.value
  loading.value = true
  failed.value = ''
  canPlay.value = false
  needsPlay.value = false
  playMessage.value = ''
  const m = props.item
  function fail(message: string) {
    if (!current()) return
    clearTimeout(watchdog)
    failed.value = message
    loading.value = false
    emit('error', message)
  }
  try {
    const { GyroscopePlugin } = await import('@photo-sphere-viewer/gyroscope-plugin')
    if (!current()) return
    if (m.type === 'pano-video') {
      const [{ EquirectangularVideoAdapter }, { VideoPlugin }] = await Promise.all([
        import('@photo-sphere-viewer/equirectangular-video-adapter'),
        import('@photo-sphere-viewer/video-plugin'),
      ])
      VideoPluginClass = VideoPlugin
      await import('@photo-sphere-viewer/video-plugin/index.css')
      if (!current()) return
      const video = document.createElement('video')
      mediaVideo = video
      video.crossOrigin = 'anonymous'
      video.playsInline = true
      video.setAttribute('playsinline', '')
      video.setAttribute('webkit-playsinline', '')
      video.preload = 'metadata'
      video.loop = !props.continuous
      videoEvents = new AbortController()
      const options = { signal: videoEvents.signal }
      video.addEventListener('playing', () => {
        if (!current()) return
        clearTimeout(watchdog)
        loading.value = false
        needsPlay.value = false
        playMessage.value = ''
      }, options)
      video.addEventListener('loadeddata', () => {
        if (!current()) return
        clearTimeout(watchdog)
        loading.value = false
      }, options)
      video.addEventListener('ended', () => {
        if (current() && video.ended && props.continuous) emit('ended', props.item.id)
      }, options)
      video.addEventListener('error', () => {
        if (video.error) fail('This 360 video could not load. Please retry.')
      }, options)
      needsPlay.value = true
      canPlay.value = true
      viewer.value = new Viewer({
        container: host.value!,
        adapter: [EquirectangularVideoAdapter, { autoplay: false, muted: false }],
        panorama: { source: video },
        loadingImg: undefined,
        defaultZoomLvl: 20,
        touchmoveTwoFingers: false,
        mousewheelCtrlKey: false,
        navbar: ['videoPlay', 'videoVolume', 'videoTime', 'zoom', 'gyroscope',
          ...(props.continuous ? (document.fullscreenEnabled ? [{
            id: 'filmFullscreen', title: 'Toggle fullscreen',
            content: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>',
            onClick: () => emit('fullscreen'),
          }] : []) : ['fullscreen'])],
        plugins: [
          [VideoPlugin, { progressbar: true, bigbutton: false }],
          [GyroscopePlugin, { touchmove: true }],
        ],
      })
      // Set the source after the adapter has installed its metadata listener.
      video.src = textureUrl(m.src)
    } else {
      const { EquirectangularTilesAdapter } = await import('@photo-sphere-viewer/equirectangular-tiles-adapter')
      if (!current()) return
      const p = m.pano
      const panorama = p
        ? {
            width: p.width,
            cols: p.cols,
            rows: p.rows,
            baseUrl: textureUrl(p.preview),
            tileUrl: (col: number, row: number) =>
              textureUrl(p.tiles.replace('{col}', String(col)).replace('{row}', String(row))),
          }
        : null
      viewer.value = new Viewer({
        container: host.value!,
        adapter: panorama ? [EquirectangularTilesAdapter, { showErrorTile: false, baseBlur: false }] : undefined,
        // no tile info → fall back to the plain equirectangular image
        panorama: panorama ?? textureUrl(m.src),
        defaultZoomLvl: 20,
        touchmoveTwoFingers: false,
        mousewheelCtrlKey: false,
        navbar: ['zoom', 'move', 'gyroscope', 'fullscreen'],
        plugins: [[GyroscopePlugin, { touchmove: true }]],
      })
    }
    // PSV catches a WebGL failure itself (shows an overlay, no throw) and leaves no renderer behind
    if (!(viewer.value as unknown as { renderer?: unknown }).renderer) throw new Error('WebGL unavailable')
    viewer.value.addEventListener('ready', () => {
      if (!current()) return
      clearTimeout(watchdog)
      loading.value = false
      if (props.continuous && mediaVideo?.paused) play(false)
    }, { once: true })
    viewer.value.addEventListener('panorama-error', () => {
      fail('This 360 view could not load. Please retry.')
    })
    watchdog = setTimeout(() => fail('This 360 view is taking too long to load. Please retry.'), 45000)
  } catch (e) {
    if (!current()) return
    console.warn('[360] viewer could not start', e)
    fail('The 360 viewer could not start. Please retry.')
    if (e instanceof Error && /webgl/i.test(e.message)) emit('unsupported')
  }
}

function destroy() {
  generation++
  playAttempt++
  videoEvents?.abort()
  videoEvents = null
  clearTimeout(watchdog)
  viewer.value?.destroy()
  viewer.value = null
  if (mediaVideo) {
    mediaVideo.pause()
    mediaVideo.removeAttribute('src')
    mediaVideo.load()
    mediaVideo.remove()
    mediaVideo = null
  }
}

function changeItem() {
  if (!props.continuous || !mediaVideo || !viewer.value || props.item.type !== 'pano-video') {
    void build()
    return
  }
  // Keep the viewer and video across chapters: volume, autoplay permission and fullscreen survive.
  const video = mediaVideo
  playAttempt++
  video.pause()
  failed.value = ''
  needsPlay.value = false
  playMessage.value = ''
  loading.value = true
  clearTimeout(watchdog)
  viewer.value.rotate({ yaw: 0, pitch: 0 })
  video.src = textureUrl(props.item.src)
  video.load()
  play(false)
  watchdog = setTimeout(() => {
    loading.value = false
    failed.value = 'This chapter is taking too long to load. Please retry.'
  }, 45000)
}

onMounted(build)
watch(() => props.item.id, changeItem)
onBeforeUnmount(destroy)
</script>

<template>
  <div class="relative w-full h-full bg-black">
    <div ref="host" class="absolute inset-0"></div>
    <div v-if="loading && !failed" class="absolute inset-0 grid place-items-center pointer-events-none">
      <img v-if="preview" :src="preview" :crossorigin="item.type === 'pano' ? 'anonymous' : undefined" alt="" class="absolute inset-0 w-full h-full object-cover opacity-40" />
      <span class="relative font-pixel text-xs text-amber bg-ink/80 px-2 py-1 rounded">LOADING 360…</span>
    </div>
    <div v-if="needsPlay && !failed" class="absolute inset-0 grid place-items-center pointer-events-none">
      <img v-if="preview" :src="preview" alt="" class="absolute inset-0 w-full h-full object-cover opacity-40" />
      <div class="relative text-center pointer-events-auto p-4 rounded-xl bg-ink/85">
        <button class="btn min-h-12" :disabled="!canPlay" @click="play()">Play 360 video</button>
        <p v-if="playMessage" class="text-sm text-ivory mt-2">{{ playMessage }}</p>
      </div>
    </div>
    <div v-if="failed" class="absolute inset-0 grid place-items-center text-center p-6 text-ivory bg-ink">
      <div><p>{{ failed }}</p><button class="btn mt-4" @click="build">Retry 360 view</button></div>
    </div>
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
