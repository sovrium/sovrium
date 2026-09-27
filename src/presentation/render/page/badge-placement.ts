/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isBadgeEnabled, type Badge } from '@/domain/models/app/badge'

/** Where the badge sits — see `badge.placement` in the app schema. */
export type BadgePlacement = 'floating' | 'footer'

/**
 * Resolve the app's `badge` setting to what every mount site needs: where the
 * badge sits, or `undefined` when `badge: false` removes it. One call per site,
 * so visibility and placement cannot be threaded apart. Only the object form
 * can name a placement; `true`, an omitted property and `{}` all float.
 */
export const resolveBadge = (badge: Badge | undefined): BadgePlacement | undefined => {
  if (!isBadgeEnabled(badge)) return undefined
  return typeof badge === 'object' && badge.placement === 'footer' ? 'footer' : 'floating'
}
