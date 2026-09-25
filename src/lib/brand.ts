// Brand loading: fonts + logo + medals from ${VITE_MEDIA_BASE}/brand/, with fallbacks.
//  brand/brand.json  → { fonts, logos, magnets, medals, tokens }
//  brand/tokens.json → { colors, fonts: { display|condensed|body: { family, src, weight } } }
import { ref } from 'vue'
import { mediaUrl } from './manifest'

export interface BrandIndex {
  logos?: Record<string, string>
  medals?: Record<string, string>
  magnets?: string
  tokens?: string
}

interface FontSpec {
  family: string
  src: string
  weight?: string | number
}

const GOOGLE: Record<string, string> = {
  'Bebas Neue': 'Bebas+Neue',
  'Barlow Condensed': 'Barlow+Condensed:wght@500;600;700',
  'Space Grotesk': 'Space+Grotesk:wght@400;500;700',
}

// Used if tokens.json is missing or lists no fonts.
const CONVENTIONAL: FontSpec[] = [
  { family: 'Bebas Neue', src: 'brand/fonts/bebasneue-regular.ttf', weight: 400 },
  { family: 'Barlow Condensed', src: 'brand/fonts/barlowcondensed-semibold.ttf', weight: 600 },
  { family: 'Space Grotesk', src: 'brand/fonts/spacegrotesk-variable.ttf', weight: '300 700' },
]

export const brandIndex = ref<BrandIndex | null>(null)
export const logoUrl = ref(mediaUrl('brand/logo/sonnys-roadtrip-2025-outlined.svg'))

async function json<T>(key: string): Promise<T | null> {
  try {
    const r = await fetch(mediaUrl(key), { cache: 'no-cache' })
    return r.ok ? ((await r.json()) as T) : null
  } catch {
    return null
  }
}

async function loadFace(f: FontSpec): Promise<boolean> {
  try {
    const face = new FontFace(f.family, `url(${mediaUrl(f.src)})`, { weight: String(f.weight ?? 400), display: 'swap' })
    await face.load()
    document.fonts.add(face)
    return true
  } catch {
    return false
  }
}

function googleFallback(families: string[]) {
  const specs = families.map((f) => GOOGLE[f]).filter(Boolean)
  specs.push('Silkscreen') // pixel counters (no pixel webfont in the brand kit)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?${[...new Set(specs)].map((g) => `family=${g}`).join('&')}&display=swap`
  document.head.appendChild(link)
}

export async function loadBrand(brandKey = 'brand/brand.json'): Promise<void> {
  const [idx, tokens] = await Promise.all([
    json<BrandIndex>(brandKey),
    json<{ fonts?: Record<string, FontSpec> }>('brand/tokens.json'),
  ])
  brandIndex.value = idx
  const logos = idx?.logos || {}
  const logo = logos['sonnys-roadtrip-2025-outlined'] || Object.values(logos).find((v) => v.endsWith('.svg'))
  if (logo) logoUrl.value = mediaUrl(logo)

  if (typeof FontFace === 'undefined') return
  const specs = tokens?.fonts ? Object.values(tokens.fonts).filter((f) => f?.family && f?.src) : CONVENTIONAL
  const ok = await Promise.all(specs.map(loadFace))
  const loaded = new Set(specs.filter((_, i) => ok[i]).map((f) => f.family))
  googleFallback(Object.keys(GOOGLE).filter((f) => !loaded.has(f)))
}
