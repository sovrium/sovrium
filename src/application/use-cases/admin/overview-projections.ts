/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure projections for the cross-domain admin overview roll-up
 * (`buildAdminOverview`, `GET /api/admin/overview`).
 *
 * Why these live outside `overview.ts`
 * ------------------------------------
 * The reduce that sums the per-form aggregates is unreachable from an HTTP
 * caller — no request can make a healthy database return an unusable count —
 * so the `NaN`-poisoning defect behind the 2026-07-25 production 500 had no
 * testable tier at all while it lived inside a block. (The blocks used to weld
 * their layer in place with an inline `Effect.provide` too, which closed the
 * unit tier as well; they declare their port now, but the extraction is what
 * gives this reduce a test either way.)
 *
 * Extracting the reduce into a dependency-free projection gives it one — the
 * same seam `withBlockTimeout` (`overview-block-timeout.ts`) already carved out
 * for the latency axis. This module imports no layers and no infrastructure, so
 * its tests run without a database.
 */

import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import type { AdminFormAggregateRow } from '@/application/ports/repositories/forms/admin-forms-repository'

/**
 * Sum the per-form submission counts into the `submissions.total` headline.
 *
 * Every entry is coerced through {@link toFiniteCount}, so a single aggregate
 * that yields no usable count contributes `0` instead of turning the whole
 * total into `NaN` — which the route's `adminOverviewResponseSchema` gate would
 * reject, 500-ing the entire dashboard over one degraded domain.
 */
export const sumSubmissionCounts = (aggregates: ReadonlyArray<AdminFormAggregateRow>): number =>
  aggregates.reduce((acc: number, aggregate) => acc + toFiniteCount(aggregate.submissionCount), 0)
