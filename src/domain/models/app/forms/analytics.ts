/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const FormAnalyticsSchema = Schema.Struct({
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

export type FormAnalytics = Schema.Schema.Type<typeof FormAnalyticsSchema>
