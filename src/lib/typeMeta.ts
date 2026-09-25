import type { MediaType } from './manifest'

export interface TypeMeta {
  label: string
  short: string
  color: string
  glyph: string
}

export const TYPE_META: Record<MediaType, TypeMeta> = {
  photo: { label: 'Photos', short: 'Photo', color: '#F5F1E7', glyph: '' },
  video: { label: 'Videos', short: 'Video', color: '#E6B56A', glyph: '▶' },
  pano: { label: '360 photos', short: '360 photo', color: '#517D7E', glyph: '360' },
  'pano-video': { label: '360 videos', short: '360 video', color: '#AE7E36', glyph: '360▶' },
  splat: { label: '3D scenes', short: '3D scene', color: '#DDAA5E', glyph: '3D' },
  'xr-scene': { label: 'XR scenes', short: 'XR scene', color: '#F4D38F', glyph: 'XR' },
}

export const LOC_NOTE: Record<string, string> = {
  timeline: 'Placed from Sonny’s location timeline (no GPS in the file)',
  stop: 'Placed at the stop (approximate location)',
}
