/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one two-phase bucket upload the browser performs.
 *
 * `POST /api/buckets/:bucket/files` (multipart) → keep the returned key. The
 * CRUD form's file field does the same thing, and the endpoint is where MIME
 * validation, the size ceiling, the storage quota and the [internal ref] `default`
 * bucket fallback all live — a second uploader would fork all four.
 */

export interface BucketUpload {
  readonly key: string
  readonly filename: string
  readonly size: number
  readonly mimeType: string
}

interface BucketUploadResponse {
  readonly success?: boolean
  readonly key?: string
  readonly filename?: string
  readonly size?: number
  readonly mimeType?: string
  readonly error?: string
}

export async function uploadToBucket(file: File, bucket: string): Promise<BucketUpload> {
  const body = new FormData()
  body.append('file', file)

  const res = await fetch(`/api/buckets/${encodeURIComponent(bucket)}/files`, {
    method: 'POST',
    body,
    credentials: 'include',
  })
  const json = (await res.json().catch(() => ({}))) as BucketUploadResponse

  if (!res.ok || json.success !== true || !json.key) {
    // eslint-disable-next-line functional/no-throw-statements -- Rejection is how the caller distinguishes a failed upload from an empty one.
    throw new Error(json.error ?? `Upload failed with status ${res.status}`)
  }

  return {
    key: json.key,
    filename: json.filename ?? file.name,
    size: json.size ?? file.size,
    mimeType: json.mimeType ?? file.type,
  }
}
