/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { RetentionSweeps } from '@/application/ports/services/retention-sweeps'

/**
 * Run the expired sign-in rows sweep once, on demand: the same sweep the daily
 * job runs. Answers how many device codes and verification rows it deleted.
 */
export const pruneExpiredAuthRows = Effect.fn('auth.prune-expired-auth-rows')(function* () {
  const sweeps = yield* RetentionSweeps
  return yield* sweeps.purgeExpiredAuthRows
})
