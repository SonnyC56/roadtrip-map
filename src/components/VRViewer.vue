<script setup lang="ts">
/// <reference types="webxr" />
// Immersive (WebXR immersive-vr) viewer for 360 photos / 360 videos / the VR edition of the film.
// three.js: an inside-out sphere around the head, textured with
//   - photos: the 2048x1024 preview first, then the full-res tiles stitched down into a 4096x2048 canvas
//     (Quest-friendly; the 12K original would blow the texture budget)
//   - videos: a VideoTexture of the equirect MP4 (mono 3840x1920)
// plus a floating control panel (play/pause, -10 s / +10 s, seek bar, exit) driven by controller or hand rays.
// Videos can come with a playlist (the film's episodes, or the 360 clips in time order): prev / next,
// an in-VR list, and auto-advance with an "Up next" card, all without leaving the session. At most two
// <video> elements are alive: the current one and the preloaded next one.
// Loaded lazily; the XR session itself is requested in lib/xr.ts inside the click gesture.
// Without a session (?vr=preview) the same scene renders on screen: drag to look, click to use the panel.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { StoryHud } from '../lib/storyHud'
import {
  BufferGeometry,
  CanvasTexture,
  Line,
  LineBasicMaterial,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  RingGeometry,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  Texture,
  Vector2,
  Vector3,
  VideoTexture,
  WebGLRenderer,
  type Group,
} from 'three'
import { exitVR, makeVideo, playVideo, vrState, type VRItem, type VRState } from '../lib/xr'
import { trackEvent } from '../lib/analytics'
import { attachVideoTelemetry } from '../lib/videoTelemetry'

const props = defineProps<{ state: VRState }>()
const host = ref<HTMLDivElement | null>(null)
const screenControls = ref<HTMLElement | null>(null)
const pageStatus = ref('Starting VR…')

const session = props.state.session
const inHeadset = !!session
const source = props.state.source
const isVideo = source.kind === 'video' && !!props.state.video
const playlist = isVideo && source.playlist && source.playlist.length > 1 ? source.playlist : null
const listName = source.listName || 'Playlist'
const screenPlayback = ref({ index: source.index || 0, time: 0, duration: 0, paused: false, muted: false, status: '' })
let screenTick = 0
function screenAction(id: string, fraction = 0) { act(id, fraction) }
function screenChapter(e: Event) { goTo(Number((e.target as HTMLSelectElement).value)) }
function screenSeek(e: Event) { screenAction('seek', Number((e.target as HTMLInputElement).value) / 1000) }

let renderer: WebGLRenderer | null = null
let disposed = false
let panelStatus = ''
const scene = new Scene()
const hudEnabled = ref(true)
const storyHud = source.hud ? new StoryHud(source.hud, message => { panelStatus = message }) : null
if (storyHud) scene.add(storyHud.group)
const camera = new PerspectiveCamera(75, 1, 0.05, 200)
camera.rotation.order = 'YXZ'

// ---------------------------------------------------------------- sphere
const sphereGeo = new SphereGeometry(50, 96, 48)
sphereGeo.scale(-1, 1, 1) // inside-out
const sphereMat = new MeshBasicMaterial({ color: 0x000000 })
const sphere = new Mesh(sphereGeo, sphereMat)
// SphereGeometry puts the image centre (u = 0.5) on -x: turn it to -z (straight ahead at session start),
// then apply the 2D viewer's yaw so the headset opens on the same view
sphere.rotation.y = -Math.PI / 2 + (source.yaw || 0)
scene.add(sphere)

function setMap(tex: Texture) {
  const old = sphereMat.map
  sphereMat.map = tex
  sphereMat.color.set(0xffffff)
  sphereMat.needsUpdate = true
  if (old && old !== tex) old.dispose()
}

const head = new Vector3()
const fwd = new Vector3()
/** Put the image centre where the viewer is currently facing (used when the next video starts). */
function recenter() {
  camera.getWorldDirection(fwd)
  if (Math.abs(fwd.y) > 0.98) return
  sphere.rotation.y = Math.atan2(-fwd.x, -fwd.z) - Math.PI / 2
}

function loadImage(url: string): Promise<HTMLImageElement> {
  const im = new Image()
  im.crossOrigin = 'anonymous'
  im.src = url
  return im.decode().then(() => im)
}

