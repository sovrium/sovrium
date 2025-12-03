/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Database Infrastructure Module
 *
 * Provides database access and ORM utilities.
 * Currently uses Drizzle ORM with PostgreSQL via Bun SQL.
 *
 * @example
 * ```typescript
 * import { Database, DatabaseLive } from '@/infrastructure/database'
 * import { users } from '@/infrastructure/database/schema'
 *
 * const program = Effect.gen(function* () {
 *   const db = yield* Database
 *   const allUsers = yield* Effect.tryPromise(() => db.select().from(users))
 *   return allUsers
 * }).pipe(Effect.provide(DatabaseLive))
 * ```
 */

export { db, type DrizzleDB } from './drizzle/db'
export { Database, DatabaseLive } from './drizzle/layer'
export * from './drizzle/schema'
export {
  setDatabaseSessionContext,
  clearDatabaseSessionContext,
  getCurrentSessionContext,
  SessionContextError,
  type DatabaseTransaction,
} from './session-context'
export { withSessionContext, withSessionContextSimple } from './with-session-context'
