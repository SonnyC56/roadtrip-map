import { shallowRef } from 'vue'
export type MasterFormat = '16x9' | '9x16' | 'vr'
export interface MasterChapter { ep: number; title: string; kind?: string; start: number; end?: number; start_frame?: number; end_frame?: number }
export interface Master { version: string; status: string; format: MasterFormat; src: string; duration: number; bytes: number; sha256: string; vtt?: string; frames?: number; chapters?: MasterChapter[] }
export function verifiedMaster(value: unknown, format: MasterFormat): Master | null {
  const m = value as Partial<Master> | null
  const version = m?.version === 'v06' || m?.version === 'v07' || m?.version === 'v08' ? m.version : null
  const prefix = format === 'vr' ? `masters/vr-${version}/` : format === '9x16' ? `masters/portrait-${version}/` : `masters/${version}/`
  if (!m || !version || m.status !== 'ready' || m.format !== format
    || typeof m.src !== 'string' || !m.src.startsWith(prefix) || !m.src.endsWith('.mp4')
    || m.src.includes('..') || typeof m.duration !== 'number' || m.duration <= 0
    || typeof m.bytes !== 'number' || m.bytes <= 0 || !/^[a-f0-9]{64}$/.test(m.sha256 || '')) return null
  if (version === 'v08') {
    const c = m.chapters
    if (!Number.isInteger(m.frames) || !c || c.length !== 36 || c.some((x, i) =>
      x.ep !== i || !Number.isInteger(x.start_frame) || !Number.isInteger(x.end_frame)
      || x.start_frame !== (i ? c[i - 1]!.end_frame : 0) || x.end_frame! <= x.start_frame!
      || Math.abs(x.start - x.start_frame! / 30) > .00001
      || typeof x.end !== 'number' || Math.abs(x.end - x.end_frame! / 30) > .00001)
      || c[35]!.end_frame !== m.frames || Math.abs(m.duration - m.frames! / 30) > .00001) return null
  }
  return m as Master
}
export const uninterrupted = shallowRef<Master | null>(null)
