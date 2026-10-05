/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * An attachment value decoded into the files it names — the read half of
 * `attachment-links.tsx`, shared by the grid's cells and the record drawer.
 */

import { toSafeAssetUrl } from '@/domain/kernel/url/asset-url-safety'

/**
 * One attached file as the read path enriches it: a bare storage key promoted
 * to an object carrying the URL the records API already signed.
 */
export interface AttachmentEntry {
  readonly name: string
  readonly href?: string
}

/**
 * The prefix a stored key carries to stay unique — `<uuid>-` before the name
 * the file was uploaded under. Never shown.
 */
const UNIQUE_KEY_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(?=.)/i

/** The last path segment of a stored name. */
const lastSegment = (path: string): string => {
  const segments = path.split('/').filter(Boolean)
  return segments[segments.length - 1] ?? path
}

/**
 * The name the uploader chose, read off a storage KEY: its last segment
 * without the unique prefix. A name the value declares (`filename`, `name`) is
 * already that name and keeps whatever it starts with.
 */
const baseName = (key: string): string => lastSegment(key).replace(UNIQUE_KEY_PREFIX, '')

export const toAttachmentEntry = (value: unknown): AttachmentEntry | undefined => {
  if (typeof value === 'string') return value.length > 0 ? { name: baseName(value) } : undefined
  if (typeof value !== 'object' || value === null) return undefined

  const entry = value as Readonly<Record<string, unknown>>
  const pick = (...keys: readonly string[]): string | undefined =>
    keys
      .map((key) => entry[key])
      .find((candidate): candidate is string => typeof candidate === 'string' && candidate !== '')

  const declared = pick('filename', 'name')
  const key = pick('key')
  if (declared === undefined && key === undefined) return undefined
  // The href is a URL-valued sink fed by stored data, so it goes through the
  // canonical safe-address check: a value that is not a same-origin path or an
  // http(s) URL leaves the entry as its name, with nothing to follow.
  const href = toSafeAssetUrl(pick('signedUrl', 'url', 'key'))
  const name = declared === undefined ? baseName(key ?? '') : lastSegment(declared)
  return { name, ...(href !== undefined ? { href } : {}) }
}

/** Recover the array a SQLite JSON-TEXT column reads back as. */
export const toAttachmentArray = (value: unknown): readonly unknown[] | undefined => {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string' || !value.trim().startsWith('[')) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}
