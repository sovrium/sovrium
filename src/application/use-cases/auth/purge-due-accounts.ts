/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { RetentionSweeps } from '@/application/ports/services/retention-sweeps'
import type { App } from '@/domain/models/app'

/**
 * Run the erasure scheduler once, on demand: hard-delete every account whose
 * scheduled erasure is past, with its rows in the app's tables — the same
 * sweep the recurring job runs. An account the last-admin rail refuses is
 * deferred, not counted. Answers how many accounts were erased.
 */
export const purgeDueAccounts = Effect.fn('auth.purge-due-accounts')(function* (app: App) {
  const sweeps = yield* RetentionSweeps
  return yield* sweeps.purgeDueAccounts(app)
})