// ---------------------------------------------------------------- photo
async function showPhoto() {
  panelStatus = 'Loading…'
  const tiles = source.tiles
  const max = renderer!.capabilities.maxTextureSize
  const W = tiles && max >= 4096 ? 4096 : 2048
  const H = W / 2
  const pre = await loadImage(source.src)
  if (disposed) return
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  g.drawImage(pre, 0, 0, W, H)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  setMap(tex)
  panelStatus = ''
  if (!tiles || W <= pre.naturalWidth) return
  // sharpen: full-res tiles downscaled into the 4096 canvas, equator rows first (that's where people look)
  const jobs: [number, number][] = []
  for (let r = 0; r < tiles.rows; r++) for (let col = 0; col < tiles.cols; col++) jobs.push([col, r])
  const mid = (tiles.rows - 1) / 2
  jobs.sort((a, b) => Math.abs(a[1] - mid) - Math.abs(b[1] - mid))
  let next = 0
  let done = 0
  const worker = async () => {
    while (!disposed && next < jobs.length) {
      const [col, r] = jobs[next++]!
      try {
        const im = await loadImage(tiles.url(col, r))
        if (disposed) return
        const x0 = Math.floor((col * W) / tiles.cols)
        const x1 = Math.ceil(((col + 1) * W) / tiles.cols)
        const y0 = Math.floor((r * H) / tiles.rows)
        const y1 = Math.ceil(((r + 1) * H) / tiles.rows)
        g.drawImage(im, x0, y0, x1 - x0, y1 - y0)
      } catch {
        /* keep the preview pixels for a missing tile */
      }
      if (++done % 32 === 0) tex.needsUpdate = true
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  if (!disposed) tex.needsUpdate = true
}

// ---------------------------------------------------------------- video + playlist
let cur: HTMLVideoElement | null = isVideo ? props.state.video : null
let disposeTelemetry: (() => void) | undefined
const vrOpened = performance.now()
let idx = source.index ?? 0
let curTitle = source.title || '360°'
/** preloaded next item (the only other <video> allowed to exist) */
let pre: { idx: number; el: HTMLVideoElement } | null = null
let upNext: { at: number; i: number } | null = null
let videoTex: VideoTexture | null = null
let lastVideoT = -1
const PRELOAD_S = 20
const UPNEXT_MS = 5000

function disposeVideo(v: HTMLVideoElement) {
  v.pause()
  v.removeAttribute('src')
  v.load()
}

function attachVideo(v: HTMLVideoElement, poster?: string) {
  disposeTelemetry?.()
  const context = playlist?.[idx]?.analytics || source.analytics
  disposeTelemetry = attachVideoTelemetry(v, {
    content: (context?.content || '360').replace(/:360$/, session ? ':vr' : ':360-preview'),
    mode: session ? 'headset' : 'preview', headset: !!session,
  }, trackEvent)
  panelStatus = 'Loading video…'
  videoTex = null
  lastVideoT = -1
  let ready = false
  if (poster) {
    loadImage(poster)
      .then((im) => {
        if (ready || disposed || v !== cur) return
        const t = new Texture(im)
        t.colorSpace = SRGBColorSpace
        t.needsUpdate = true
        setMap(t)
      })
      .catch(() => {})
  }
  const onData = () => {
    if (disposed || v !== cur) return
    ready = true
    panelStatus = ''
    const vt = new VideoTexture(v)
    vt.colorSpace = SRGBColorSpace
    vt.minFilter = LinearFilter
    vt.generateMipmaps = false
    videoTex = vt
    setMap(vt)
  }
  if (v.readyState >= 2) onData()
  else v.addEventListener('loadeddata', onData, { once: true })
  v.addEventListener('ended', () => v === cur && onEnded())
  v.addEventListener('error', () => {
    if (v === cur && v.getAttribute('src')) panelStatus = 'This video could not be loaded.'
  })
}

function goTo(i: number) {
  const it = playlist?.[i]
  if (!it || disposed) return
  cancelUpNext()
  let el: HTMLVideoElement
  if (pre && pre.idx === i) {
    el = pre.el
    pre = null
  } else {
    if (pre) disposeVideo(pre.el)
    pre = null
    el = makeVideo(it.src)
  }
  disposeTelemetry?.(); disposeTelemetry = undefined
  const old = cur
  cur = el
  idx = i
  curTitle = itemTitle(it)
  if (old) disposeVideo(old)
  recenter()
  attachVideo(el, it.poster)
  playVideo(el)
  if (sideMode === 'list') listPage = Math.floor(i / PAGE)
}

function itemTitle(it: VRItem) {
  return it.label.toUpperCase() === it.title.toUpperCase() ? it.title : `${it.label} · ${it.title}`
}

function onEnded() {
  if (playlist && idx + 1 < playlist.length) {
    upNext = { at: performance.now() + UPNEXT_MS, i: idx + 1 }
    sideMode = 'upnext'
    placePanel()
    panel.visible = true
  } else showPanel()
}
function cancelUpNext() {
  upNext = null
  if (sideMode === 'upnext') sideMode = null
}

function maybePreload() {
  if (!playlist || !cur || pre || !(cur.duration > 0)) return
  const n = idx + 1
  if (n >= playlist.length || cur.duration - cur.currentTime > PRELOAD_S) return
  pre = { idx: n, el: makeVideo(playlist[n]!.src) } // preload="auto": starts buffering now
}

function togglePlay() {
  if (!cur) return
  if (cur.paused || cur.ended) playVideo(cur)
  else cur.pause()
}
function seekBy(s: number) {
  if (!cur) return
  const d = cur.duration || Infinity
  cur.currentTime = Math.min(Math.max(0, cur.currentTime + s), d - 0.1)
}
function prevItem() {
  if (!cur) return
  if (cur.currentTime > 5 || idx === 0) cur.currentTime = 0
  else goTo(idx - 1)
}

// ---------------------------------------------------------------- UI (canvas-textured planes)
const AMBER = '#e6b56a'
const IVORY = '#f5f1e7'
const MUTED = '#9aa6ad'
const BTN = '#1c2a34'
const FONT = 'system-ui, sans-serif'

interface Btn {
  id: string
  x: number
  y: number
  w: number
  h: number
}
const inside = (b: Btn, px: number, py: number) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h

function canvasPlane(cw: number, ch: number, widthM: number) {
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  const mesh = new Mesh(new PlaneGeometry(widthM, (widthM * ch) / cw), new MeshBasicMaterial({ map: tex, transparent: true, depthTest: false }))
  mesh.renderOrder = 10
  return { canvas, g: canvas.getContext('2d')!, tex, mesh, hM: (widthM * ch) / cw }
}

function fitText(g: CanvasRenderingContext2D, text: string, maxW: number) {
  if (g.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 2 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t.trimEnd() + '…'
}
function box(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}
function background(g: CanvasRenderingContext2D, w: number, h: number) {
  g.clearRect(0, 0, w, h)
  g.fillStyle = 'rgba(16,27,35,0.92)'
  g.strokeStyle = '#22303a'
  g.lineWidth = 4
  box(g, 2, 2, w - 4, h - 4, 28)
  g.fill()
  g.stroke()
}

// -- main control panel
const CW = 1024
const CH = isVideo ? 300 : 190
const PW = 0.9 // metres
const main = canvasPlane(CW, CH, PW)
const panel = main.mesh
panel.visible = inHeadset && !storyHud
scene.add(panel)
const bar = { x: 40, y: 118, w: 944, h: 18 }
const buttons: Btn[] = !isVideo
  ? [{ id: 'exit', x: 764, y: 72, w: 220, h: 90 }]
  : storyHud
    ? ['back', 'play', 'fwd', 'hud', 'exit'].map((id, k) => ({ id, x: 30 + k * 194, y: 170, w: 182, h: 96 }))
  : playlist
    ? ['prev', 'back', 'play', 'fwd', 'next', 'list', 'exit'].map((id, k) => ({ id, x: 30 + k * 136, y: 170, w: 124, h: 96 }))
    : [
        { id: 'back', x: 40, y: 170, w: 200, h: 96 },
        { id: 'play', x: 256, y: 170, w: 240, h: 96 },
        { id: 'fwd', x: 512, y: 170, w: 200, h: 96 },
        { id: 'exit', x: 764, y: 170, w: 220, h: 96 },
      ]

// -- side panel above it: "Up next" card or the episode / clip list
const SW = 1024
const SH = 640
const side = canvasPlane(SW, SH, PW)
side.mesh.position.set(0, main.hM / 2 + side.hM / 2 + 0.03, 0)
side.mesh.visible = false
panel.add(side.mesh)
let sideMode: 'upnext' | 'list' | null = null
const PAGE = 12
let listPage = 0
const pages = playlist ? Math.ceil(playlist.length / PAGE) : 1
function sideButtons(): Btn[] {
  if (sideMode === 'upnext')
    return [
      { id: 'playnow', x: 40, y: 430, w: 450, h: 120 },
      { id: 'cancel', x: 534, y: 430, w: 450, h: 120 },
    ]
  if (sideMode === 'list' && playlist) {
    const out: Btn[] = []
    for (let k = 0; k < PAGE; k++) {
      const i = listPage * PAGE + k
      if (i >= playlist.length) break
      out.push({ id: `item:${i}`, x: 30 + (k % 2) * 487, y: 96 + Math.floor(k / 2) * 70, w: 477, h: 62 })
    }
    out.push({ id: 'pgprev', x: 30, y: 536, w: 150, h: 80 }, { id: 'pgnext', x: 196, y: 536, w: 150, h: 80 }, { id: 'close', x: 794, y: 536, w: 200, h: 80 })
    return out
  }
  return []
}

let hover: string | null = null
let mainSig = ''
let sideSig = ''

const fmtT = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

function drawIcon(g: CanvasRenderingContext2D, id: string, cx: number, cy: number, playing: boolean) {
  const tri = (x0: number, dir: 1 | -1, s = 24) => {
    g.beginPath()
    g.moveTo(x0, cy - s)
    g.lineTo(x0 + dir * s * 1.5, cy)
    g.lineTo(x0, cy + s)
    g.closePath()
    g.fill()
  }
  if (id === 'play') {
    if (playing) {
      g.fillRect(cx - 20, cy - 24, 14, 48)
      g.fillRect(cx + 6, cy - 24, 14, 48)
    } else tri(cx - 14, 1, 26)
  } else if (id === 'prev') {
    g.fillRect(cx - 24, cy - 20, 8, 40)
    tri(cx + 22, -1, 20)
  } else if (id === 'next') {
    tri(cx - 22, 1, 20)
    g.fillRect(cx + 16, cy - 20, 8, 40)
  } else if (id === 'list') {
    for (const dy of [-16, 0, 16]) g.fillRect(cx - 24, cy + dy - 4, 48, 8)
  } else {
    g.font = `700 ${playlist ? 32 : 36}px ${FONT}`
    g.textAlign = 'center'
    // the 7-button playlist row is narrower: shorter labels
    const s = playlist ? '' : ' s'
    const label = id === 'hud' ? (hudEnabled.value ? 'HUD ON' : 'HUD OFF') : id === 'back' ? `« 10${s}` : id === 'fwd' ? `10${s} »` : playlist ? 'EXIT' : 'EXIT VR'
    g.fillText(label, cx, cy + 2)
    g.textAlign = 'left'
  }
}

function drawButton(g: CanvasRenderingContext2D, b: Btn, outline = false) {
  const on = hover === b.id
  g.fillStyle = on ? AMBER : BTN
  box(g, b.x, b.y, b.w, b.h, 18)
  g.fill()
  if (outline && !on) {
    g.strokeStyle = AMBER
    g.lineWidth = 3
    g.stroke()
  }
  g.fillStyle = on ? '#101b23' : IVORY
}

function drawMain() {
  const v = cur
  const playing = !!v && !v.paused && !v.ended
  const t = v?.currentTime || 0
  const d = v?.duration || 0
  const status = panelStatus || (v?.muted ? 'Sound is off: press play / pause to turn it on' : '')
  const sig = `${hover}|${playing}|${Math.floor(t * 4)}|${d}|${status}|${curTitle}`
  if (sig === mainSig) return
  mainSig = sig
  const g = main.g
  background(g, CW, CH)
  g.textBaseline = 'middle'
  g.fillStyle = IVORY
  g.font = `600 40px ${FONT}`
  g.fillText(fitText(g, curTitle, isVideo ? 680 : 690), 40, 58)
  if (isVideo) {
    g.fillStyle = AMBER
    g.font = `500 34px ${FONT}`
    g.textAlign = 'right'
    g.fillText(`${fmtT(t)} / ${fmtT(d)}`, CW - 40, 58)
    g.textAlign = 'left'
    g.fillStyle = '#22303a'
    box(g, bar.x, bar.y, bar.w, bar.h, 9)
    g.fill()
    g.fillStyle = hover === 'seek' ? '#f0c88a' : AMBER
    box(g, bar.x, bar.y, Math.max(bar.h, bar.w * (d ? Math.min(1, t / d) : 0)), bar.h, 9)
    g.fill()
    if (status) {
      g.fillStyle = MUTED
      g.font = `400 26px ${FONT}`
      g.fillText(status, 40, 98)
    }
  } else {
    g.fillStyle = MUTED
    g.font = `400 28px ${FONT}`
    g.fillText(status || 'Look around · click the view to hide this panel', 40, 122)
  }
  for (const b of buttons) {
    drawButton(g, b, b.id === 'exit' || (b.id === 'list' && sideMode === 'list'))
    drawIcon(g, b.id, b.x + b.w / 2, b.y + b.h / 2, playing)
  }
  main.tex.needsUpdate = true
}

function drawSide() {
  side.mesh.visible = !!sideMode
  if (!sideMode || !playlist) return
  const secs = upNext ? Math.max(0, Math.ceil((upNext.at - performance.now()) / 1000)) : 0
  const sig = `${sideMode}|${hover}|${secs}|${listPage}|${idx}`
  if (sig === sideSig) return
  sideSig = sig
  const g = side.g
  background(g, SW, SH)
  g.textBaseline = 'middle'
  if (sideMode === 'upnext' && upNext) {
    const it = playlist[upNext.i]!
    g.fillStyle = AMBER
    g.font = `700 34px ${FONT}`
    g.fillText('UP NEXT', 40, 70)
    g.fillStyle = IVORY
    g.font = `600 64px ${FONT}`
    g.fillText(fitText(g, itemTitle(it).replace(' · ', ' — '), SW - 80), 40, 170)
    g.fillStyle = MUTED
    g.font = `400 36px ${FONT}`
    g.fillText(`Starting in ${secs} s${it.duration ? ` · ${fmtT(it.duration)}` : ''}`, 40, 250)
    // countdown bar
    const f = upNext ? 1 - (upNext.at - performance.now()) / UPNEXT_MS : 1
    g.fillStyle = '#22303a'
    box(g, 40, 320, SW - 80, 14, 7)
    g.fill()
    g.fillStyle = AMBER
    box(g, 40, 320, Math.max(14, (SW - 80) * Math.min(1, Math.max(0, f))), 14, 7)
    g.fill()
    for (const b of sideButtons()) {
      drawButton(g, b, b.id === 'cancel')
      g.font = `700 40px ${FONT}`
      g.textAlign = 'center'
      g.fillText(b.id === 'playnow' ? 'PLAY NOW' : 'CANCEL', b.x + b.w / 2, b.y + b.h / 2 + 2)
      g.textAlign = 'left'
    }
  } else if (sideMode === 'list') {
    g.fillStyle = AMBER
    g.font = `700 34px ${FONT}`
    g.fillText(listName.toUpperCase(), 40, 50)
    g.fillStyle = MUTED
    g.font = `400 30px ${FONT}`
    g.textAlign = 'right'
    g.fillText(`${listPage + 1} / ${pages}`, SW - 40, 50)
    g.textAlign = 'left'
    for (const b of sideButtons()) {
      if (b.id.startsWith('item:')) {
        const i = Number(b.id.slice(5))
        const it = playlist[i]!
        const on = hover === b.id
        g.fillStyle = on ? AMBER : i === idx ? 'rgba(230,181,106,0.18)' : BTN
        box(g, b.x, b.y, b.w, b.h, 12)
        g.fill()
        g.fillStyle = on ? '#101b23' : AMBER
        g.font = `700 24px ${FONT}`
        g.fillText(fitText(g, it.label, 96), b.x + 14, b.y + b.h / 2 + 1)
        g.fillStyle = on ? '#101b23' : IVORY
        g.font = `500 28px ${FONT}`
        g.fillText(fitText(g, it.title, b.w - 140), b.x + 124, b.y + b.h / 2 + 1)
      } else {
        const disabled = (b.id === 'pgprev' && listPage === 0) || (b.id === 'pgnext' && listPage >= pages - 1)
        g.globalAlpha = disabled ? 0.35 : 1
        drawButton(g, b, b.id === 'close')
        g.font = `700 34px ${FONT}`
        g.textAlign = 'center'
        g.fillText(b.id === 'pgprev' ? '‹ PREV' : b.id === 'pgnext' ? 'NEXT ›' : 'CLOSE', b.x + b.w / 2, b.y + b.h / 2 + 2)
        g.textAlign = 'left'
        g.globalAlpha = 1
      }
    }
  }
  side.tex.needsUpdate = true
}

function placePanel() {
  camera.getWorldPosition(head)
  camera.getWorldDirection(fwd)
  fwd.y = 0
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1)
  fwd.normalize()
  panel.position.copy(head).addScaledVector(fwd, 1.2)
  panel.position.y -= 0.42
  panel.lookAt(head)
}
function showPanel() {
  if (!inHeadset && !storyHud) return
  if (!panel.visible) placePanel()
  panel.visible = true
}
function togglePanel() {
  if (!inHeadset && !storyHud) return
  if (panel.visible) panel.visible = false
  else showPanel()
}

function act(id: string, frac: number) {
  if (cur?.muted) cur.muted = false // any click in VR is a user gesture: restore sound after a muted autoplay
  if (id === 'hud') { hudEnabled.value = !hudEnabled.value; mainSig = '' }
  else if (id === 'exit') exitVR()
  else if (id === 'play') togglePlay()
  else if (id === 'back') seekBy(-10)
  else if (id === 'fwd') seekBy(10)
  else if (id === 'prev') prevItem()
  else if (id === 'next') goTo(idx + 1)
  else if (id === 'list') {
    if (sideMode === 'list') sideMode = null
    else {
      cancelUpNext()
      sideMode = 'list'
      listPage = Math.floor(idx / PAGE)
    }
  } else if (id === 'seek' && cur?.duration) cur.currentTime = Math.min(Math.max(0, frac), 0.999) * cur.duration
  else if (id === 'playnow' && upNext) goTo(upNext.i)
  else if (id === 'cancel') cancelUpNext()
  else if (id === 'pgprev') listPage = Math.max(0, listPage - 1)
  else if (id === 'pgnext') listPage = Math.min(pages - 1, listPage + 1)
  else if (id === 'close') sideMode = null
  else if (id.startsWith('item:')) {
    const i = Number(id.slice(5))
    sideMode = null
    if (i !== idx) goTo(i)
    else if (cur?.ended) playVideo(cur)
  }
}

// ---------------------------------------------------------------- pointing
const raycaster = new Raycaster()
interface Hit {
  id: string | null
  frac: number
  point: Vector3
}
function hitUI(origin: Vector3, dir: Vector3): Hit | null {
  if (!panel.visible) return null
  raycaster.set(origin, dir)
  const h = raycaster.intersectObjects(side.mesh.visible ? [side.mesh, panel] : [panel], false)[0]
  if (!h || !h.uv) return null
  if (h.object === side.mesh) {
    const px = h.uv.x * SW
    const py = (1 - h.uv.y) * SH
    return { id: sideButtons().find((b) => inside(b, px, py))?.id ?? null, frac: 0, point: h.point }
  }
  const px = h.uv.x * CW
  const py = (1 - h.uv.y) * CH
  let id: string | null = buttons.find((b) => inside(b, px, py))?.id ?? null
  if (!id && isVideo && px >= bar.x - 10 && px <= bar.x + bar.w + 10 && py >= bar.y - 24 && py <= bar.y + bar.h + 24) id = 'seek'
  return { id, frac: (px - bar.x) / bar.w, point: h.point }
}
function select(origin: Vector3, dir: Vector3) {
  const h = hitUI(origin, dir)
  if (!h) togglePanel() // clicked the view itself
  else if (h.id) act(h.id, h.frac)
}

interface Pointer {
  c: Group
  line: Line
  cursor: Mesh
  active: boolean
}
const pointers: Pointer[] = []
const rayGeo = new BufferGeometry().setFromPoints([new Vector3(0, 0, 0), new Vector3(0, 0, -1)])
const rayMat = new LineBasicMaterial({ color: 0xe6b56a, transparent: true, opacity: 0.85 })
const cursorGeo = new RingGeometry(0.006, 0.012, 24)
const cursorMat = new MeshBasicMaterial({ color: 0xe6b56a, depthTest: false })
const m4 = new Matrix4()
const ro = new Vector3()
const rd = new Vector3()
function rayOf(obj: Group) {
  obj.updateMatrixWorld(true)
  m4.identity().extractRotation(obj.matrixWorld)
  ro.setFromMatrixPosition(obj.matrixWorld)
  rd.set(0, 0, -1).applyMatrix4(m4)
}

function setupControllers(r: WebGLRenderer) {
  for (const i of [0, 1]) {
    const c = r.xr.getController(i)
    const line = new Line(rayGeo, rayMat)
    line.scale.z = 4
    line.visible = false
    c.add(line)
    const cursor = new Mesh(cursorGeo, cursorMat)
    cursor.visible = false
    cursor.renderOrder = 11
    scene.add(cursor)
    const p: Pointer = { c, line, cursor, active: false }
    c.addEventListener('connected', (e) => {
      p.active = true
      line.visible = e.data?.targetRayMode !== 'gaze'
    })
    c.addEventListener('disconnected', () => {
      p.active = false
      line.visible = false
      cursor.visible = false
    })
    c.addEventListener('select', () => {
      rayOf(c)
      select(ro, rd)
    })
    scene.add(c)
    pointers.push(p)
  }
}

// A/X = play/pause, B/Y = show/hide panel, thumbstick left/right = -10 s / +10 s
const padPrev = new WeakMap<XRInputSource, { a: boolean; b: boolean; stick: number }>()
function pollGamepads() {
  if (!session) return
  for (const s of session.inputSources) {
    const gp = s.gamepad
    if (!gp) continue
    const a = !!gp.buttons[4]?.pressed
    const b = !!gp.buttons[5]?.pressed
    const x = gp.axes[2] ?? 0
    const stick = x > 0.7 ? 1 : x < -0.7 ? -1 : 0
    const prev = padPrev.get(s) || { a: false, b: false, stick: 0 }
    if (a && !prev.a) {
      if (cur?.muted) cur.muted = false
      togglePlay()
    }
    if (b && !prev.b) togglePanel()
    if (stick && stick !== prev.stick) seekBy(stick * 10)
    padPrev.set(s, { a, b, stick })
  }
}

// ---------------------------------------------------------------- loop
let frames = 0
function frame() {
  if (!renderer) return
  frames++
  if (frames === 3 && inHeadset) placePanel() // head pose is known after the first XR frames
  sphere.position.copy(camera.position) // no parallax: the sphere stays centred on the eyes
  if (cur && videoTex && cur.readyState >= 2 && cur.currentTime !== lastVideoT) {
    lastVideoT = cur.currentTime
    videoTex.needsUpdate = true
  }
  maybePreload()
  if (upNext && performance.now() >= upNext.at) goTo(upNext.i)
  if (!inHeadset && performance.now() - screenTick >= 200) {
    screenTick = performance.now()
    screenPlayback.value = { index: idx, time: cur?.currentTime || 0, duration: cur?.duration || 0,
      paused: cur?.paused ?? true, muted: cur?.muted ?? false, status: panelStatus }
  }
  if (inHeadset) {
    pollGamepads()
    let h: string | null = null
    for (const p of pointers) {
      if (!p.active) continue
      rayOf(p.c)
      const hit = hitUI(ro, rd)
      p.cursor.visible = !!hit
      if (hit) {
        p.cursor.position.copy(hit.point)
        p.cursor.quaternion.copy(panel.quaternion)
        p.line.scale.z = Math.max(0.05, hit.point.distanceTo(ro))
        h = h || hit.id
      } else p.line.scale.z = 4
    }
    hover = h
  }
  storyHud?.tick(cur?.currentTime || 0, renderer.xr.isPresenting ? renderer.xr.getCamera() : camera, panel.visible, hudEnabled.value)
  drawMain()
  drawSide()
  renderer.render(scene, camera)
}

// ---------------------------------------------------------------- on-screen preview (?vr=preview)
let drag: { x: number; y: number; yaw: number; pitch: number; moved: boolean } | null = null
const ndc = new Vector2()
function previewRay(e: PointerEvent) {
  const rect = renderer!.domElement.getBoundingClientRect()
  ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
  raycaster.setFromCamera(ndc, camera)
  ro.copy(raycaster.ray.origin)
  rd.copy(raycaster.ray.direction)
}
function onDown(e: PointerEvent) {
  drag = { x: e.clientX, y: e.clientY, yaw: camera.rotation.y, pitch: camera.rotation.x, moved: false }
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}
function onMove(e: PointerEvent) {
  if (drag) {
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true
    camera.rotation.y = drag.yaw + dx * 0.004
    camera.rotation.x = Math.max(-1.5, Math.min(1.5, drag.pitch + dy * 0.004))
  }
  previewRay(e)
  hover = hitUI(ro, rd)?.id ?? null
}
function onUp(e: PointerEvent) {
  if (drag && !drag.moved) {
    previewRay(e)
    select(ro, rd)
  }
  drag = null
}
function onResize() {
  if (!renderer || inHeadset || !host.value) return
  const w = host.value.clientWidth
  const h = host.value.clientHeight
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  storyHud?.resize(w,h,screenControls.value?.getBoundingClientRect().height || 156)
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopImmediatePropagation()
    exitVR()
  } else if (e.key === ' ' && cur) {
    e.preventDefault()
    togglePlay()
  }
}

// ---------------------------------------------------------------- lifecycle
function onSessionEnd() {
  if (vrState.value === props.state) vrState.value = null
}

onMounted(async () => {
  try {
    renderer = new WebGLRenderer({ antialias: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    host.value!.appendChild(renderer.domElement)
    window.addEventListener('keydown', onKey, true)
    if (session) {
      renderer.xr.enabled = true
      renderer.xr.setReferenceSpaceType('local')
      renderer.xr.setFoveation(0) // 360 content: keep the periphery sharp
      session.addEventListener('end', onSessionEnd)
      setupControllers(renderer)
      await renderer.xr.setSession(session)
      pageStatus.value = 'Now showing in your headset.'
    } else {
      pageStatus.value = ''
      onResize()
      window.addEventListener('resize', onResize)
      const el = renderer.domElement
      el.style.touchAction = 'none'
      el.addEventListener('pointerdown', onDown)
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
    }
    placePanel()
    renderer.setAnimationLoop(frame)
    if (cur) attachVideo(cur, source.poster)
    else
      showPhoto().catch((e) => {
        console.warn('[vr] photo failed', e)
        panelStatus = 'This 360 photo could not be loaded.'
        trackEvent('vr_error', { reason: 'image_load' })
      })
  } catch (e) {
    console.warn('[vr] could not start', e)
    pageStatus.value = 'VR could not start on this device.'
    trackEvent('vr_error', { reason: 'renderer' })
    session?.end().catch(() => {})
    if (!session) setTimeout(() => (vrState.value = null), 2500)
  }
})

onBeforeUnmount(() => {
  disposeTelemetry?.(); disposeTelemetry = undefined
  trackEvent('vr_exit', { mode: session ? 'headset' : 'preview', seconds: Math.round((performance.now() - vrOpened) / 1000) })
  disposed = true
  window.removeEventListener('keydown', onKey, true)
  window.removeEventListener('resize', onResize)
  if (session) {
    session.removeEventListener('end', onSessionEnd)
    session.end().catch(() => {}) // already ended in the normal path
  }
  if (cur) disposeVideo(cur)
  if (pre) disposeVideo(pre.el)
  cur = null
  pre = null
  renderer?.setAnimationLoop(null)
  storyHud?.dispose()
  sphereMat.map?.dispose()
  sphereGeo.dispose()
  sphereMat.dispose()
  for (const p of [main, side]) {
    p.tex.dispose()
    p.mesh.geometry.dispose()
    ;(p.mesh.material as MeshBasicMaterial).dispose()
  }
  rayGeo.dispose()
  rayMat.dispose()
  cursorGeo.dispose()
  cursorMat.dispose()
  renderer?.dispose()
  renderer?.domElement.remove()
  renderer = null
})
</script>

<template>
  <div class="fixed inset-0 z-[1200] bg-black" role="dialog" aria-modal="true" aria-label="VR view">
    <div ref="host" class="absolute inset-0" :class="{ invisible: inHeadset }"></div>
    <div v-if="inHeadset || pageStatus" class="absolute inset-0 grid place-items-center text-center p-6 pointer-events-none">
      <div>
        <p class="font-display text-3xl text-amber">{{ source.title }}</p>
        <p class="text-muted mt-2">{{ pageStatus }}</p>
      </div>
    </div>
    <div class="absolute right-3 top-3 flex items-center gap-2">
      <span v-if="!inHeadset" class="font-pixel text-[11px] text-amber bg-ink/70 rounded px-2 py-1">360° · DRAG TO LOOK</span>
      <button class="btn" @click="exitVR()">{{ inHeadset ? 'Exit VR' : 'Close 360°' }}</button>
    </div>
    <footer ref="screenControls" v-if="!inHeadset && isVideo" class="screen-controls absolute bottom-0 inset-x-0 text-ivory">
      <div class="flex items-center gap-2 mb-2">
        <label v-if="playlist" class="flex-1 min-w-0"><span class="sr-only">Choose 360 chapter</span>
          <select aria-label="Choose 360 chapter" :value="screenPlayback.index" @change="screenChapter">
            <option v-for="(item, i) in playlist" :key="item.id" :value="i">{{ item.label.toUpperCase() === item.title.toUpperCase() ? item.title : `${item.label} · ${item.title}` }}</option>
          </select>
        </label>
        <p v-else class="flex-1 truncate font-display text-lg">{{ source.title }}</p>
        <span class="font-ui text-xs whitespace-nowrap">{{ fmtT(screenPlayback.time) }} / {{ fmtT(screenPlayback.duration) }}</span>
      </div>
      <input class="screen-seek w-full" type="range" min="0" max="1000" step="1" aria-label="360 playback position"
        :value="Number.isFinite(screenPlayback.duration) && screenPlayback.duration > 0 ? screenPlayback.time / screenPlayback.duration * 1000 : 0" @input="screenSeek" />
      <div class="flex items-center justify-center gap-2">
        <button v-if="playlist" aria-label="Previous 360 chapter" :disabled="screenPlayback.index === 0" @click="screenAction('prev')">|◀</button>
        <button aria-label="Back ten seconds" @click="screenAction('back')">−10</button>
        <button :aria-label="screenPlayback.muted ? 'Enable 360 sound' : screenPlayback.paused ? 'Play 360 film' : 'Pause 360 film'"
          @click="screenPlayback.muted ? (cur && (cur.muted = false)) : screenAction('play')">{{ screenPlayback.muted ? 'Sound on' : screenPlayback.paused ? 'Play' : 'Pause' }}</button>
        <button v-if="storyHud" aria-label="Show or hide floating playback controls" @click="togglePanel()">Controls</button>
        <button v-if="storyHud" :aria-pressed="hudEnabled" aria-label="Toggle story HUD" @click="hudEnabled = !hudEnabled">HUD {{ hudEnabled ? 'on' : 'off' }}</button>
        <button aria-label="Forward ten seconds" @click="screenAction('fwd')">+10</button>
        <button v-if="playlist" aria-label="Next 360 chapter" :disabled="screenPlayback.index >= playlist.length - 1" @click="screenAction('next')">▶|</button>
      </div>
      <p class="font-ui text-xs text-muted mt-1 text-center" aria-live="polite">{{ screenPlayback.status || (playlist && playlist[screenPlayback.index + 1] ? `Up next: ${playlist[screenPlayback.index + 1]!.title} · plays automatically` : 'Drag the view to look around') }}</p>
    </footer>
  </div>
</template>

<style scoped>
.screen-controls { padding: 12px 12px max(12px, env(safe-area-inset-bottom)); background: linear-gradient(transparent, #101b23 18%); }
.screen-controls select { width: 100%; min-height: 44px; background: #16242e; color: #f5f1e7; border: 1px solid #43514b; border-radius: 8px; padding: 0 8px; font-size: 16px; }
.screen-controls button { min-height: 44px; min-width: 44px; padding: 0 10px; border-radius: 8px; background: #22303a; color: #e6b56a; touch-action: manipulation; }
.screen-controls button:disabled { opacity: .3; }
.screen-controls button:focus-visible, .screen-controls select:focus-visible, .screen-seek:focus-visible { outline: 2px solid #e6b56a; outline-offset: 2px; }
.screen-seek { height: 32px; accent-color: #e6b56a; }
</style>
