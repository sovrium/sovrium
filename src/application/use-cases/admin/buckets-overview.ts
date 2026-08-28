/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use case for the storage overview's `series` block
 * (`GET /api/admin/buckets/overview`).
 *
 * The series answers "when were these bytes stored?", which the `totals` block
 * cannot: totals are a live reading of the storage backend
 * (`StorageService.list('')` / `.getTotalBytes()`) and carry no time dimension.
 * The two are deliberately different sources describing the same corpus, so
 * summing the series over the whole window must equal the totals — a chart whose
 * bars do not add up to the headline number is worse than no chart.
 *
 * Source: `system.file_storage_metadata`. It is the only complete, sized,
 * timestamped record of what is stored — `size` and `created_at` are both NOT
 * NULL and every provider writes a row on every upload path. The audit log
 * cannot serve here: its `bucket.file.uploaded` entries carry no byte size, and
 * the public upload route (`POST /api/buckets/:name/files`) emits no entry at
 * all, so an audit-derived series would report no bytes and systematically
 * under-count uploads.
 *
 * Bucketing is window-relative rather than calendar-aligned, because the
 * response contract locks the point count to the period preset (24h → 24 points,
 * 7d → 7, 30d → 30) and a floor-aligned grid spans one bucket more. Points are
 * labelled by their START edge, as the response schema states.
 */

import { Effect } from 'effect'
import {
  AdminBucketFilesRepository,
  type AdminBucketUploadRow,
  type AdminBucketFilesDatabaseError,
} from '@/application/ports/repositories/buckets/admin-bucket-files-repository'
import { buildWindowRelativeSeries, intervalStepMs } from '@/domain/utils/time-series-bucketing'
import type { PeriodWindow } from '@/domain/models/api/admin/_shared/period-preset'
import type { BucketsOverviewSeriesPoint } from '@/domain/models/api/admin/buckets/overview'

/**
 * Fold catalog rows into the window's upload series. Pure — the rows are
 * supplied by the caller (sourced via the repository).
 */
export const buildBucketUploadSeries = (
  window: PeriodWindow,
  rows: ReadonlyArray<AdminBucketUploadRow>
): ReadonlyArray<BucketsOverviewSeriesPoint> =>
  buildWindowRelativeSeries({
    rows,
    getTimestamp: (row) => row.createdAt,
    fromIso: window.from,
    toIso: window.to,
    stepMs: intervalStepMs(window.interval),
    initial: { uploads: 0, bytes: 0 },
    accumulate: (acc, row) => ({
      uploads: acc.uploads + 1,
      // `size` arrives as a driver-native numeric (Postgres integer, SQLite
      // integer); `Number` normalizes the string a bigint-ish driver may hand
      // back so the sum stays arithmetic rather than string concatenation.
      bytes: acc.bytes + Number(row.size),
    }),
  })

/**
 * Read the storage catalog for the window and build the overview's series
 * points. Rows older than `window.from` are excluded by the query itself; the
 * pure folder assigns each remaining row to the interval that contains it.
 */
export const BuildBucketUploadSeries = (
  window: PeriodWindow
): Effect.Effect<
  ReadonlyArray<BucketsOverviewSeriesPoint>,
  AdminBucketFilesDatabaseError,
  AdminBucketFilesRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AdminBucketFilesRepository
    const rows = yield* repo.listUploadsSince(new Date(window.from))
    return buildBucketUploadSeries(window, rows)
  })
