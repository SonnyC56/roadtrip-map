// Shape expected by the StorySplat / XR Gallery viewers (kept from the pre-manifest app).
// The manifest adapter in lib/manifest.ts converts 'splat' / 'xr-scene' items into this.

export interface SplatConfig {
  sceneId?: string // StorySplat scene ID for API fetch
  sceneUrl?: string // Direct URL to scene JSON
  autoPlay?: boolean
  showUI?: boolean
  revealEffect?: 'fast' | 'medium' | 'slow' | 'none'
}

export interface XRHotspot {
  id: string
  position: { x: number; y: number; z: number }
  type: 'info' | 'audio' | 'navigation'
  label?: string
  infoTitle?: string
  infoDescription?: string
  targetSceneId?: string
}

export interface XRStage {
  id: string
  name?: string
  skybox: {
    type: 'video' | 'image' | 'color'
    url?: string
    hlsUrl?: string
    color?: string
    rotation?: number
  }
  hotspots?: XRHotspot[]
  audioUrl?: string
  audioVolume?: number
}

export interface XRSceneConfig {
  configUrl?: string
  stages: XRStage[]
  navigation?: {
    type: 'floorplan' | 'map' | 'none'
    showMinimap?: boolean
  }
  globalAudio?: {
    url: string
    volume?: number
    loop?: boolean
  }
}

export interface MediaItem {
  id: string
  type: string
  url: string
  thumbnail?: string
  caption?: string
  timestamp: string
  location?: { lat: number; lng: number; isInferred?: boolean }
  splatConfig?: SplatConfig
  xrConfig?: XRSceneConfig
}
