/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Analytics Event Type Schema
 *
 * Discriminates between built-in page view events and custom tracking events
 * sent by automations or the client-side SDK.
 *
 * - `page_view` — Automatically recorded when a visitor navigates to a page.
 * - `track` — Explicitly recorded via the tracking API or automation actions.
 */
export const AnalyticsEventTypeSchema = Schema.Literal('page_view', 'track').pipe(
  Schema.annotations({
    identifier: 'AnalyticsEventType',
    title: 'Analytics Event Type',
    description: 'Discriminator for page view events vs custom tracking events',
  })
)

/**
 * TypeScript type inferred from AnalyticsEventTypeSchema
 * @public
 */
export type AnalyticsEventType = Schema.Schema.Type<typeof AnalyticsEventTypeSchema>
