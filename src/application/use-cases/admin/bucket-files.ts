/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use case for the bucket file-browser endpoint
 * (`GET /api/admin/buckets/:bucketName/files`).
 *
 * The application layer owns ALL pure logic:
 *   - resolving the `type` query knob into a mimeType prefix-vs-exact filter
 *     (trailing-slash → prefix, full type → exact),
 *   - the opaque cursor encode/decode pair (base64 of `{ value, id }`, where
 *     `value` is the sort-key value of the last row — `createdAt` ISO for
 *     `date`, the byte size as a string for `size`),
 *   - file-item building (dialect-native `createdAt` → ISO coercion),
 *   - deriving `hasMore` / `nextCursor` from the `limit + 1` fetch,
 *   - assembling + response-schema-validating the body (incl. `totalBytes`).
 *
 * Only the raw `file_storage_metadata` reads (cursor list + total-bytes sum)
 * live in the infrastructure repository, accessed via
 * {@link AdminBucketFilesRepository}. The audit emit (`bucket.files.queried`)
 * stays in the route after a successful read.
 */

import { Effect, Layer } from 'effect'
import {
  AdminBucketFilesRepository,
  type AdminBucketFileRow,
  type AdminBucketFilesDatabaseError,
} from '@/application/ports/repositories/buckets/admin-bucket-files-repository'
import {
  bucketFilesResponseSchema,
  type BucketFileItem,
  type BucketFilesOrder,
  type BucketFilesSort,
} from '@/domain/models/api/admin/buckets/files'
import { stripStorageKeyUuidPrefix } from '@/domain/utils/storage-key'
import { AdminBucketFilesRepositoryLive } from '@/infrastructure/database/repositories/buckets/admin-bucket-files-repository-live'

/* eslint-disable unicorn/no-null -- API envelope canonically uses `null` for an absent `nextCursor` across all cursor-paginated admin endpoints (matches the shared cursor-pagination response contract) */

// ─── Pure file-item helper ──────────────────────────────────────────────────

/** Coerce a dialect-native `createdAt` to an ISO 8601 string. */
function createdAtIso(raw: Readonly<Date> | string): string {
  return raw instanceof Date ? raw.toISOString() : new Date(raw).toISOString()
}

/**
 * Build the canonical file-browser item from a metadata row. Pure — the row is
 * supplied by the caller (sourced via the repository).
 */
function buildFileItem(
  row: AdminBucketFileRow
  // eslint-disable-next-line functional/prefer-immutable-types -- BucketFileItem is the Zod-inferred response shape (upstream-mutable); the route serializes it straight to JSON without mutating
): BucketFileItem {
  return {
    key: row.key,
    // The storage adapters set `file_storage_metadata.filename` to the key's
    // basename (the uuid-prefixed value). Strip the `<uuid>-` prefix so the
    // browser shows the original human filename — matching what the upload echo
    // returns from `file.name` (no drift between the upload row and the list row)
    // and what the download path surfaces via `stripUuidPrefix`.
    filename: stripStorageKeyUuidPrefix(row.filename),
    size: Number(row.size),
    mimeType: row.mimeType,
    createdAt: createdAtIso(row.createdAt),
  }
}

// ─── File-browser cursor (opaque base64 of `{ value, id }`) ─────────────────

/**
 * Encode a file-browser cursor — opaque base64 of `{ value, id }`. `value` is
 * the sort-key value of the last row on the page (the `createdAt` ISO for the
 * `date` sort, the byte size as a string for the `size` sort); `id` is the row
 * id tie-breaker.
 */
export function encodeFilesCursor(value: string, id: string): string {
  return Buffer.from(JSON.stringify({ value, id }), 'utf8').toString('base64')
}

/**
 * Decode a file-browser cursor. Returns `null` (the use case maps that to
 * "ignore the cursor", restarting from the head) when the payload is malformed.
 */
export function decodeFilesCursor(
  cursor: string
): { readonly value: string; readonly id: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
      readonly value?: unknown
      readonly id?: unknown
    }
    if (typeof decoded.value !== 'string' || typeof decoded.id !== 'string') return null
    return { value: decoded.value, id: decoded.id }
  } catch {
    return null
  }
}

