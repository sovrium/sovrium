/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared storage-key convention for file uploads.
 *
 * Both the public upload route (`POST /api/buckets/:name/files` → `persistUpload`)
 * and the admin console upload route (`POST /api/admin/buckets/:name/files`)
 * derive the storage key from the original filename with a random per-upload
 * UUID prefix: `<uuid>-<filename>`. The random prefix avoids filename collisions
 * across uploads while keeping the human-readable filename as a suffix for
 * debugging convenience; the download / signed-URL paths strip the prefix again
 * via `stripUuidPrefix` so the original filename surfaces in
 * `Content-Disposition`.
 *
 * Keeping this single helper as the source of truth means the admin echo
 * (`bucketFileItemSchema.key`) and any later download URL agree on exactly the
 * same key shape the public route already produces.
 */
export function buildUploadStorageKey(filename: string): string {
  return `${crypto.randomUUID()}-${filename}`
}
