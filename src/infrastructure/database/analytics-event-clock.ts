/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readSovriumDevClock } from '@/domain/models/process-env/dev-clock'

/**
 * The event's time under a pinned development clock: the pinned instant, so
 * an event recorded on a server that answers "now" at `SOVRIUM_DEV_CLOCK` falls
 * inside the windows that same server resolves. Unset (and always in
 * production), nothing — the column's own default stamps the real time.
 */
export const devClockStamp = (): { readonly timestamp?: Date } => {
  const pinned = readSovriumDevClock()
  return pinned === undefined ? {} : { timestamp: new Date(pinned.getTime()) }
}
