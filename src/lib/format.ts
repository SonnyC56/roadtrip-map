const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Parts {
  y: number
  mo: number
  d: number
  h?: number
  mi?: number
}

/** Parse the wall-clock parts of an ISO string without converting time zones. */
function parts(iso: string): Parts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso || '')
  if (!m) return null
  return { y: +m[1]!, mo: +m[2]! - 1, d: +m[3]!, h: m[4] ? +m[4] : undefined, mi: m[5] ? +m[5] : undefined }
}

/** "Aug 12" */
export function shortDate(iso: string): string {
  const p = parts(iso)
  return p ? `${MON[p.mo]} ${p.d}` : ''
}

/** "Aug 12 – 14" / "Aug 30 – Sep 1" / "Aug 18" */
export function dateSpan(a: string, b: string): string {
  const pa = parts(a)
  const pb = parts(b)
  if (!pa) return ''
  if (!pb || (pa.mo === pb.mo && pa.d === pb.d)) return shortDate(a)
  if (pa.mo === pb.mo) return `${MON[pa.mo]} ${pa.d} – ${pb.d}`
  return `${shortDate(a)} – ${shortDate(b)}`
}

/** "Wed, Aug 20, 2025 · 2:32 PM" using the photo's local wall clock. */
export function localDateTime(iso: string): string {
  const p = parts(iso)
  if (!p) return ''
  const dow = DOW[new Date(Date.UTC(p.y, p.mo, p.d)).getUTCDay()]
  let s = `${dow}, ${MON[p.mo]} ${p.d}, ${p.y}`
  if (p.h !== undefined && p.mi !== undefined) {
    const h12 = p.h % 12 || 12
    s += ` · ${h12}:${String(p.mi).padStart(2, '0')} ${p.h < 12 ? 'AM' : 'PM'}`
  }
  return s
}

export function fmtDuration(sec?: number): string {
  if (!sec || !Number.isFinite(sec)) return ''
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Date input value (YYYY-MM-DD) from a date-only string or ms. */
export function toDateInput(v: number): string {
  const d = new Date(v)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export const pad2 = (n: number) => String(n).padStart(2, '0')
