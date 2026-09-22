/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The eco middleware stack and its opt-out route.
 *
 * Mount ORDER is the whole content of this module: Hono runs middleware LIFO on
 * the response path, so the comment below is the specification and the two
 * `.use` calls are its implementation.
 */

import { ecoIndexHeaderMiddleware } from '@/infrastructure/server/middleware/eco-index-header'
import { lowDataModeMiddleware } from '@/infrastructure/server/middleware/low-data-mode'
import { chainLowDataOptOutRoute } from '@/infrastructure/server/middleware/low-data-opt-out'
import type { Hono } from 'hono'

export const applyEcoStack = (
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono types are mutable by library design
  honoApp: Hono
) => {
  // Eco middleware stack — registered in the order their POST-next code
  // should LAST run. Hono middleware runs LIFO on the response path:
  //   handler → low-data POST (rewrites HTML body) → eco-index POST (grades
  //   the rewritten body via the new Content-Length).
  // So eco-index is registered FIRST (its post-next code runs OUTERMOST,
  // i.e. LAST, AFTER low-data has finished mutating).
  const honoWithEcoMiddleware = honoApp
    .use('*', ecoIndexHeaderMiddleware())
    .use('*', lowDataModeMiddleware())

  // Wire the low-data opt-out endpoint (`/__sovrium/eco/low-data-opt-out`)
  // that the footer "Show full version" link points to. Sets the
  // `sovrium_low_data=off` cookie and 302s back to the source page.
  const honoWithEcoHeader = chainLowDataOptOutRoute(honoWithEcoMiddleware)
  return honoWithEcoHeader
}