/**
 * Resolve the `type` query knob into a mimeType filter. A trailing-slash value
 * (`image/`) matches by prefix; a full type (`image/png`) matches exactly. An
 * empty / omitted value means "all types".
 */
function resolveTypeFilter(type: string | undefined): {
  readonly typePrefix?: string
  readonly typeExact?: string
} {
  if (type === undefined || type.length === 0) return {}
  if (type.endsWith('/')) return { typePrefix: type }
  return { typeExact: type }
}

/**
 * Compute the `value` half of the next cursor for a given row, matching the
 * active sort key (the `createdAt` ISO for `date`, the byte size as a string for
 * `size`). Kept in sync with the repository's cursor-seek column.
 */
function cursorValueForItem(item: Readonly<BucketFileItem>, sort: BucketFilesSort): string {
  return sort === 'size' ? String(item.size) : item.createdAt
}

// ─── Use case ────────────────────────────────────────────────────────────────

/**
 * Validated file-list inputs, parsed by the route from the canonical query
 * schema. The cursor stays opaque here — the use case decodes it (so the
 * encode/decode pair stays co-located with the rest of the pure logic).
 */
export interface BucketFilesInput {
  readonly sort: BucketFilesSort
  readonly order: BucketFilesOrder
  readonly type?: string | undefined
  readonly cursor?: string | undefined
  readonly limit: number
}

/**
 * Outcome of the file-list build. `Ok` carries the response-schema-validated
 * body; `ValidationFailed` signals the assembled body failed the response gate
 * (the route maps this to a 500 + logs the Zod error).
 */
export type BucketFilesBuildOutcome =
  | {
      readonly _tag: 'Ok'
      readonly body: {
        readonly items: readonly BucketFileItem[]
        readonly nextCursor: string | null
        readonly totalBytes: number
      }
    }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

/**
 * Build the cursor-paginated bucket file-browser body.
 *
 * Pagination semantics: fetch `limit + 1` rows ordered by the `(<sortKey>, id)`
 * tuple in the requested direction; the page is the first `limit` rows;
 * `nextCursor` is non-null only when a `limit + 1`-th row existed. `totalBytes`
 * is the bucket-wide `SUM(size)` — invariant across the `type` filter and across
 * pages (so the file browser's quota bar renders without a second round-trip).
 */
export const BuildBucketFiles = (
  input: BucketFilesInput
): Effect.Effect<
  BucketFilesBuildOutcome,
  AdminBucketFilesDatabaseError,
  AdminBucketFilesRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AdminBucketFilesRepository

    const decoded = input.cursor ? decodeFilesCursor(input.cursor) : null
    const typeFilter = resolveTypeFilter(input.type)

    const [rows, totalBytes] = yield* Effect.all([
      repo.listFiles({
        sort: input.sort,
        order: input.order,
        ...(typeFilter.typePrefix !== undefined ? { typePrefix: typeFilter.typePrefix } : {}),
        ...(typeFilter.typeExact !== undefined ? { typeExact: typeFilter.typeExact } : {}),
        ...(decoded !== null ? { cursor: decoded } : {}),
        limit: input.limit,
      }),
      repo.sumTotalBytes(),
    ])

    const pageRows = rows.slice(0, input.limit)
    const items = pageRows.map((row) => buildFileItem(row))
    const lastRow = pageRows[pageRows.length - 1]
    const lastItem = items[items.length - 1]
    const nextCursor =
      rows.length > input.limit && lastRow !== undefined && lastItem !== undefined
        ? encodeFilesCursor(cursorValueForItem(lastItem, input.sort), lastRow.id)
        : null

    const body = { items, nextCursor, totalBytes }
    const parsed = bucketFilesResponseSchema.safeParse(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return {
      _tag: 'Ok',
      body: {
        items: parsed.data.items,
        nextCursor: parsed.data.nextCursor,
        totalBytes: parsed.data.totalBytes,
      },
    }
  })

/* eslint-enable unicorn/no-null */

/**
 * Application layer for the admin bucket-files use case.
 */
export const AdminBucketFilesLayer = Layer.mergeAll(AdminBucketFilesRepositoryLive)
