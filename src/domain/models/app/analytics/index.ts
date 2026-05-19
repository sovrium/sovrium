/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const BuiltInAnalyticsSchema = Schema.Union(
  Schema.Boolean,
  Schema.Struct({
    retentionDays: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.between(1, 730),
        Schema.annotations({
          title: 'Retention Days',
          description: 'Number of days to retain analytics data (1-730)',
        })
      )
    ),

    excludedPaths: Schema.optional(
      Schema.Array(Schema.String).pipe(
        Schema.annotations({
          title: 'Excluded Paths',
          description: 'Glob patterns for paths excluded from tracking',
        })
      )
    ),

    respectDoNotTrack: Schema.optional(Schema.Boolean),

    sessionTimeout: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.between(1, 120),
        Schema.annotations({
          title: 'Session Timeout',
          description: 'Session timeout in minutes (1-120)',
        })
      )
    ),
  })
).pipe(
  Schema.annotations({
    identifier: 'BuiltInAnalytics',
    title: 'Built-in Analytics Configuration',
    description:
      'First-party, privacy-friendly analytics engine. No cookies, no external dependencies, GDPR-compliant.',
    examples: [
      true,
      {
        retentionDays: 90,
        excludedPaths: ['/admin/*', '/api/*'],
        sessionTimeout: 15,
      },
      false,
    ],
  })
)

export type BuiltInAnalytics = Schema.Schema.Type<typeof BuiltInAnalyticsSchema>

export type BuiltInAnalyticsEncoded = Schema.Schema.Encoded<typeof BuiltInAnalyticsSchema>

export * from './event-type'
