/** Public analytics never receives private review routes, URLs, captions or free text. */
export const publicHosts = new Set(['2025roadtrip.com', 'www.2025roadtrip.com', 'roadtrip-map.vercel.app'])
export const publicPaths = new Set(['/', '/methodology', '/methodology/'])
export const optOutKey = 'roadtrip-analytics-disabled'

export function allowedAnalytics(url: string, dev: boolean, dnt?: string | null, gpc?: boolean, optedOut = false): boolean {
  try {
    const u = new URL(url)
    return !dev && !optedOut && dnt !== '1' && !gpc && u.protocol === 'https:' && publicHosts.has(u.hostname)
      && publicPaths.has(u.pathname) && !u.searchParams.has('vr') && !u.searchParams.has('analytics_off')
  } catch { return false }
}

export function analyticsUrl(raw: string): string | null {
  try {
    const u = new URL(raw)
    if (!publicHosts.has(u.hostname) || !publicPaths.has(u.pathname)) return null
    const clean = new URL(u.pathname, u.origin)
    // Campaign tags are public marketing labels, never arbitrary query strings or search terms.
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
      const value = u.searchParams.get(key)
      if (value && /^[a-z0-9_-]{1,64}$/i.test(value)) clean.searchParams.set(key, value)
    }
    return clean.href
  } catch { return null }
}

export function safeId(value: unknown): string {
  return typeof value === 'string' && /^[a-z0-9_.:-]{1,100}$/i.test(value) ? value : 'unknown'
}

export function episodeContent(ep: number, format: string, version?: string): string {
  return `E${String(ep).padStart(2, '0')}:${safeId(version || 'unknown')}:${format === 'vr' ? '360' : safeId(format)}`
}

export function mediaContent(item: { id: string; type: string }): string {
  return `media:${safeId(item.id)}:${safeId(item.type)}`
}
