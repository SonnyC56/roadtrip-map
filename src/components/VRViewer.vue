<script setup lang="ts">
/// <reference types="webxr" />
// Immersive (WebXR immersive-vr) viewer for 360 photos / 360 videos / the VR edition of the film.
// three.js: an inside-out sphere around the head, textured with
//   - photos: the 2048x1024 preview first, then the full-res tiles stitched down into a 4096x2048 canvas
//     (Quest-friendly; the 12K original would blow the texture budget)
//   - videos: a VideoTexture of the equirect MP4 (mono 3840x1920)
// plus a floating control panel (play/pause, -10 s / +10 s, seek bar, exit) driven by controller or hand rays.
// Loaded lazily; the XR session itself is requested in lib/xr.ts inside the click gesture.
// Without a session (?vr=preview) the same scene renders on screen: drag to look, click to use the panel.
import { onBeforeUnmount, onMounted, ref } from 'vue'
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
import { exitVR, vrState, type VRState } from '../lib/xr'

const props = defineProps<{ state: VRState }>()
const host = ref<HTMLDivElement | null>(null)
const pageStatus = ref('Starting VR…')

const session = props.state.session
const inHeadset = !!session
const source = props.state.source
const video = source.kind === 'video' ? props.state.video : null

let renderer: WebGLRenderer | null = null
let disposed = false
let panelStatus = ''
const scene = new Scene()
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

function loadImage(url: string): Promise<HTMLImageElement> {
  const im = new Image()
  im.crossOrigin = 'anonymous'
  im.src = url
  return im.decode().then(() => im)
}

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

let videoTex: VideoTexture | null = null
let lastVideoT = -1
function showVideo(v: HTMLVideoElement) {
  panelStatus = 'Loading video…'
  let ready = false
  if (source.poster) {
    loadImage(source.poster)
      .then((im) => {
        if (ready || disposed) return
        const t = new Texture(im)
        t.colorSpace = SRGBColorSpace
        t.needsUpdate = true
        setMap(t)
      })
      .catch(() => {})
  }
  const vt = new VideoTexture(v)
  vt.colorSpace = SRGBColorSpace
  vt.minFilter = LinearFilter
  vt.generateMipmaps = false
  const onData = () => {
    ready = true
    panelStatus = ''
    videoTex = vt
    setMap(vt)
  }
  if (v.readyState >= 2) onData()
  else v.addEventListener('loadeddata', onData, { once: true })
  v.addEventListener('ended', () => showPanel())
  v.addEventListener('error', () => (panelStatus = 'This video could not be loaded.'))
}

// ---------------------------------------------------------------- control panel
const isVideo = !!video
const CW = 1024
const CH = isVideo ? 300 : 190
const panelCanvas = document.createElement('canvas')
panelCanvas.width = CW
panelCanvas.height = CH
const pc = panelCanvas.getContext('2d')!
const panelTex = new CanvasTexture(panelCanvas)
panelTex.colorSpace = SRGBColorSpace
const PW = 0.9 // metres
const panel = new Mesh(
  new PlaneGeometry(PW, (PW * CH) / CW),
  new MeshBasicMaterial({ map: panelTex, transparent: true, depthTest: false }),
)
panel.renderOrder = 10
scene.add(panel)

type BtnId = 'back' | 'play' | 'fwd' | 'exit' | 'seek'
interface Btn {
  id: BtnId
  x: number
  y: number
  w: number
  h: number
}
const bar = { x: 40, y: 118, w: 944, h: 18 }
const buttons: Btn[] = isVideo
  ? [
      { id: 'back', x: 40, y: 170, w: 200, h: 96 },
      { id: 'play', x: 256, y: 170, w: 240, h: 96 },
      { id: 'fwd', x: 512, y: 170, w: 200, h: 96 },
      { id: 'exit', x: 764, y: 170, w: 220, h: 96 },
    ]
  : [{ id: 'exit', x: 764, y: 72, w: 220, h: 90 }]

const AMBER = '#e6b56a'
const IVORY = '#f5f1e7'
const MUTED = '#9aa6ad'
let hover: BtnId | null = null
let panelSig = ''

const fmtT = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

