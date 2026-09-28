import { shallowRef } from 'vue'
export type MasterFormat = '16x9' | 'vr'
export interface Master { version: string; status: string; format: MasterFormat; src: string; duration: number; bytes: number; sha256: string; vtt?: string }
export function verifiedMaster(value: unknown, format: MasterFormat): Master | null {
  const m = value as Partial<Master> | null
  const prefix = format === 'vr' ? 'masters/vr-v06/' : 'masters/v06/'
  return m && m.version === 'v06' && m.status === 'ready' && m.format === format
    && typeof m.src === 'string' && m.src.startsWith(prefix) && m.src.endsWith('.mp4')
    && !m.src.includes('..') && typeof m.duration === 'number' && m.duration > 0
    && typeof m.bytes === 'number' && m.bytes > 0 && /^[a-f0-9]{64}$/.test(m.sha256 || '')
    ? m as Master : null
}
export const uninterrupted = shallowRef<Master | null>(null)
