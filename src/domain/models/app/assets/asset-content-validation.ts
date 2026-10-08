/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { AssetKind } from './asset'

/**
 * WHETHER A FILE'S CONTENT IS WHAT ITS ASSET ENTRY SAYS IT IS.
 *
 * Read from the bytes (magic numbers for binary kinds, decodable text for the
 * textual ones), never from the extension, so a renamed file is refused when
 * the config is checked rather than when an automation trips on it.
 */

/** The heaviest an asset may be: 10 MB, counted as 10 × 1024 × 1024 bytes (inclusive). */
export const ASSET_MAX_BYTES = 10 * 1024 * 1024

/** The limit as the refusal names it. */
const ASSET_MAX_LABEL = '10 MB'

const startsWith = (bytes: Uint8Array, signature: ReadonlyArray<number>, at = 0): boolean =>
  bytes.length >= at + signature.length && signature.every((byte, i) => bytes[at + i] === byte)

const ascii = (text: string): ReadonlyArray<number> => [...text].map((c) => c.charCodeAt(0))

/** The four-byte ZIP local-file header every OOXML package starts with. */
const ZIP = [0x50, 0x4b, 0x03, 0x04]

const isImage = (bytes: Uint8Array): boolean =>
  startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ||
  startsWith(bytes, [0xff, 0xd8, 0xff]) ||
  startsWith(bytes, ascii('GIF8')) ||
  (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8))

const isFont = (bytes: Uint8Array): boolean =>
  startsWith(bytes, ascii('wOF2')) ||
  startsWith(bytes, ascii('wOFF')) ||
  startsWith(bytes, ascii('OTTO')) ||
  startsWith(bytes, ascii('true')) ||
  startsWith(bytes, [0x00, 0x01, 0x00, 0x00])

/** The text of `bytes`, or `undefined` when they are not UTF-8 text (or hold a NUL). */
const textOf = (bytes: Uint8Array): string | undefined => {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return text.includes('\u0000') ? undefined : text
  } catch {
    return undefined
  }
}

const BINARY_CHECKS: Readonly<Partial<Record<AssetKind, (bytes: Uint8Array) => boolean>>> = {
  docx: (bytes) => startsWith(bytes, ZIP),
  xlsx: (bytes) => startsWith(bytes, ZIP),
  pptx: (bytes) => startsWith(bytes, ZIP),
  pdf: (bytes) => startsWith(bytes, ascii('%PDF-')),
  image: isImage,
  font: isFont,
}

/** Whether `bytes` hold a file of `kind`. */
export const matchesAssetKind = (kind: AssetKind, bytes: Uint8Array): boolean => {
  const binary = BINARY_CHECKS[kind]
  if (binary !== undefined) return binary(bytes)
  const text = textOf(bytes)
  if (text === undefined) return false
  return kind === 'svg' ? /<svg[\s>]/i.test(text) : true
}

/** Why a declared asset is too heavy, or `undefined` (the limit is inclusive). */
export const assetSizeIssue = (path: string, size: number): string | undefined =>
  size > ASSET_MAX_BYTES
    ? `asset "${path}" weighs ${size} bytes, over the ${ASSET_MAX_LABEL} limit for an asset; store a file this large in a bucket`
    : undefined

/** Why a declared asset's content is not of its kind, or `undefined`. */
export const assetContentIssue = (
  path: string,
  kind: AssetKind,
  bytes: Uint8Array
): string | undefined =>
  matchesAssetKind(kind, bytes)
    ? undefined
    : `asset "${path}" is declared as kind "${kind}" but its content is not a ${kind} file`

/** The MIME type an action hands on for an asset of `kind` at `path`. */
export const assetContentType = (kind: AssetKind, path: string): string => {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  const byExtension: Readonly<Record<string, string>> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    woff2: 'font/woff2',
    woff: 'font/woff',
    ttf: 'font/ttf',
    otf: 'font/otf',
    json: 'application/json',
    yaml: 'application/yaml',
    yml: 'application/yaml',
    md: 'text/markdown',
  }
  const byKind: Readonly<Record<AssetKind, string>> = {
    html: 'text/html',
    svg: 'image/svg+xml',
    css: 'text/css',
    partial: 'text/plain',
    text: 'text/plain',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    pdf: 'application/pdf',
    image: 'application/octet-stream',
    font: 'application/octet-stream',
    data: 'application/octet-stream',
  }
  return byExtension[extension] ?? byKind[kind]
}
