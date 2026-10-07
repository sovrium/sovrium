/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The bucket admin reads, as registry entries: the bucket list, the storage
 * overview and one bucket's files.
 *
 * Each entry is the whole of one read: the admin route, the MCP admin tool and
 * the OpenAPI operation are derived from it. Each writes its
 * `bucket.{list,overview,files}.queried` audit event on success.
 *
 * A bucket is a DECLARATION (`app.buckets[]` plus the built-in `system`), not a
 * storage backend: the list and the overview enumerate what the app declares,
 * each item counting only the objects recorded under it. A name the app does not
 * expose — an undeclared bucket and a malformed name alike — is not found, so
 * the shape of a name reveals nothing.
 *
 * Only reads are here. The console upload beside the file list is an action and
 * stays a hand-written route.
 */

import { Effect, Option, Schema } from 'effect'
import {
  adminReadPathParams,
  defineAdminRead,
  answerWithSchema,
} from '@/application/use-cases/admin/admin-read-operation'
import { BuildBucketFiles } from '@/application/use-cases/admin/bucket-files'
import {
  buildBucketUploadSeries,
  BuildBucketUploadSeries,
} from '@/application/use-cases/admin/buckets-overview'
import {
  buildBucketItems,
  buildOverviewTotals,
  decodeBucketsListQuery,
  decodeCursor,
  degradeTo,
  encodeCursor,
  type BucketsListInput,
} from '@/application/use-cases/admin/buckets-read-projection'
import { parseSortSpec } from '@/domain/kernel/format/sort-spec'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  bucketFilesQuerySchema,
  bucketFilesResponseSchema,
  normalizeBucketFilesSortKey,
} from '@/domain/models/api/admin/buckets/files'
import {
  bucketsListQuerySchema,
  bucketsListResponseSchema,
  bucketSchema,
} from '@/domain/models/api/admin/buckets/list'
import {
  bucketsOverviewQuerySchema,
  bucketsOverviewResponseSchema,
} from '@/domain/models/api/admin/buckets/overview'
import {
  resolvePeriodWindow,
  type PeriodPreset,
} from '@/domain/models/api/admin/envelope/period-preset'
import {
  bucketIdForName,
  declaredBucketNames,
  SYSTEM_BUCKET_ID,
} from '@/domain/models/app/buckets/bucket-identity'
import type { AdminReadOperation } from '@/application/use-cases/admin/admin-read-operation'
import type { BucketFilesInput } from '@/application/use-cases/admin/bucket-files'
import type { App } from '@/domain/models/app'

// ─── List ────────────────────────────────────────────────────────────────────

const bucketsList = defineAdminRead<BucketsListInput>({
  id: 'buckets.list',
  method: 'get',
  path: '/api/admin/buckets',
  pathParams: [],
  queryParams: ['cursor', 'limit', 'provider', 'include_deleted'],
  tool: {
    suffix: 'buckets_list',
    description:
      'List the buckets the app exposes, each with its file count and stored bytes, as GET /api/admin/buckets answers them (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['s3', 'local', 'bytea'],
          description: 'Only buckets on this storage provider.',
        },
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Buckets per page.' },
        cursor: { type: 'string', description: 'The nextCursor of the previous page.' },
      },
    },
  },
  openapi: {
    summary: 'List the buckets',
    description:
      'The built-in `system` bucket and every declared bucket, each counting only the ' +
      'objects recorded under it. Empty when no storage provider is configured. Admin only.',
    operationIdBase: 'listAdminBuckets',
    querySchema: bucketsListQuerySchema,
    responseSchema: bucketsListResponseSchema,
    responseDescription: 'One page of buckets',
    baseSchemas: [bucketSchema],
  },
  subject: 'bucket list',
  decode: (raw) => ({ _tag: 'Ok', input: decodeBucketsListQuery(raw) }),
  read: (app, { provider, cursor, limit }) =>
    Effect.gen(function* () {
      const all = yield* buildBucketItems(app)
      const filtered = provider ? all.filter((item) => item.provider === provider) : all
      const start = cursor ? decodeCursor(cursor, filtered) : 0
      const page = filtered.slice(start, start + limit)
      const last = page.at(-1)
      const nextCursor =
        start + page.length < filtered.length && last !== undefined ? encodeCursor(last.id) : null
      return answerWithSchema(bucketsListResponseSchema, { items: page, nextCursor })
    }),
  audit: { action: AUDIT_ACTIONS.BUCKET_LIST_QUERIED, resourceId: () => SYSTEM_BUCKET_ID },
})

// ─── Overview ────────────────────────────────────────────────────────────────

