/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const DigestConfigSchema = Schema.Struct({
  defaultFrequency: Schema.Literal('immediate', 'hourly', 'daily').pipe(
    Schema.annotations({
      title: 'Default Frequency',
      description: 'Email digest delivery frequency',
    })
  ),

  dailyTime: Schema.optional(
    Schema.String.pipe(
      Schema.pattern(/^([01]\d|2[0-3]):[0-5]\d$/),
      Schema.annotations({
        title: 'Daily Time',
        description: 'UTC time for daily digest delivery (HH:MM format)',
        examples: ['09:00', '18:30'],
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'DigestConfig',
    title: 'Email Digest Configuration',
    description: 'Controls batching and delivery timing of email notification digests.',
  })
)
