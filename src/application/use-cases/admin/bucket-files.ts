/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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



function createdAtIso(raw: Readonly<Date> | string): string {
  return raw instanceof Date ? raw.toISOString() : new Date(raw).toISOString()
}

function buildFileItem(
  row: AdminBucketFileRow
): BucketFileItem {
  return {
    key: row.key,
    filename: stripStorageKeyUuidPrefix(row.filename),
    size: Number(row.size),
    mimeType: row.mimeType,
    createdAt: createdAtIso(row.createdAt),
  }
}


export function encodeFilesCursor(value: string, id: string): string {
  return Buffer.from(JSON.stringify({ value, id }), 'utf8').toString('base64')
}

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

function resolveTypeFilter(type: string | undefined): {
  readonly typePrefix?: string
  readonly typeExact?: string
} {
  if (type === undefined || type.length === 0) return {}
  if (type.endsWith('/')) return { typePrefix: type }
  return { typeExact: type }
}

function cursorValueForItem(item: Readonly<BucketFileItem>, sort: BucketFilesSort): string {
  return sort === 'size' ? String(item.size) : item.createdAt
}


export interface BucketFilesInput {
  readonly sort: BucketFilesSort
  readonly order: BucketFilesOrder
  readonly type?: string | undefined
  readonly cursor?: string | undefined
  readonly limit: number
}

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


export const AdminBucketFilesLayer = Layer.mergeAll(AdminBucketFilesRepositoryLive)
