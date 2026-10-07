import { shallowRef } from 'vue'

export type MasterFormat = '16x9' | '9x16' | 'vr'
export interface MasterChapter { ep: number; title: string; kind?: string; start: number; end?: number; start_frame?: number; end_frame?: number }
export interface Master {
  version: string; status: string; format: MasterFormat; src: string; duration: number
  bytes: number; sha256: string; vtt?: string; frames?: number; chapters?: MasterChapter[]
  title?: string; collection?: string
}

const collectionEpisodes = {
  '01-08-With-Intro': Array.from({ length: 9 }, (_, i) => i),
  '09-15': Array.from({ length: 7 }, (_, i) => i + 9),
  '16-25': Array.from({ length: 10 }, (_, i) => i + 16),
  '26-35': Array.from({ length: 10 }, (_, i) => i + 26),
} as const
export type CollectionId = keyof typeof collectionEpisodes

function verifiedFile(m: Partial<Master> | null, format: MasterFormat, prefix: string): m is Master {
  return !!m && m.status === 'ready' && m.format === format
    && typeof m.src === 'string' && m.src.startsWith(prefix) && m.src.endsWith('.mp4')
    && !m.src.includes('..') && !m.src.includes('\\')
    && typeof m.duration === 'number' && Number.isFinite(m.duration) && m.duration > 0
    && Number.isSafeInteger(m.bytes) && m.bytes! > 0 && /^[a-f0-9]{64}$/.test(m.sha256 || '')
}

function verifiedChapters(m: Master, episodes: readonly number[]): boolean {
  const c = m.chapters
  return Number.isSafeInteger(m.frames) && !!c && c.length === episodes.length
    && c.every((x, i) => x.ep === episodes[i]
      && Number.isSafeInteger(x.start_frame) && Number.isSafeInteger(x.end_frame)
      && x.start_frame === (i ? c[i - 1]!.end_frame : 0) && x.end_frame! > x.start_frame!
      && Number.isFinite(x.start) && Math.abs(x.start - x.start_frame! / 30) < .00001
      && typeof x.end === 'number' && Number.isFinite(x.end) && Math.abs(x.end - x.end_frame! / 30) < .00001)
    && c[c.length - 1]!.end_frame === m.frames && Math.abs(m.duration - m.frames! / 30) < .00001
}

/** A full film is always intro through E35; E36 stays separate. */
export function verifiedMaster(value: unknown, format: MasterFormat): Master | null {
  const m = value as Partial<Master> | null
  const version = m?.version === 'v06' || m?.version === 'v07' || m?.version === 'v08' ? m.version : null
  const prefix = format === 'vr' ? `masters/vr-${version}/` : format === '9x16' ? `masters/portrait-${version}/` : `masters/${version}/`
  if (!version || !verifiedFile(m, format, prefix)) return null
  if (version === 'v08' && !verifiedChapters(m, Array.from({ length: 36 }, (_, i) => i))) return null
  return m
}

/** Collection indexes have their own exact episode ranges; never relax the full-film gate. */
export function verifiedCollection(value: unknown, format: MasterFormat, id: CollectionId): Master | null {
  const m = value as Partial<Master> | null
  if (!Object.prototype.hasOwnProperty.call(collectionEpisodes, id) || m?.version !== 'v08'
    || !verifiedFile(m, format, `supercuts/v08/${id}/${format}/`)
    || !verifiedChapters(m, collectionEpisodes[id])) return null
  return { ...m, collection: id }
}

export const uninterrupted = shallowRef<Master | null>(null)
