import { CanvasTexture, Group, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Camera } from 'three'

export interface HudArt { url: string; frameWidth?: number; frameHeight?: number; columns?: number; frames?: number; fps?: number }
export interface HudCue { id: string; kind: 'park' | 'magnet' | 'narrator'; start: number; end: number; art: HudArt }
export interface HudLocation { start: number; end: number; title: string; date: string; miles: number; endMiles: number; through: number; endThrough: number }
export interface HudDocument { version: number; cleanPicture: boolean; duration: number; locations: HudLocation[]; cues: HudCue[]; route: [number, number][]; routeFractions: number[] }

// Native scene planes, shared by both XR eyes. Never a DOM overlay stretched onto a sphere.
// Timings always derive from media time, so pause, seek, and replay restore the same HUD state.
export function activeAt<T extends { start: number; end: number }>(items: T[], time: number): T[] {
  return items.filter(c => c.start <= time && time < c.end)
}
const clamp = (x: number) => Math.max(0, Math.min(1, x))
export function cueAlpha(c: { start: number; end: number }, t: number): number {
  return clamp(Math.min((t - c.start) / .35, (c.end - t) / .35))
}
export function routeState(c: HudLocation, t: number) {
  const u = clamp((t-c.start)/Math.max(.001,c.end-c.start))
  return { miles: c.miles+(c.endMiles-c.miles)*u, through: c.through+(c.endThrough-c.through)*u }
}

/** Keep the same scene panels inside a phone viewport and above its touch controls. XR uses native dimensions. */
export function hudLayout(width: number, height: number, footer = 156) {
  const halfH = 2*Math.tan(75*Math.PI/360)
  const halfW = halfH*width/Math.max(1,height)*.9
  const lowerScale=Math.min(1,2*halfW/1.42), awardScale=Math.min(1,2*halfW/.75), narratorScale=Math.min(1,2*halfW/.62)
  const lowerHalfH=1.42*250/1440*lowerScale/2
  const lowerY=Math.max(-.59,-halfH+2*halfH*(footer+12)/height+lowerHalfH)
  return {lowerScale,awardScale,narratorScale,lowerY,
    awardX:Math.min(.57,Math.max(0,halfW-.75*awardScale/2)),
    narratorX:-Math.min(.55,Math.max(0,halfW-.62*narratorScale/2)),
    narratorY:Math.max(-.29,lowerY+lowerHalfH+.62*250/720*narratorScale/2+.04)}
}

const INK = '#101b23', IVORY = '#f5f1e7', AMBER = '#e6b56a', MUTED = '#a5b4bb'
function plane(w: number, h: number, metres: number, x: number, y: number) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter; texture.generateMipmaps = false
  const material = new MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })
  const mesh = new Mesh(new PlaneGeometry(metres,metres*h/w),material)
  mesh.position.set(x,y,-2); mesh.renderOrder = 9; mesh.visible = false
  return { canvas, g: canvas.getContext('2d')!, texture, material, mesh }
}
type Panel = ReturnType<typeof plane>

function panel(p: Panel) {
  const g=p.g,w=p.canvas.width,h=p.canvas.height
  g.clearRect(0,0,w,h)
  const fill=g.createLinearGradient(0,0,0,h)
  fill.addColorStop(0,'rgba(23,40,50,.94)');fill.addColorStop(1,'rgba(12,24,32,.90)')
  g.fillStyle=fill;g.strokeStyle='rgba(230,181,106,.35)';g.lineWidth=2
  g.beginPath();g.roundRect(2,2,w-4,h-4,26);g.fill();g.stroke()
  g.textBaseline='alphabetic';g.textAlign='left'
}
function fit(g: CanvasRenderingContext2D, text: string, width: number) {
  if(g.measureText(text).width<=width)return text
  let s=text
  while(s.length&&g.measureText(s+'…').width>width)s=s.slice(0,-1)
  return s+'…'
}