function drawPanel() {
  const playing = !!video && !video.paused && !video.ended
  const t = video?.currentTime || 0
  const d = video?.duration || 0
  const sig = `${hover}|${playing}|${Math.floor(t * 4)}|${d}|${panelStatus}|${video?.muted}`
  if (sig === panelSig) return
  panelSig = sig
  const g = pc
  g.clearRect(0, 0, CW, CH)
  g.fillStyle = 'rgba(16,27,35,0.9)'
  g.strokeStyle = '#22303a'
  g.lineWidth = 4
  g.beginPath()
  g.roundRect(2, 2, CW - 4, CH - 4, 28)
  g.fill()
  g.stroke()
  // title
  g.textBaseline = 'middle'
  g.fillStyle = IVORY
  g.font = '600 40px system-ui, sans-serif'
  const titleW = isVideo ? 700 : 690
  let title = source.title || '360°'
  while (g.measureText(title).width > titleW && title.length > 4) title = title.slice(0, -2)
  if (title !== (source.title || '360°')) title = title.trimEnd() + '…'
  g.fillText(title, 40, 58)
  if (isVideo) {
    g.fillStyle = AMBER
    g.font = '500 34px system-ui, sans-serif'
    g.textAlign = 'right'
    g.fillText(`${fmtT(t)} / ${fmtT(d)}`, CW - 40, 58)
    g.textAlign = 'left'
    // seek bar
    g.fillStyle = '#22303a'
    g.beginPath()
    g.roundRect(bar.x, bar.y, bar.w, bar.h, 9)
    g.fill()
    g.fillStyle = hover === 'seek' ? '#f0c88a' : AMBER
    g.beginPath()
    g.roundRect(bar.x, bar.y, Math.max(bar.h, bar.w * (d ? t / d : 0)), bar.h, 9)
    g.fill()
  } else {
    g.fillStyle = MUTED
    g.font = '400 28px system-ui, sans-serif'
    g.fillText(panelStatus || 'Look around · click the view to hide this panel', 40, 122)
  }
  if (isVideo && panelStatus) {
    g.fillStyle = MUTED
    g.font = '400 26px system-ui, sans-serif'
    g.fillText(panelStatus, 40, 100)
  }
  for (const b of buttons) {
    const on = hover === b.id
    g.fillStyle = on ? AMBER : '#1c2a34'
    g.beginPath()
    g.roundRect(b.x, b.y, b.w, b.h, 20)
    g.fill()
    if (b.id === 'exit' && !on) {
      g.strokeStyle = AMBER
      g.lineWidth = 3
      g.stroke()
    }
    const fg = on ? '#101b23' : IVORY
    g.fillStyle = fg
    const cx = b.x + b.w / 2
    const cy = b.y + b.h / 2
    if (b.id === 'play') {
      if (playing) {
        g.fillRect(cx - 22, cy - 26, 16, 52)
        g.fillRect(cx + 6, cy - 26, 16, 52)
      } else {
        g.beginPath()
        g.moveTo(cx - 18, cy - 28)
        g.lineTo(cx + 26, cy)
        g.lineTo(cx - 18, cy + 28)
        g.closePath()
        g.fill()
      }
    } else {
      g.font = '700 36px system-ui, sans-serif'
      g.textAlign = 'center'
      const label = b.id === 'back' ? '« 10 s' : b.id === 'fwd' ? '10 s »' : 'EXIT VR'
      g.fillText(label, cx, cy + 2)
      g.textAlign = 'left'
    }
  }
  panelTex.needsUpdate = true
}

const head = new Vector3()
const fwd = new Vector3()
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
  if (!panel.visible) placePanel()
  panel.visible = true
}
function togglePanel() {
  if (panel.visible) panel.visible = false
  else showPanel()
}

function togglePlay() {
  if (!video) return
  if (video.paused || video.ended) {
    video.play().catch(() => {
      video.muted = true
      video.play().catch(() => {})
    })
  } else video.pause()
}
function seekBy(s: number) {
  if (!video) return
  const d = video.duration || Infinity
  video.currentTime = Math.min(Math.max(0, video.currentTime + s), d - 0.1)
}

function act(id: BtnId, frac: number) {
  if (id === 'exit') exitVR()
  else if (id === 'play') togglePlay()
  else if (id === 'back') seekBy(-10)
  else if (id === 'fwd') seekBy(10)
  else if (id === 'seek' && video?.duration) video.currentTime = Math.min(Math.max(0, frac), 0.999) * video.duration
}

// ---------------------------------------------------------------- pointing
const raycaster = new Raycaster()
interface Hit {
  id: BtnId | null
  frac: number
  point: Vector3
}
function hitPanel(origin: Vector3, dir: Vector3): Hit | null {
  if (!panel.visible) return null
  raycaster.set(origin, dir)
  const h = raycaster.intersectObject(panel, false)[0]
  if (!h || !h.uv) return null
  const px = h.uv.x * CW
  const py = (1 - h.uv.y) * CH
  let id: BtnId | null = buttons.find((b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h)?.id ?? null
  if (!id && isVideo && px >= bar.x - 10 && px <= bar.x + bar.w + 10 && py >= bar.y - 24 && py <= bar.y + bar.h + 24) id = 'seek'
  return { id, frac: (px - bar.x) / bar.w, point: h.point }
}
function select(origin: Vector3, dir: Vector3) {
  const h = hitPanel(origin, dir)
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
    if (a && !prev.a) togglePlay()
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
  if (video && videoTex && video.readyState >= 2 && video.currentTime !== lastVideoT) {
    lastVideoT = video.currentTime
    videoTex.needsUpdate = true
  }
  if (inHeadset) {
    pollGamepads()
    let h: BtnId | null = null
    for (const p of pointers) {
      if (!p.active) continue
      rayOf(p.c)
      const hit = hitPanel(ro, rd)
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
  drawPanel()
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
  hover = hitPanel(ro, rd)?.id ?? null
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
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopImmediatePropagation()
    exitVR()
  } else if (e.key === ' ' && video) {
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
    if (video) showVideo(video)
    else
      showPhoto().catch((e) => {
        console.warn('[vr] photo failed', e)
        panelStatus = 'This 360 photo could not be loaded.'
      })
  } catch (e) {
    console.warn('[vr] could not start', e)
    pageStatus.value = 'VR could not start on this device.'
    session?.end().catch(() => {})
    if (!session) setTimeout(() => (vrState.value = null), 2500)
  }
})

onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener('keydown', onKey, true)
  window.removeEventListener('resize', onResize)
  if (session) {
    session.removeEventListener('end', onSessionEnd)
    session.end().catch(() => {}) // already ended in the normal path
  }
  if (video) {
    video.pause()
    video.removeAttribute('src')
    video.load()
  }
  renderer?.setAnimationLoop(null)
  sphereMat.map?.dispose()
  sphereGeo.dispose()
  sphereMat.dispose()
  panelTex.dispose()
  panel.geometry.dispose()
  ;(panel.material as MeshBasicMaterial).dispose()
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
      <span v-if="!inHeadset" class="font-pixel text-[11px] text-amber bg-ink/70 rounded px-2 py-1">VR PREVIEW</span>
      <button class="btn" @click="exitVR()">Exit VR</button>
    </div>
  </div>
</template>
