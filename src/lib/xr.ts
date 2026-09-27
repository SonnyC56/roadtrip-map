/// <reference types="webxr" />
// Headset (WebXR immersive-vr) support for 360 photos / 360 videos / the VR edition of the film.
// The three.js scene lives in VRViewer.vue (lazy chunk). This module is tiny and loaded eagerly: the
// click handler must call navigator.xr.requestSession() (and video.play()) synchronously inside the
// user gesture, so it runs here, before any dynamic import.
import { ref, shallowRef } from 'vue'
import { epKind, epLabel, mediaUrl, playableFormat, type Episode } from './manifest'

/** One video in an in-VR playlist (an episode of the VR edition, or a raw 360 clip). */
export interface VRItem {
  id: string
  /** short tag, e.g. "E07", "INTRO" */
  label: string
  title: string
  src: string
  poster?: string
  duration?: number
}

export interface VRSource {
  kind: 'image' | 'video'
  title: string
  /** image: equirect preview (2048x1024) shown first; video: the equirect mp4 */
  src: string
  poster?: string
  /** image only: full-res tiles, stitched into a 4096-wide texture once in VR */
  tiles?: { url: (col: number, row: number) => string; cols: number; rows: number; width: number }
  /** video only: start position (s) of the first item */
  startAt?: number
  /** initial yaw in radians (photo-sphere-viewer convention: 0 = image centre, + = right) */
  yaw?: number
  /** video only: play on through these without leaving VR (auto-advance, prev/next, list) */
  playlist?: VRItem[]
  /** index of `src` in playlist */
  index?: number
  /** what the list calls its items, e.g. "Episodes" / "360 clips" */
  listName?: string
}

export interface VRState {
  source: VRSource
  /** null = on-screen preview (?vr=preview), no headset */
  session: XRSession | null
  video: HTMLVideoElement | null
}

/** The active VR view (rendered by <VRViewer> in App.vue). */
export const vrState = shallowRef<VRState | null>(null)
/** true once navigator.xr reports immersive-vr support (or ?vr=preview is in the URL). */
export const xrSupported = ref(false)
/** ?vr=preview: show the VR buttons on any device and render the VR scene on screen (testing only). */
export const vrPreview = typeof location !== 'undefined' && /[?&]vr=preview\b/.test(location.search)

let checked = false
export function checkXR(): void {
  if (checked || typeof navigator === 'undefined') return
  checked = true
  if (vrPreview) {
    xrSupported.value = true
    return
  }
  const xr = navigator.xr
  if (!xr?.isSessionSupported) return
  xr.isSessionSupported('immersive-vr')
    .then((ok) => {
      xrSupported.value = ok
      // warm the three.js chunk so entering VR is instant
      if (ok) import('../components/VRViewer.vue').catch(() => {})
    })
    .catch(() => {})
}
checkXR()

export function makeVideo(src: string, startAt = 0): HTMLVideoElement {
  const v = document.createElement('video')
  v.crossOrigin = 'anonymous'
  v.playsInline = true
  v.preload = 'auto'
  v.src = src
  if (startAt > 0) v.currentTime = startAt
  return v
}

/** play() with sound, falling back to muted if the browser refuses; resolves true if it had to mute. */
export function playVideo(v: HTMLVideoElement): Promise<boolean> {
  return v.play().then(
    () => false,
    () => {
      v.muted = true
      return v.play().then(
        () => true,
        () => true,
      )
    },
  )
}

/** Call directly from a click / tap handler (no awaits before it). */
export async function enterVR(source: VRSource): Promise<void> {
  if (vrState.value) return
  let sessionP: Promise<XRSession> | null = null
  if (!vrPreview) {
    if (!navigator.xr) throw new Error('WebXR not available')
    sessionP = navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] })
  }
  // start playback inside the same gesture so the headset browser allows sound
  const video = source.kind === 'video' ? makeVideo(source.src, source.startAt) : null
  if (video) playVideo(video)
  try {
    const session = sessionP ? await sessionP : null
    vrState.value = { source, session, video }
  } catch (e) {
    video?.pause()
    video?.removeAttribute('src')
    throw e
  }
}

/** Play a playlist from `index` inside one immersive session. */
export function enterVRPlaylist(items: VRItem[], index: number, listName: string, startAt = 0, yaw?: number): Promise<void> {
  const it = items[index]
  if (!it) return Promise.reject(new Error('empty playlist'))
  const title = it.label.toUpperCase() === it.title.toUpperCase() ? it.title : `${it.label} · ${it.title}`
  return enterVR({ kind: 'video', title, src: it.src, poster: it.poster, startAt, yaw, playlist: items, index, listName })
}

/** The VR edition: every episode with a playable formats.vr, in film order (intro ... credits). */
export function episodePlaylist(episodes: Episode[]): VRItem[] {
  const out: VRItem[] = []
  for (const e of [...episodes].sort((a, b) => a.ep - b.ep)) {
    const f = playableFormat(e, 'vr')
    if (!f) continue
    out.push({
      id: `ep${e.ep}`,
      label: epKind(e) === 'intro' ? 'INTRO' : epLabel(e),
      title: e.title,
      src: mediaUrl(f.src),
      poster: mediaUrl(f.poster) || undefined,
      duration: f.duration ?? e.duration,
    })
  }
  return out
}

export function exitVR(): void {
  const s = vrState.value
  if (!s) return
  if (s.session) s.session.end().catch(() => (vrState.value = null))
  else vrState.value = null // preview mode; headset sessions clear on their 'end' event
}
