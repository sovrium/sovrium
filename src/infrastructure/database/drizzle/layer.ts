/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Layer } from 'effect'
import { db, type DrizzleDB } from './db.js'

/**
 * Database Effect Context
 *
 * Provides Drizzle database instance for dependency injection in Effect programs.
 * Use this in Application layer to access database without direct imports.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const db = yield* Database
 *   const users = yield* Effect.tryPromise(() => db.select().from(usersTable))
 *   return users
 * })
 * ```
 */
export class Database extends Context.Tag('Database')<Database, DrizzleDB>() {}

/**
 * Live Database Layer
 *
 * Provides the production Drizzle database instance.
 * Uses DATABASE_URL environment variable for connection.
 */
export const DatabaseLive = Layer.succeed(Database, db)
