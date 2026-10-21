/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared storage-key convention for file uploads.
 *
 * The public upload route (`POST /api/buckets/:name/files` → `persistUpload`)
 * and the admin console upload route (`POST /api/admin/buckets/:name/files`)
 * derive the storage key from the original filename with a random per-upload
 * UUID prefix: `<uuid>-<filename>`. The `sovrium seed` resolver (`@asset:file`
 * references) keeps the same shape with a derived prefix instead
 * (`buildSeededStorageKey`, below). The random prefix avoids filename collisions
 * across uploads while keeping the human-readable filename as a suffix for
 * debugging convenience; the download / signed-URL paths strip the prefix again
 * via `stripUuidPrefix` so the original filename surfaces in
 * `Content-Disposition`.
 *
 * Keeping this single helper as the source of truth means the admin echo
 * (`bucketFileItemSchema.key`) and any later download URL agree on exactly the
 * same key shape the public route already produces.
 *
 * ## Why here and not `@/domain/utils/storage-key`
 *
 * That module owns the INVERSE (`stripStorageKeyUuidPrefix`), so co-locating
 * the two halves of one convention is the obvious instinct — and it is wrong.
 * The strip is a deterministic string transform; this is an entropy source
 * (`crypto.randomUUID()`), and the domain layer is pure by construction. The
 * split is therefore principled, not accidental: keep the generator here.
 */
export function buildUploadStorageKey(filename: string): string {
  return `${crypto.randomUUID()}-${filename}`
}

/** What identifies one seeded attachment slot, for {@link buildSeededStorageKey}. */
export interface SeededAssetSlot {
  /** The seeded table. */
  readonly table: string
  /** The seed row's `key:`. */
  readonly key: string
  /** The attachment field. */
  readonly field: string
  /** The file's position in the field, 0 for a single attachment. */
  readonly position: number
  /** The file's own name — the suffix every reader recovers by stripping the prefix. */
  readonly filename: string
  /** The file's bytes. */
  readonly bytes: Uint8Array
}

const sha256Hex = (input: string | Uint8Array): string =>
  new Bun.CryptoHasher('sha256').update(input).digest('hex')

/**
 * The storage key of a file `sovrium seed` uploads: `<prefix>-<filename>`, the
 * same shape as {@link buildUploadStorageKey}, but the prefix is DERIVED rather
 * than drawn — from the row (table and key), the field, the position in it and
 * the SHA-256 of the bytes.
 *
 * A random prefix gave every replay a new key, so an unchanged seed rewrote
 * every attachment column and reported rows as updated. Derived, the same row
 * with the same file gets the same key and stays unchanged; a changed file gets
 * a new key. The row and slot are in the hash, not only the bytes, so two slots
 * holding the same file are still two objects: deleting one record's file never
 * deletes another's.
 *
 * The prefix is shaped as a version-8 UUID (RFC 9562's custom layout), so
 * `stripStorageKeyUuidPrefix` and every reader that recovers the filename keep
 * working unchanged.
 */
export const buildSeededStorageKey = (slot: SeededAssetSlot): string => {
  const hex = sha256Hex(
    [
      'sovrium.seed',
      slot.table,
      slot.key,
      slot.field,
      String(slot.position),
      sha256Hex(slot.bytes),
    ].join('\0')
  )
  const variant = ((Number.parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16)
  const prefix = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `8${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-')
  return `${prefix}-${slot.filename}`
}