export class StoryHud {
  readonly group = new Group()
  private lower = plane(1440,250,1.42,0,-.59)
  private award = plane(760,340,.75,.57,.31)
  private narrator = plane(720,250,.62,-.55,-.29)
  private images = new Map<string,HTMLImageElement>()
  private data: HudDocument | null = null
  private aborted = new AbortController()
  private disposed = false
  private lastTime = -1
  private lastSignature = ''
  private narrow = false
  constructor(url: string, onError: (message: string) => void = () => {}) {
    this.group.add(this.lower.mesh,this.award.mesh,this.narrator.mesh)
    this.group.visible=false
    document.fonts.load('58px "Bebas Neue"').then(()=>{this.lastSignature=''})
    fetch(url,{signal:this.aborted.signal}).then(async response=>{
      if(!response.ok)throw new Error('HUD unavailable')
      const d=await response.json() as HudDocument
      if(d.version!==1 || d.cleanPicture!==true || !Array.isArray(d.cues) || !Array.isArray(d.locations))throw new Error('HUD needs a matching clean picture')
      const entries = await Promise.all([...new Set(d.cues.map(c=>c.art.url))].map(async src=>{
        const im=new Image();im.crossOrigin='anonymous';im.src=new URL(src,url).href
        await im.decode(); return [src,im] as const
      }))
      if(this.disposed)return
      entries.forEach(([src,im])=>this.images.set(src,im));this.data=d
    }).catch(e=>{if(!this.disposed && e.name!=='AbortError')onError('Story graphics unavailable. Video playback is unaffected.')})
  }
  resize(width: number,height: number,footer: number) {
    const l=hudLayout(width,height,footer)
    this.lower.mesh.scale.set(l.lowerScale,l.lowerScale,1);this.lower.mesh.position.y=l.lowerY
    this.award.mesh.scale.set(l.awardScale,l.awardScale,1);this.award.mesh.position.x=l.awardX
    this.narrator.mesh.scale.set(l.narratorScale,l.narratorScale,1);this.narrator.mesh.position.set(l.narratorX,l.narratorY,-2)
    this.narrow=width<600;this.lastSignature=''
  }
  private art(p: Panel,c: HudCue,t: number,x: number,y: number,w: number,h: number) {
    const im=this.images.get(c.art.url);if(!im)return
    const a=c.art; const sw=a.frameWidth||im.width,sh=a.frameHeight||im.height
    const n=Math.min((a.frames||1)-1,Math.max(0,Math.floor((t-c.start)*(a.fps||0))))
    const scale=Math.min(w/sw,h/sh),dw=sw*scale,dh=sh*scale
    p.g.drawImage(im,(n%(a.columns||1))*sw,Math.floor(n/(a.columns||1))*sh,sw,sh,x+(w-dw)/2,y+(h-dh)/2,dw,dh)
  }
  private drawLocation(c: HudLocation,t: number) {
    const p=this.lower,g=p.g;panel(p)
    g.fillStyle=AMBER;g.font=`600 ${this.narrow?32:22}px system-ui`;g.fillText('OLYMPIC  ·  WASHINGTON',34,42)
    g.fillStyle=IVORY;g.font=`${this.narrow?72:58}px "Bebas Neue", "Arial Narrow", sans-serif`;g.fillText(fit(g,c.title,930),34,115)
    const state=routeState(c,t)
    g.fillStyle=MUTED;g.font=`${this.narrow?40:31}px system-ui`;g.fillText(`${c.date}    ·    ${Math.round(state.miles).toLocaleString()} mapped miles`,34,171)
    g.fillStyle='#82959e';g.font='22px system-ui';g.fillText('SONNY’S ROADTRIP 2025',34,219)
    const pts=this.data!.route,fs=this.data!.routeFractions
    if(pts.length){
      const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const minX=Math.min(...xs),minY=Math.min(...ys)
      const scale=Math.min(345/Math.max(1,Math.max(...xs)-minX),180/Math.max(1,Math.max(...ys)-minY))
      const coord=(p:[number,number])=>[1042+(p[0]-minX)*scale,32+(p[1]-minY)*scale] as const
      g.strokeStyle='#526773';g.lineWidth=2.5;g.beginPath()
      pts.forEach((p,i)=>{const[x,y]=coord(p);if(i===0)g.moveTo(x,y);else g.lineTo(x,y)});g.stroke()
      g.strokeStyle=AMBER;g.lineWidth=3;g.beginPath();let end=coord(pts[0]!)
      for(let i=0;i<pts.length;i++){
        const fraction=fs[i]??i/(pts.length-1)
        if(fraction>state.through){
          if(i>0){const prev=pts[i-1]!,next=pts[i]!,before=fs[i-1]??(i-1)/(pts.length-1),u=clamp((state.through-before)/Math.max(.000001,fraction-before));end=coord([prev[0]+(next[0]-prev[0])*u,prev[1]+(next[1]-prev[1])*u]);g.lineTo(...end)}
          break
        }
        end=coord(pts[i]!);if(i===0)g.moveTo(...end);else g.lineTo(...end)
      }
      g.stroke();g.fillStyle=IVORY;g.beginPath();g.arc(...end,5,0,Math.PI*2);g.fill()
    }
    p.texture.needsUpdate=true
  }
  private drawAward(c: HudCue,t: number) {
    const p=this.award,g=p.g;panel(p)
    this.art(p,c,t,22,30,270,275)
    g.fillStyle=AMBER;g.font='600 26px system-ui';g.fillText(c.kind==='park'?'NATIONAL PARK':'TRIP KEEPSAKE',315,80)
    g.fillStyle=IVORY;g.font='51px "Bebas Neue", sans-serif';g.fillText('OLYMPIC',315,147)
    g.fillStyle=MUTED;g.font='31px system-ui';g.fillText(c.kind==='park'?'Park 4 of 17':'Added to the journey',315,198)
    g.fillStyle='#82959e';g.font='24px system-ui';g.fillText(c.kind==='park'?'Achievement unlocked':'The Olympic magnet',315,247)
    p.texture.needsUpdate=true
  }
  tick(time: number,camera: Camera,controlsOpen: boolean,enabled: boolean) {
    const d=this.data
    this.group.visible=!!d && enabled && !controlsOpen
    if(!d || !this.group.visible)return
    camera.getWorldPosition(this.group.position);camera.getWorldQuaternion(this.group.quaternion)
    const location=activeAt(d.locations,time)[0]
    const cues=activeAt(d.cues,time),award=cues.find(c=>c.kind==='park')||cues.find(c=>c.kind==='magnet'),voice=cues.find(c=>c.kind==='narrator')
    this.lower.mesh.visible=!!location;this.award.mesh.visible=!!award;this.narrator.mesh.visible=!!voice
    this.award.material.opacity=award?cueAlpha(award,time):0
    this.narrator.material.opacity=voice?cueAlpha(voice,time):0
    const sig=`${location?.start}:${award?.id}:${voice?.id}`
    if(sig===this.lastSignature && Math.abs(time-this.lastTime)<.095)return
    this.lastTime=time;this.lastSignature=sig
    if(location)this.drawLocation(location,time)
    if(award)this.drawAward(award,time)
    if(voice){
      const p=this.narrator;panel(p)
      // Approved pixel Sonny, microphone and LOOKING BACK tag, with the original 10 fps animation.
      this.art(p,voice,time,20,22,680,206);p.texture.needsUpdate=true
    }
  }
  dispose() {
    this.disposed=true;this.aborted.abort();this.group.removeFromParent()
    for(const p of [this.lower,this.award,this.narrator]){p.mesh.geometry.dispose();p.material.dispose();p.texture.dispose()}
    this.images.clear();this.data=null
  }
}
