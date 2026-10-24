/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A bound record's attachment value as read-only links, one per file — what a
 * `record-field` and a `description-list` entry both draw for the attachment
 * family, so the two cannot read the same value differently.
 *
 * The value arrives as the record holds it: a bare storage key, an object
 * (`{ key, name }` or a hosted form's `{ url, name }`), a list of either, or —
 * on SQLite, which has no array type — the JSON TEXT of that list. The text is
 * parsed here, at the boundary, so a list of keys is never read as one key.
 */

import { parseJsonArrayCell, parseJsonObjectCell } from '@/domain/kernel/sql/sqlite-json-cell'
import { toSafeAssetUrl } from '@/domain/kernel/url/asset-url-safety'
import type { ReactElement } from 'react'

/** The field types drawn as file links. */
export const ATTACHMENT_FIELD_TYPES: ReadonlySet<string> = new Set([
  'attachment',
  'single-attachment',
  'multiple-attachments',
])

/** The built-in `system` bucket, used when the bound column declares no `bucket`. */
const SYSTEM_BUCKET = 'system'

/**
 * The download bucket of an attachment column: the bucket DECLARED on the
 * column, else the built-in `system` — never the app's first declared bucket,
 * which is the form-upload path's fallback.
 */
function attachmentBucketOf(field: { readonly bucket?: unknown } | undefined): string {
  const bucket = field?.bucket
  return typeof bucket === 'string' && bucket.length > 0 ? bucket : SYSTEM_BUCKET
}

/** One stored file: a key, or an object naming it. */
interface AttachmentValue {
  readonly key?: string
  readonly filename?: string
  readonly name?: string
  readonly url?: string
}

/**
 * The read-only download address of one stored file, or none without a key or
 * url. A stored `url` is record data, so it is drawn only as a web address
 * ({@link toSafeAssetUrl}): a `data:` or `javascript:` one falls back to the key.
 */
function attachmentHref(value: AttachmentValue, bucket: string): string | undefined {
  const url = toSafeAssetUrl(value.url)
  if (url !== undefined) return url
  if (typeof value.key === 'string' && value.key.length > 0) {
    return `/api/buckets/${bucket}/files/${value.key}`
  }
  return undefined
}

/** One entry of a stored list as a file, or none for an empty or foreign entry. */
const fileOf = (entry: unknown): readonly AttachmentValue[] => {
  if (typeof entry === 'string') return entry.length > 0 ? [{ key: entry }] : []
  return typeof entry === 'object' && entry !== null ? [entry as AttachmentValue] : []
}

/** The files an attachment value names, in stored order; empty for an empty value. */
function toAttachmentList(value: unknown): readonly AttachmentValue[] {
  const decoded = parseJsonArrayCell(value) ?? parseJsonObjectCell(value) ?? value
  return Array.isArray(decoded) ? decoded.flatMap(fileOf) : fileOf(decoded)
}

/** One file as a link to its address, or its name alone when it has none. */
function fileLink(item: AttachmentValue, bucket: string, index: number): ReactElement {
  const href = attachmentHref(item, bucket)
  const label = item.filename ?? item.name ?? item.key ?? 'file'
  return href ? (
    <a
      key={index}
      href={href}
      className="text-primary underline"
    >
      {label}
    </a>
  ) : (
    <span key={index}>{label}</span>
  )
}

/**
 * One link per file the value names, each named after its file, stacked when
 * there are several. `undefined` for an empty value — the caller draws its own
 * empty state.
 */
export function renderAttachmentLinks(
  value: unknown,
  field: { readonly bucket?: unknown } | undefined
): ReactElement | undefined {
  const bucket = attachmentBucketOf(field)
  const links = toAttachmentList(value).map((item, index) => fileLink(item, bucket, index))
  if (links.length === 0) return undefined
  if (links.length === 1) return links[0]
  return <span className="flex flex-col gap-1">{links}</span>
}
