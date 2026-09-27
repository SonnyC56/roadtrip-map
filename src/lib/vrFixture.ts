// DEV ONLY (never in a production build: imported behind `import.meta.env.DEV`).
// Until the VR edition of the film exists, `npm run dev` + `?vrfixture` fakes episodes[].formats.vr by pointing
// every episode at one of the raw 360 clips in the bucket (pano360v/*.mp4), so the in-VR playlist
// (auto-advance, Up next, prev/next, episode list) can be exercised. Combine with ?vr=preview on a desktop.
import type { Manifest, RawMedia } from './manifest'

export function applyVRFixture(manifest: Manifest, media: RawMedia[]): void {
  const clips = media.filter((m) => m.type === 'pano-video' && m.ready !== false && m.src)
  if (!clips.length) return
  const eps = manifest.episodes || []
  const step = Math.max(1, Math.floor(clips.length / Math.max(1, eps.length)))
  eps.forEach((e, i) => {
    const c = clips[(i * step) % clips.length]!
    e.formats = { ...e.formats, vr: { src: c.src, poster: c.poster || undefined, duration: c.duration } }
  })
  console.info(`[vrfixture] formats.vr faked for ${eps.length} episodes from pano360v clips`)
}
