/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Duration, Effect } from 'effect'
import { recordDbQuery } from './metrics'

export type DbOperation = 'select' | 'insert' | 'update' | 'delete'

export const traceDbQuery = <A, E, R>(
  operation: DbOperation,
  table: string,
  query: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.timed(query).pipe(
    Effect.tap(([elapsed]) => recordDbQuery(operation, table, Duration.toMillis(elapsed) / 1000)),
    Effect.map(([, result]) => result),
    Effect.withSpan('db.query', { attributes: { operation, table } })
  )
