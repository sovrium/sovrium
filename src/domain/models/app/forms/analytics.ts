/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Form Analytics Configuration
 *
 * Per-form opt-out for aggregate analytics. The default behavior (no
 * `analytics` block on a form) is `enabled: true` — every successful
 * submission feeds the unified `system.analytics_events` table and the
 * admin "Forms Responses" surface aggregates the form's
 * `dropOffByStep`, `submissionsPerDay`, and other rollups.
 *
 * Set `enabled: false` for forms handling sensitive data (PHI, PCI,
 * legal-hold submissions) that must NOT contribute to aggregate analytics.
 * Per-submission inspection (`/admin/forms/{name}/submissions/{id}`)
 * remains available regardless — the opt-out only excludes the form from
 * cross-submission aggregates and the global event stream.
 *
 * See US-FORMS-ANALYTICS-AND-RESPONSES (APP-FORMS-118..127) for the admin
 * surface that consumes per-form aggregates.
 */
export const FormAnalyticsSchema = Schema.Struct({
  /**
   * When `false`, the form is excluded from aggregate analytics. When
   * omitted (or `true`), aggregate analytics apply. Default = `true`.
   */
  enabled: Schema.optional(
    Schema.Boolean.annotations({
      description:
        'When false, this form is excluded from aggregate analytics and the system.analytics_events stream. Default = true.',
    })
  ),
}).annotations({
  identifier: 'FormAnalytics',
  title: 'Form Analytics Configuration',
  description: 'Per-form opt-out for aggregate analytics (default: enabled when omitted)',
})

/** @public */
export type FormAnalytics = Schema.Schema.Type<typeof FormAnalyticsSchema>