const bucketsOverview = defineAdminRead<PeriodPreset>({
  id: 'buckets.overview',
  method: 'get',
  path: '/api/admin/buckets/overview',
  pathParams: [],
  queryParams: ['period'],
  tool: {
    suffix: 'buckets_overview',
    description:
      'Storage totals and a bucketed upload series for a period, as GET /api/admin/buckets/overview answers them (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['24h', '7d', '30d'],
          description: 'The reporting period (default 24h).',
        },
      },
    },
  },
  openapi: {
    summary: 'Read the storage overview',
    description:
      'Totals (declared buckets, stored files and bytes, buckets per provider) and an upload ' +
      'series for the period, hourly for `24h` and daily for `7d` and `30d`. An unknown ' +
      'period reads as `24h`. Admin only.',
    operationIdBase: 'getAdminBucketsOverview',
    querySchema: bucketsOverviewQuerySchema,
    responseSchema: bucketsOverviewResponseSchema,
    responseDescription: 'The storage totals and series',
  },
  subject: 'bucket overview',
  // Lenient, as the route always was: an unknown period reads as the default.
  decode: ({ period }) => {
    return {
      _tag: 'Ok',
      input: period === '7d' || period === '30d' || period === '24h' ? period : '24h',
    }
  },
  read: (app, preset) =>
    Effect.gen(function* () {
      const window = resolvePeriodWindow(preset)
      const totals = yield* buildOverviewTotals(app)
      const points = yield* degradeTo(
        BuildBucketUploadSeries(window),
        'bucket overview series',
        buildBucketUploadSeries(window, [])
      )
      return answerWithSchema(bucketsOverviewResponseSchema, {
        totals,
        series: { interval: window.interval, points: [...points] },
      })
    }),
  audit: { action: AUDIT_ACTIONS.BUCKET_OVERVIEW_QUERIED, resourceId: () => SYSTEM_BUCKET_ID },
})

// ─── Files ───────────────────────────────────────────────────────────────────

type BucketFilesRequest = Omit<BucketFilesInput, 'app'>

/**
 * Decode one bucket's file-list request. A name the app does not expose is
 * not found BEFORE the query is read, so a malformed query on an unknown bucket
 * confirms nothing. `?sort=` takes both spellings — the pair `sort=size&order=
 * desc` and the combined `sort=size:desc` a column header emits — and the
 * legacy `date` alias is folded onto `createdAt`; a key outside the enum is
 * still refused.
 */
const decodeBucketFiles = (raw: Readonly<Record<string, unknown>>, app: App) => {
  const bucket = raw['bucketName']
  if (typeof bucket !== 'string' || !declaredBucketNames(app.buckets).includes(bucket)) {
    return { _tag: 'NotFound' } as const
  }
  const sortSpec = parseSortSpec(typeof raw['sort'] === 'string' ? raw['sort'] : undefined)
  return Option.match(
    Schema.decodeUnknownOption(bucketFilesQuerySchema)({
      cursor: raw['cursor'],
      limit: raw['limit'],
      sort: normalizeBucketFilesSortKey(sortSpec?.field),
      order: sortSpec?.direction ?? raw['order'],
      type: raw['type'],
      q: raw['q'],
    }),
    {
      onNone: () =>
        ({
          _tag: 'InvalidInput',
          reason: 'malformed',
          message: 'Invalid query parameters',
        }) as const,
      onSome: (query) =>
        ({
          _tag: 'Ok',
          input: {
            bucket,
            sort: query.sort,
            order: query.order,
            ...(query.type !== undefined ? { type: query.type } : {}),
            ...(query.q !== undefined ? { q: query.q } : {}),
            ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
            limit: query.limit,
          } satisfies BucketFilesRequest,
        }) as const,
    }
  )
}

const bucketFiles = defineAdminRead<BucketFilesRequest>({
  id: 'buckets.files.list',
  method: 'get',
  path: '/api/admin/buckets/:bucketName/files',
  pathParams: ['bucketName'],
  queryParams: ['cursor', 'limit', 'sort', 'order', 'type', 'q'],
  tool: {
    suffix: 'bucket_files_list',
    description:
      'List the files of one bucket — sortable, narrowed by type or by a word of the name — as GET /api/admin/buckets/:bucketName/files answers them (admin-only, read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        bucketName: { type: 'string', description: 'The bucket name, e.g. system.' },
        sort: {
          type: 'string',
          description: 'createdAt (default), size, filename or mimeType; or field:direction.',
        },
        order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction.' },
        type: {
          type: 'string',
          description: 'A MIME type, or a prefix ending in / (image/) to match a family.',
        },
        q: { type: 'string', description: 'Case-insensitive search over the file name and key.' },
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Files per page.' },
        cursor: { type: 'string', description: 'The nextCursor of the previous page.' },
      },
      required: ['bucketName'],
    },
  },
  openapi: {
    summary: "List one bucket's files",
    description:
      'Cursor-paginated, sortable and type-filterable file list of one bucket, with the ' +
      'bucket-wide stored bytes. The built-in `system` bucket also lists every file linked ' +
      'to a record. A bucket the app does not expose is answered 404 and writes no audit ' +
      'event. Admin only.',
    operationIdBase: 'listAdminBucketFiles',
    paramsSchema: adminReadPathParams({ bucketName: 'The bucket name' }),
    querySchema: bucketFilesQuerySchema,
    responseSchema: bucketFilesResponseSchema,
    responseDescription: 'One page of files',
  },
  subject: 'bucket file list',
  decode: decodeBucketFiles,
  read: (app, request) => BuildBucketFiles({ ...request, app }),
  audit: {
    action: AUDIT_ACTIONS.BUCKET_FILES_QUERIED,
    resourceId: (_app, request) => bucketIdForName(request.bucket),
  },
})

/** The bucket admin reads, in the order the registry lists them (no two paths overlap). */
export const BUCKETS_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  bucketsList,
  bucketsOverview,
  bucketFiles,
]
