/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const AnalyticsEventTypeSchema = Schema.Literal('page_view', 'track').pipe(
  Schema.annotations({
    identifier: 'AnalyticsEventType',
    title: 'Analytics Event Type',
    description: 'Discriminator for page view events vs custom tracking events',
  })
)

export type AnalyticsEventType = Schema.Schema.Type<typeof AnalyticsEventTypeSchema>
