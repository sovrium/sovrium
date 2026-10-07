/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/forms/:formName/analytics`.
 *
 * Encodes the two bodies the `forms.analytics` read
 * (`application/use-cases/admin/forms-analytics-read-operations.ts`) answers,
 * and nothing more:
 *
 *   - the AGGREGATE over a window: `totalCount`, `completionRate`,
 *     `dropOffByStep`, `submissionsPerDay`, `averageCompletionTime`,
 *     `attachmentCount`;
 *   - the OPT-OUT body `{ disabled: true, reason: 'analytics-opted-out' }`,
 *     answered with 200 (never 404) for a form declaring
 *     `analytics.enabled: false`, so a dashboard can say why it shows nothing.
 *
 * Two fields are honest zeros in this version and the contract says so rather
 * than implying a measurement: `averageCompletionTime` is always `0` (no
 * per-submission timing is captured), and `attachmentCount` is always `0`
 * (the aggregate query does not read submission data). Likewise every
 * `dropOffByStep[].droppedCount` is `0`: per-step abandonment needs a step
 * history the store does not keep. The schema accepts any non-negative value
 * so the day those are measured is not a contract change.
 *
 * The path parameter reuses `formsDetailParamsSchema` (`forms/list.ts`); an unknown form
 * name is the anti-enumeration 404, never 403.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * Query parameters for `GET /api/admin/forms/:formName/analytics`.
 *
 * `window` is a plain optional string, matching today's handler exactly: the
 * three recognised values are `24h`, `7d` and `30d`, and ANY other value —
 * including a typo — silently falls back to the 30-day default rather than
 * answering 400. A closed literal here would turn that fallback into a refusal,
 * which is a behaviour change for the route and belongs in a spec, not in a
 * schema migration.
 */
export const formAnalyticsQuerySchema = Schema.Struct({
  window: optionalField(
    Schema.String.annotate({
      description:
        'Aggregation window: `24h`, `7d` or `30d` (default). Any other value falls back to `30d`.',
      examples: ['24h', '7d', '30d'],
    })
  ),
}).annotate({ identifier: 'FormAnalyticsQuery' })

/** One day of submissions, as a UTC `YYYY-MM-DD` bucket. */
const submissionsPerDayPointSchema = Schema.Struct({
  day: Schema.String.annotate({
    description: 'The UTC calendar day, `YYYY-MM-DD`.',
    examples: ['2026-10-06'],
  }).pipe(Schema.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/))),
  count: Schema.Int.annotate({
    description: 'Submissions received on that day.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1))),
})

/** One step of a multi-step form, with its drop-off count. */
const dropOffStepSchema = Schema.Struct({
  stepName: Schema.String.annotate({
    description: 'The step id as declared in `form.steps[].id`.',
  }),
  droppedCount: Schema.Int.annotate({
    description:
      'Submissions abandoned at this step. Always `0` in this version: per-step abandonment is not tracked yet.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
})

/** The aggregate body, for a form whose analytics are enabled. */
const formAnalyticsAggregateSchema = Schema.Struct({
  totalCount: Schema.Int.annotate({
    description: 'Submissions received inside the window.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  completionRate: Schema.Finite.annotate({
    description:
      'Share of the window’s submissions whose status is `done` or `processed`, from `0` to `1`. `0` when the window holds no submission.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1))),
  dropOffByStep: Schema.NullOr(Schema.Array(dropOffStepSchema)).annotate({
    description:
      'One row per declared step for a `multi-step` form, in declaration order; `null` for a single-page form.',
  }),
  submissionsPerDay: Schema.Array(submissionsPerDayPointSchema).annotate({
    description:
      'Submissions per UTC day, ascending. Days with no submission are absent, not zero-filled.',
  }),
  averageCompletionTime: Schema.Finite.annotate({
    description: 'Average completion time. Always `0` in this version: it is not measured yet.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  attachmentCount: Schema.Int.annotate({
    description:
      'Attachments received inside the window. Always `0` in this version: the aggregate does not read submission data.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
}).annotate({ identifier: 'FormAnalyticsAggregate' })

/** The opt-out body, for a form declaring `analytics.enabled: false`. */
const formAnalyticsDisabledSchema = Schema.Struct({
  disabled: Schema.Literal(true).annotate({
    description: 'Always `true`: this form opted out of analytics.',
  }),
  reason: Schema.Literal('analytics-opted-out').annotate({
    description: 'Why no aggregate is returned. The only value today.',
  }),
}).annotate({ identifier: 'FormAnalyticsDisabled' })

/**
 * Response schema for `GET /api/admin/forms/:formName/analytics`: the
 * aggregate, or the opt-out body. Both are answered with 200.
 */
export const formAnalyticsResponseSchema = Schema.Union([
  formAnalyticsAggregateSchema,
  formAnalyticsDisabledSchema,
]).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'FormAnalyticsResponse',
})

/** @public */
export type FormAnalyticsQuery = typeof formAnalyticsQuerySchema.Type
/** @public */
export type FormAnalyticsAggregate = typeof formAnalyticsAggregateSchema.Type
/** @public */
export type FormAnalyticsDisabled = typeof formAnalyticsDisabledSchema.Type
/** @public */
export type FormAnalyticsResponse = typeof formAnalyticsResponseSchema.Type
