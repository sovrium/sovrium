/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const DEFAULT_MIME_TYPE = 'application/octet-stream'

const EXTENSION_MIME_MAP: Readonly<Record<string, string>> = {
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  pdf: 'application/pdf',
  md: 'text/markdown',
  html: 'text/html',
  htm: 'text/html',
  xml: 'application/xml',
  js: 'text/javascript',
  mjs: 'text/javascript',
  css: 'text/css',
  map: 'application/json',
  wasm: 'application/wasm',
  webmanifest: 'application/manifest+json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
}

export const inferMimeFromKey = (key: string): string => {
  const ext = key.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  if (!ext) return DEFAULT_MIME_TYPE
  return EXTENSION_MIME_MAP[ext] ?? DEFAULT_MIME_TYPE
}

export const isImageKey = (key: string): boolean => inferMimeFromKey(key).startsWith('image/')

const ACTIVE_IMAGE_MIME_TYPES: ReadonlySet<string> = new Set(['image/svg+xml'])

export const isInlineSafeImageKey = (key: string): boolean => {
  const mime = inferMimeFromKey(key)
  return mime.startsWith('image/') && !ACTIVE_IMAGE_MIME_TYPES.has(mime)
}
