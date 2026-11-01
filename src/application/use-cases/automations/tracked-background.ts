/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AutomationFiberBridge } from '@/application/ports/services/automation-fiber-bridge'

/**
 * Run `program` in a background fiber the server tracks, and return at once.
 *
 * Tracking is what lets a stopping or reloading server wait for the work or
 * close it as stopped, instead of cutting it off mid-write or letting it
 * outlive the server. The fiber keeps the services of the program that
 * started it.
 *
 * A leaf on purpose: it imports nothing but the port, so the record write
 * orchestrations can use it without importing the automation run loop (which
 * imports them back through the record action handlers).
 */
export const startInTrackedBackground = <A, E, R>(program: Effect.Effect<A, E, R>) =>
  AutomationFiberBridge.use((bridge) =>
    Effect.asVoid(Effect.forkDetach(bridge.trackBackground(program)))
  )
