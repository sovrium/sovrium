/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure MIME-type inference from a filename / storage key.
 *
 * Storage keys produced by the bucket upload handler have the shape
 * `<uuid>-<original-filename>`, so the original extension is preserved as the
 * key suffix. These helpers are pure (no I/O) and live in the domain layer so
 * the bucket download route, the static public-directory asset route
 * (`setupPublicDirRoute`) and the field-validation rules all share one source
 * of truth instead of each maintaining its own extension → MIME map.
 *
 * The map covers the web static-asset extensions the public-directory route can
 * serve (scripts, styles, source maps, fonts, images, manifests) so those files
 * never leave the server as `application/octet-stream` — which, combined with
 * the `X-Content-Type-Options: nosniff` response header, would make a browser
 * hard-refuse a `<script>`/`<link>` with a "not a valid JavaScript/CSS MIME
 * type" error. Genuinely-unknown extensions still fall back to octet-stream.
 */

/** Fallback MIME type for keys with an unknown or missing extension. */
const DEFAULT_MIME_TYPE = 'application/octet-stream'

/** Filename-extension → canonical MIME type map. */
const EXTENSION_MIME_MAP: Readonly<Record<string, string>> = {
  // Documents & data
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  pdf: 'application/pdf',
  md: 'text/markdown',
  html: 'text/html',
  htm: 'text/html',
  xml: 'application/xml',
  // Web assets (scripts / styles / source maps / manifests)
  js: 'text/javascript',
  mjs: 'text/javascript',
  css: 'text/css',
  map: 'application/json',
  wasm: 'application/wasm',
  webmanifest: 'application/manifest+json',
  // Images
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  // Fonts
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
}

/**
 * Best-effort MIME-type inference from a filename / storage key extension.
 *
 * Falls back to `application/octet-stream` when the extension is missing or
 * unrecognised.
 */
export const inferMimeFromKey = (key: string): string => {
  const ext = key.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  if (!ext) return DEFAULT_MIME_TYPE
  return EXTENSION_MIME_MAP[ext] ?? DEFAULT_MIME_TYPE
}

/**
 * True when the storage key names an image file (by filename extension).
 *
 * Used to reject on-the-fly transform requests against non-image files
 * (PDFs, text, etc.) before the storage lookup runs.
 */
export const isImageKey = (key: string): boolean => inferMimeFromKey(key).startsWith('image/')

/**
 * MIME types that are images but carry ACTIVE content a browser will execute
 * when rendered inline (embedded `<script>`, event handlers, external refs).
 * `image/svg+xml` is the canonical case — an SVG served `inline` is a stored-XSS
 * vector. Such types must be served as `attachment` (forced download) with a
 * blocking CSP, never `inline`.
 */
const ACTIVE_IMAGE_MIME_TYPES: ReadonlySet<string> = new Set(['image/svg+xml'])

/**
 * True when the key names a RASTER image safe to render `inline` — an image
 * type that carries NO active content (png/jpeg/gif/webp). SVG and any other
 * active image type return `false` so the caller forces `attachment` + CSP
 * (Finding #2 — signed-download SVG XSS neutralization).
 */
export const isInlineSafeImageKey = (key: string): boolean => {
  const mime = inferMimeFromKey(key)
  return mime.startsWith('image/') && !ACTIVE_IMAGE_MIME_TYPES.has(mime)
}
