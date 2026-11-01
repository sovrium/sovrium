/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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
 * import { Database } from '@/infrastructure/database'
 * import { users } from '@/infrastructure/database/schema'
 *
 * // `Database` is provided by the server's runtime (`DatabaseLive`, once).
 * const program = Effect.gen(function* () {
 *   const { client } = yield* Database
 *   const allUsers = yield* Effect.tryPromise(() => client.select().from(users))
 *   return allUsers
 * })
 * ```
 */

export { type PgDb, type PortableDb, type PortableTx } from './drizzle/db'
export { Database, DatabaseLive } from './drizzle/layer'
export * from './drizzle/schema'
export {
  DatabaseError,
  NotFoundError,
  ForeignKeyViolationError,
  UniqueConstraintViolationError,
  ValidationError,
} from './errors'
