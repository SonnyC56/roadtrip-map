import { mediaUrl } from './manifest'

/** Separate CORS texture requests from older, non-CORS image/video browser caches. */
export function textureUrl(key: string): string {
  const url = mediaUrl(key)
  if (!url || /^(data:|blob:)/i.test(url)) return url
  const [path, hash] = url.split('#')
  return `${path}${path!.includes('?') ? '&' : '?'}texture=2${hash ? `#${hash}` : ''}`
}
