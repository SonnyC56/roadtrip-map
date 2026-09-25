// Brand loading: fonts + logo from ${VITE_MEDIA_BASE}/brand/, with fallbacks.
import { mediaUrl } from './manifest'

interface Face {
  family: string
  weight: string
  files: string[] // candidate bucket keys, first that loads wins
  google: string // Google Fonts family spec (fallback)
}

const FACES: Face[] = [
  {
    family: 'Bebas Neue',
    weight: '400',
    files: ['brand/fonts/BebasNeue-Regular.woff2', 'brand/fonts/bebas-neue.woff2', 'brand/fonts/BebasNeue-Regular.ttf'],
    google: 'Bebas+Neue',
  },
  {
    family: 'Barlow Condensed',
    weight: '500',
    files: ['brand/fonts/BarlowCondensed-Medium.woff2', 'brand/fonts/barlow-condensed-500.woff2'],
    google: 'Barlow+Condensed:wght@500;600;700',
  },
  {
    family: 'Barlow Condensed',
    weight: '700',
    files: ['brand/fonts/BarlowCondensed-Bold.woff2', 'brand/fonts/barlow-condensed-700.woff2'],
    google: 'Barlow+Condensed:wght@500;600;700',
  },
  {
    family: 'Space Grotesk',
    weight: '400 700',
    files: ['brand/fonts/SpaceGrotesk-Variable.woff2', 'brand/fonts/SpaceGrotesk-Regular.woff2', 'brand/fonts/space-grotesk.woff2'],
    google: 'Space+Grotesk:wght@400;500;700',
  },
  {
    family: 'Roadtrip Pixel',
    weight: '400',
    files: ['brand/fonts/pixel.woff2', 'brand/fonts/RoadtripPixel.woff2'],
    google: 'Silkscreen', // loaded under its own name; CSS stack falls through to it
  },
]

async function tryFace(face: Face): Promise<boolean> {
  for (const f of face.files) {
    try {
      const ff = new FontFace(face.family, `url(${mediaUrl(f)})`, { weight: face.weight, display: 'swap' })
      await ff.load()
      document.fonts.add(ff)
      return true
    } catch {
      /* try next */
    }
  }
  return false
}

export async function loadBrandFonts(): Promise<void> {
  if (typeof FontFace === 'undefined') return
  // 1) an optional stylesheet published with the brand kit
  const css = mediaUrl('brand/fonts/fonts.css')
  try {
    const head = await fetch(css, { method: 'HEAD' })
    if (head.ok) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = css
      document.head.appendChild(link)
      return
    }
  } catch {
    /* ignore */
  }
  // 2) conventional file names; 3) Google Fonts for anything missing
  const results = await Promise.all(FACES.map(tryFace))
  const missing = new Set<string>()
  FACES.forEach((f, i) => {
    if (!results[i]) missing.add(f.google)
  })
  if (missing.size) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?${[...missing].map((g) => `family=${g}`).join('&')}&display=swap`
    document.head.appendChild(link)
  }
}

export const LOGO_URL = mediaUrl('brand/logo.svg')
