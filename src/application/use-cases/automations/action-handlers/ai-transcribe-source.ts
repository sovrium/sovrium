/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Reading the `source` of an `ai/transcribe` step — and the value of a
 * connection operation's `file` parameter, which names a file the same way.
 *
 * `source` is either a storage key or the value of an attachment field, and an
 * attachment value reaches a step in several shapes: a bare key, the
 * `{ key, url | signedUrl }` object the read path enriches it into, a
 * `storeMetadata` object (`{ filename, mimeType, size, url }`, no key), or an
 * array of those for `multiple-attachments` — of which the first is taken.
 * The bucket comes from the step's `bucket` prop, else from the download URL
 * the attachment carries, else the built-in `system` bucket.
 */

import { parseBucketFileUrl } from '@/domain/kernel/url/bucket-file-url'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'

/** A resolved recording: where it is stored and what it is called. */
export interface TranscribeSource {
  readonly key: string
  readonly bucket: string
  readonly fileName: string
  /** The MIME type the attachment itself declares, when it carries one. */
  readonly mimeType?: string
}

interface Located {
  readonly key: string
  readonly bucket?: string
}

/**
 * Pull `{ bucket, key }` out of a bucket download URL, when the string is one.
 * The shared parser, so this reader resolves exactly the shapes the
 * attachment-reference confinement inspects on write — a URL form only this
 * step understood would be a way around it.
 */
const fromUrl = (url: string): Located | undefined => parseBucketFileUrl(url)

const stringField = (
  record: Readonly<Record<string, unknown>>,
  key: string
): string | undefined => {
  const value = record[key]
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

const fromObject = (record: Readonly<Record<string, unknown>>): Located | undefined => {
  const byUrl = [stringField(record, 'url'), stringField(record, 'signedUrl')]
    .map((url) => (url !== undefined ? fromUrl(url) : undefined))
    .find((located) => located !== undefined)
  const key = stringField(record, 'key')
  if (key !== undefined)
    return { key, ...(byUrl?.bucket !== undefined ? { bucket: byUrl.bucket } : {}) }
  return byUrl
}

const locate = (value: unknown): Located | undefined => {
  if (Array.isArray(value)) return locate(value[0])
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return undefined
    return fromUrl(trimmed) ?? { key: trimmed }
  }
  if (typeof value === 'object' && value !== null) {
    return fromObject(value as Record<string, unknown>)
  }
  return undefined
}

/** A field the attachment itself declares (`mimeType`, `filename`), when it carries one. */
const declaredField = (value: unknown, field: string): string | undefined => {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'object' && first !== null
    ? stringField(first as Record<string, unknown>, field)
    : undefined
}

/** Strip the `<uuid>-` prefix upload keys carry, leaving the original filename. */
const fileNameOf = (key: string): string => {
  const base = key.slice(key.lastIndexOf('/') + 1)
  return base.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, '')
}

/**
 * Resolve a `source` value (and the optional `bucket` prop) to a stored
 * recording, or `undefined` when it names nothing.
 */
export const resolveTranscribeSource = (
  value: unknown,
  bucketProp: string | undefined
): TranscribeSource | undefined => {
  const located = locate(value)
  if (located === undefined || located.key === '[object Object]') return undefined
  const mimeType = declaredField(value, 'mimeType')
  return {
    key: located.key,
    bucket: bucketProp ?? located.bucket ?? SYSTEM_BUCKET_NAME,
    fileName: declaredField(value, 'filename') ?? fileNameOf(located.key),
    ...(mimeType !== undefined ? { mimeType } : {}),
  }
}

/**
 * Containers a browser records audio into but that one extension maps to a
 * VIDEO type — an audio-only `.webm` is announced as `video/webm`. They are
 * sent to the speech engine under their audio name.
 */
const AUDIO_CAPABLE_CONTAINERS: Readonly<Record<string, string>> = {
  'video/webm': 'audio/webm',
  'video/mp4': 'audio/mp4',
  'video/ogg': 'audio/ogg',
}

/**
 * The MIME type to send a recording under, or `undefined` when it is not
 * audio at all — which the handler refuses before anything is sent.
 */
export const audioMimeForTranscription = (mimeType: string): string | undefined => {
  const base = mimeType.split(';')[0]!.trim().toLowerCase()
  if (base.startsWith('audio/')) return base
  return AUDIO_CAPABLE_CONTAINERS[base]
}
