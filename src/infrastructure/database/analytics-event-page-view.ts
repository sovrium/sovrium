/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { PageViewInput } from '@/application/ports/repositories/analytics/analytics-repository'

/**
 * The page-view specific columns of an `analytics_events` row.
 *
 * A page view is named by its path, exactly as `properties.path` stores it
 * (already query-free under `audience-only`), so the `event_name` filter finds
 * it like any other event. The properties stay a plain object: the caller binds
 * them with `bindJsonb`, which stores a jsonb OBJECT on Postgres (a jsonb STRING
 * would make `properties->>'path'` NULL) and plain JSON text on SQLite.
 */
export const pageViewRowFields = (input: PageViewInput) => ({
  eventName: input.pagePath,
  properties: {
    path: input.pagePath,
    title: input.pageTitle,
    isEntrance: input.isEntrance,
    referrerUrl: input.referrerUrl,
    referrerDomain: input.referrerDomain,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    utmContent: input.utmContent,
    utmTerm: input.utmTerm,
    deviceType: input.deviceType,
    browserName: input.browserName,
    osName: input.osName,
    language: input.language,
    screenWidth: input.screenWidth,
    screenHeight: input.screenHeight,
  },
})
