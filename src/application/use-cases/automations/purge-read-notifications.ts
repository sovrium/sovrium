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
 * Run the notification retention sweep once, on demand: the read
 * notifications, and the digest-only ones, past `notifications.retention.days`.
 * Answers how many it deleted; an app without notifications deletes none.
 */
export const purgeReadNotifications = Effect.fn('automations.purge-read-notifications')(function* (
  app: Pick<App, 'notifications'>
) {
  const sweeps = yield* RetentionSweeps
  return yield* sweeps.purgeReadNotifications(app)
})
