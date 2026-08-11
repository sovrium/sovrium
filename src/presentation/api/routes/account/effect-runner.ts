/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AccountLayer } from '@/application/use-cases/account'

/**
 * Provide AccountLayer to an Effect program.
 *
 * Isolates the infrastructure import (the repository Live layer, bundled in
 * `AccountLayer`) so the account route handlers depend only on the application
 * layer. This is the composition root for the two authenticated GDPR endpoints
 * (`GET /api/account/export`, `POST /api/account/delete`). The `purge-due`
 * trigger does not use this runner — it calls `purgeDueAccounts` directly.
 */
export function provideAccountLive<A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, never> {
  return Effect.provide(program, AccountLayer) as Effect.Effect<A, E, never>
}
