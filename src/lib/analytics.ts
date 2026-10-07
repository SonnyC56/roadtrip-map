import { inject, pageview, track } from '@vercel/analytics'
import { allowedAnalytics, analyticsUrl, optOutKey, safeId } from './analyticsPolicy'
export { episodeContent, mediaContent } from './analyticsPolicy'

let initialized = false
let events = 0
const errorKinds = new Set<string>()

export function analyticsEnabled(): boolean {
  let optedOut = false
  try { optedOut = localStorage.getItem(optOutKey) === '1' } catch { /* storage may be disabled */ }
  return allowedAnalytics(location.href, import.meta.env.DEV, navigator.doNotTrack,
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl, optedOut)
}

/** Exactly two bounded properties fits standard Vercel Pro (no Analytics Plus add-on). */
export function trackEvent(name: string, properties: Record<string, string | number | boolean> = {}): void {
  if (!initialized || !analyticsEnabled() || events >= 1500 || (window.vaq?.length || 0) >= 100) return
  const entries = Object.entries(properties)
  if (entries.length > 2 || !/^[a-z_]{1,60}$/.test(name)) return
  if (entries.some(([key, value]) => !/^[a-z_]{1,40}$/.test(key) ||
    (typeof value === 'string' && safeId(value) !== value) ||
    (typeof value === 'number' && !Number.isFinite(value)))) return
  try { track(name, properties); events++ } catch { /* analytics must never interrupt playback */ }
}

export function trackFailure(area: string, reason: string): void {
  const key = `${area}:${reason}`
  if (errorKinds.has(key) || errorKinds.size >= 20) return
  errorKinds.add(key)
  trackEvent('site_error', { area, reason })
}

export function initAnalytics(): void {
  if (initialized || !analyticsEnabled()) return
  initialized = true
  inject({ mode: 'production', debug: false, disableAutoTrack: true, beforeSend(event) {
    if (!analyticsEnabled()) return null
    const url = analyticsUrl(event.url)
    return url ? { ...event, url } : null
  } })
  const view = () => {
    if (!analyticsEnabled()) return
    const path = analyticsUrl(location.href)
    if (path) pageview({ path: new URL(path).pathname, route: location.pathname })
  }
  view()
  window.addEventListener('pageshow', e => { if (e.persisted) view() })
  // Only error categories: never exception messages, stack traces, resource URLs, or DOM text.
  window.addEventListener('error', e => { if (e instanceof ErrorEvent) trackFailure('app', 'javascript') })
  window.addEventListener('unhandledrejection', () => trackFailure('app', 'promise'))
  document.addEventListener('click', e => {
    const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!link || !/^https?:$/.test(link.protocol)) return
    if (link.origin !== location.origin) trackEvent('outbound_link', { host: safeId(link.hostname) })
    else if (link.pathname === '/methodology/') trackEvent('navigation', { destination: 'methodology' })
  })
  void import('web-vitals').then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
    const report = (metric: { name: string; value: number; rating: string }) => {
      trackEvent('web_vital', { metric: `${metric.name}:${metric.rating}`, value: Math.round(metric.value * 1000) / 1000 })
    }
    onCLS(report); onINP(report); onLCP(report); onFCP(report); onTTFB(report)
  }).catch(() => {})
}
