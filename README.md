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
| `brand/brand.json` | Brand index (key from manifest `brand`): `logos` (loading screen uses `sonnys-roadtrip-2025-outlined`), `medals` (`{ park_id: "brand/medals/x.webp" }` shown as park medal markers at each park episode's stop), `magnets`. |
| `brand/tokens.json` | `fonts: { display, condensed, body: { family, src, weight } }`, loaded with FontFace (TTF or WOFF2). Missing families fall back to Google Fonts; the DAY/MILES pixel counters use Silkscreen from Google Fonts. |
| `brand/magnets.json` | Array or `{ magnets: [...] }` of `{ label, src, kind, episode }` plus a position: `lat`/`lon`, `stop`, or `through` (0..1 fraction along the route). Magnets show from zoom 5 up. |

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


## Production analytics

Dashboard: https://vercel.com/sonny-cirasuolos-projects/roadtrip-map/analytics

Standard Vercel Web Analytics was enabled on October 7, 2026. No Analytics Plus or Speed Insights subscription was added. The public app and methodology page use `@vercel/analytics`; `web-vitals` reports performance as custom events. Pageviews include Vercel's device, browser, country, referrer and campaign breakdowns. Collection begins after deployment; past visits cannot be recovered.

Only the production domains `www.2025roadtrip.com`, `2025roadtrip.com` and `roadtrip-map.vercel.app` and paths `/` and `/methodology/` send events. Local development, preview deployments, VR preview mode, private review paths and `?analytics_off=1` are excluded. DNT, Global Privacy Control and the local opt-out at `/privacy/` are honored. Hidden review/recording pages do not initialize the SDK or send analytics. URLs strip hashes and query data except restricted public `utm_source`, `utm_medium`, `utm_campaign`, and `utm_content` tags (letters, numbers, dash, underscore; maximum 64 characters). Do not put personal data in campaign labels.

No session replay, advertising identifiers, DOM text, captions, error messages/stacks, media URLs, microphone recordings or review responses are sent. `analytics.ts` accepts at most two bounded properties per event, matching standard Pro. Error categories are deduplicated; media timeupdate itself never becomes an event. Collection failure does not block playback. Ad blockers and network interruptions can prevent analytics; these numbers are estimates, not a census.

| Event | Meaning / properties |
| --- | --- |
| `episode_select`, `film_select`, `collection_select` | Intent to open a title, viewing format and queue vs single-file mode |
| `player_open`, `video_start` | Player opened vs actual playing; `content`, `mode` |
| `video_watch_seconds` | Non-cumulative actual playing seconds; sum `seconds`, grouped by `content` |
| `video_progress` | Unique source coverage reaches 25/50/75/90%; `content`, `percent` |
| `video_end` | End-of-file reached, which alone does not mean every scene was watched |
| `player_exit` | Close/source switch and unique percentage watched; `content`, `percent` |
| `video_start_delay_ms`, `video_buffer_seconds` | Delay from play request to playing; total rebuffer duration in flushed batches |
| `video_error`, `viewer_error`, `viewer_fallback`, `image_error`, `playback_blocked` | Decode/network/unsupported, viewer load or timeout, fallback and autoplay outcomes |
| `vr_request`, `vr_enter`, `vr_exit`, `vr_error` | Headset request, successful entry, duration and failure; preview separated |
| `media_open`, `map_layer`, `map_stop`, `map_timeline`, `map_filter_reset`, `map_date_filter`, `navigation`, `chapter_jump`, `format_change`, `outbound_link` | Gallery and navigation usage (no user input text) |
| `web_vital` | `metric` as NAME:rating, plus numeric `value`; LCP/INP/FCP/TTFB in ms, CLS unitless |
| `site_error` | Bounded app/data error categories |

Content example `E02:v08:16x9`; on-screen 360 is `:360`, actual headset playback is `:vr`. Modes distinguish `episode`, `film-queue`, `single-file`, `gallery`, `fallback` and `headset`. Full films and collections use `film:<collection/version>:<format>`. Do not compare all opens with unique visitors as if they were the same thing.

Watching time excludes pauses, seeking, rebuffering and hidden browser tabs; active headset sessions remain eligible when their 2D page is hidden. Rewatching counts as time spent but does not inflate unique progress coverage. A minute-of-watching heartbeat and pause/pagehide/unmount flushes protect most partial sessions. Abrupt crashes can lose a partial minute. Preloaded VR videos are never attached until selected. At most 1,500 events per page lifetime; a blocked SDK queue is capped. Native SDK pageviews are sent once per public document load (and BFCache restore), not for map ticks, hashes, modal opens, or iframe activity.

Use the dashboard's custom-event filters for completion and format comparisons. The [Vercel Analytics API](https://vercel.com/docs/analytics/api) supports aggregate event queries; numeric properties are grouped values, so a report should sum watch seconds times each group's event count rather than count heartbeat events as seconds. Metrics appear under Custom Events rather than the separate Speed Insights dashboard. Standard Pro currently bills analytics at $0.03/1,000 events; check https://vercel.com/docs/analytics/limits-and-pricing for current pricing.

Verification: `node scripts/check-analytics.mjs`, `npm run build`, existing episode/release checks, and browser smoke tests. Before deployment, mock Vercel requests when exercising many UI paths. After deployment confirm SDK HTTP 200 and event ingestion HTTP 200/204; verify actual aggregate data through the authenticated Vercel API. Never commit credentials or add tokens to the browser bundle.
