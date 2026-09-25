# Sonny's Roadtrip 2025 — the map

One map for the whole trip: all 36 episodes on their legs of the route, every photo and video where it was taken,
360 photos and 360 videos you can look around in, and the animated timeline playback.

Static site: Vue 3 + TypeScript + Pinia + Vite + Tailwind 4 + Leaflet, hosted on Vercel. There is no backend and
no Firebase. All media and metadata come from a Cloudflare R2 bucket at `VITE_MEDIA_BASE`.

## Data

Everything is read relative to `VITE_MEDIA_BASE`:

| Key | What |
| --- | --- |
| `manifest.json` | Trip info, stops, episodes (with each leg's `path`), media index. Contract: `D:/RoadTrip-Production/site/manifest-schema.md` (v1). Media with `ready: false` are skipped. Big media lists may be split: `media_files: ["media-01.json", …]` or string entries inside `media`. |
| `route/route.json` | `[[lat, lon, t_unix], …]`. If missing, the site falls back to `public/roadtrip2025_mod.json`. |
| `episodes/eNN/…`, `photos/`, `thumbs/`, `videos/`, `posters/`, `pano/<id>/…`, `pano360v/` | Media files referenced by the manifest. |
| `brand/logo.svg` | Header logo (falls back to a text wordmark). |
| `brand/fonts/…` | `fonts.css` if present; otherwise `BebasNeue-Regular.woff2`, `BarlowCondensed-Medium.woff2`, `BarlowCondensed-Bold.woff2`, `SpaceGrotesk-Variable.woff2` (or `-Regular`), `pixel.woff2`. Anything missing falls back to Google Fonts (pixel font: Silkscreen). |
| `brand/magnets.json` | Optional. Array or `{ "magnets": [...] }` of `{ label, src (e.g. "brand/magnets/glacier.webp"), lat, lon, kind: "park"|"place"|"state", episode }`. `stop` can replace lat/lon. |

Optional media types (not in schema v1) kept from the earlier site: `type: "splat"` with `splat: { sceneId | sceneUrl }`
opens the StorySplat viewer; `type: "xr-scene"` with `xr: { configUrl, stages }` opens the XR gallery viewer.

## Local development

```bash
npm install
cp .env.example .env.local           # VITE_MEDIA_BASE=http://localhost:8787

# terminal 1: serve the bucket folder with CORS + Range (no extra deps)
npm run serve:media -- /mnt/d/RoadTrip-Site-Assets 8787

# terminal 2
npm run dev
```

`scripts/serve-media.mjs` takes `[dir] [port]` (defaults: `$MEDIA_DIR` or `/mnt/d/RoadTrip-Site-Assets`, `8787`).

`npm run build` type-checks (vue-tsc) and builds to `dist/`.

## Deploying (Vercel)

Set one environment variable in the Vercel project, then redeploy (Vite bakes it in at build time):

- `VITE_MEDIA_BASE` = the R2 bucket's public URL (r2.dev URL or custom domain), no trailing slash.
- Optional `VITE_BASEMAP` (see below).

The R2 bucket needs a CORS policy, because the site fetches JSON and the 360 viewers load tiles and video as WebGL
textures:

```json
[
  {
    "AllowedOrigins": ["https://<your-site>.vercel.app", "https://<custom-domain>", "http://localhost:5173"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges"],
    "MaxAgeSeconds": 86400
  }
]
```

## Basemap

`VITE_BASEMAP` picks the dark basemap:

- `esri-dark` (default): Esri World Dark Gray Canvas, no key. Attribution: Esri, HERE, Garmin, OpenStreetMap contributors.
- `stadia-dark`: Stadia Alidade Smooth Dark. Works on localhost; for production add the site's domain to a free Stadia
  Maps account (no key in the code). Attribution: Stadia Maps, OpenMapTiles, OpenStreetMap contributors.
- `carto-dark`: CARTO dark_matter. CARTO now watermarks tiles requested without an API key.
- Any `https://…/{z}/{x}/{y}.png` template.

## Using the site

- Click a leg of the route or an episode badge to play that episode (16:9 on wide screens, 9:16 on phones in portrait,
  with a toggle). The episode list is in the sidebar (bottom sheet on phones). E36, the epilogue, sits at home.
- Photos, videos and 360s are clustered; hover for thumbnails, click to open the lightbox (← → to step through in time
  order). Items placed from the location timeline instead of GPS say so in the caption.
- Layer chips toggle Episodes / Photos / Videos / 360 photos / 360 videos / Magnets. Explore tab: stop filter, date
  range, reset.
- The timeline bar plays the trip; the route draws itself and media appear as they were taken.
- Deep links: `#e12` opens episode 12, `#m=<media id>` opens a photo or video.

## Layout

```
src/lib/manifest.ts      data contract, loaders, URL helper
src/lib/brand.ts         brand fonts + logo
src/lib/basemap.ts       basemap presets
src/stores/trip.ts       all state: data, layers, filters, timeline, selection
src/components/TripMap.vue         Leaflet map (route, legs, badges, clusters, magnets)
src/components/TripPanel.vue       sidebar / mobile bottom sheet
src/components/TimelineBar.vue     playback
src/components/EpisodePlayer.vue   episode modal
src/components/MediaLightbox.vue   photo / video / 360 lightbox
src/components/Media360Viewer.vue  photo-sphere-viewer (tiles + video adapters), lazy-loaded
scripts/serve-media.mjs            local static server with CORS + Range
```
