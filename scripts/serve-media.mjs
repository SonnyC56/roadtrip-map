#!/usr/bin/env node
// Tiny static file server for local dev: serves the media bucket folder with CORS + HTTP Range.
// Usage: node scripts/serve-media.mjs [dir] [port]
//   dir  defaults to $MEDIA_DIR or /mnt/d/RoadTrip-Site-Assets
//   port defaults to $MEDIA_PORT or 8787
// Then set VITE_MEDIA_BASE=http://localhost:8787 in .env.local
import http from "node:http"
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(process.argv[2] || process.env.MEDIA_DIR || "/mnt/d/RoadTrip-Site-Assets")
const port = Number(process.argv[3] || process.env.MEDIA_PORT || 8787)

const TYPES = {
  ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml", ".gif": "image/gif",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf",
  ".css": "text/css", ".txt": "text/plain", ".vtt": "text/vtt",
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Headers", "Range")
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges")
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end() }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end() }

  let rel
  try { rel = decodeURIComponent(new URL(req.url, "http://x").pathname) } catch { res.writeHead(400); return res.end() }
  const file = path.join(root, rel)
  if (!file.startsWith(root)) { res.writeHead(403); return res.end() }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end("not found") }
    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream"
    const headers = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" }
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range)
    if (range) {
      let start = range[1] === "" ? st.size - Number(range[2]) : Number(range[1])
      let end = range[1] !== "" && range[2] !== "" ? Number(range[2]) : st.size - 1
      if (start < 0) start = 0
      end = Math.min(end, st.size - 1)
      if (start > end || start >= st.size) {
        res.writeHead(416, { "Content-Range": `bytes */${st.size}` }); return res.end()
      }
      res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Content-Length": end - start + 1 })
      if (req.method === "HEAD") return res.end()
      return fs.createReadStream(file, { start, end }).pipe(res)
    }
    res.writeHead(200, { ...headers, "Content-Length": st.size })
    if (req.method === "HEAD") return res.end()
    fs.createReadStream(file).pipe(res)
  })
})

server.listen(port, () => console.log(`media: serving ${root} at http://localhost:${port} (CORS + Range)`))
