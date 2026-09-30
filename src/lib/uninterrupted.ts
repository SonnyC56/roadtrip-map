import { shallowRef } from 'vue'
export type MasterFormat = '16x9' | 'vr'
export interface Master { version: string; status: string; format: MasterFormat; src: string; duration: number; bytes: number; sha256: string; vtt?: string }
export function verifiedMaster(value: unknown, format: MasterFormat): Master | null {
  const m = value as Partial<Master> | null
  const version = m?.version === 'v06' || m?.version === 'v07' ? m.version : null
  const prefix = format === 'vr' ? `masters/vr-${version}/` : `masters/${version}/`
  return m && version && m.status === 'ready' && m.format === format
    && typeof m.src === 'string' && m.src.startsWith(prefix) && m.src.endsWith('.mp4')
    && !m.src.includes('..') && typeof m.duration === 'number' && m.duration > 0
    && typeof m.bytes === 'number' && m.bytes > 0 && /^[a-f0-9]{64}$/.test(m.sha256 || '')
    ? m as Master : null
}
export const uninterrupted = shallowRef<Master | null>(null)
