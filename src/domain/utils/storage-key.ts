/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure helpers for the shared storage-key convention.
 *
 * Sovrium uploads store files under a `<uuid>-<filename>` key (the random
 * per-upload prefix avoids filename collisions while keeping the human-readable
 * filename as a suffix). The presentation layer's `buildUploadStorageKey`
 * produces that key; the download / signed-URL paths strip the prefix again so
 * the original filename surfaces in `Content-Disposition`.
 *
 * This module is the DOMAIN-LAYER home of the prefix-strip so the application
 * layer (e.g. the bucket file-browser list projection) can derive the original
 * filename from a persisted `file_storage_metadata.filename` (which the storage
 * adapters set to the key's basename, i.e. the uuid-prefixed value) WITHOUT
 * reaching into the presentation layer. It mirrors the regex used by the
 * presentation-side `stripUuidPrefix` reader so every consumer agrees on exactly
 * one prefix shape.
 */

/**
 * Strip the `<uuid>-` prefix a Sovrium upload key carries, returning the
 * original filename. A key with no matching prefix (e.g. a verbatim
 * public-route `explicitPath`) is returned unchanged.
 */
export function stripStorageKeyUuidPrefix(key: string): string {
  const match = key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i)
  return match?.[1] ?? key
}
