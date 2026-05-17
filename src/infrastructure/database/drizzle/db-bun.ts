/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { drizzle } from 'drizzle-orm/bun-sql'
import * as schema from './schema'

/**
 * Lazy Drizzle initialization.
 *
 * The eager `drizzle({ connection: { url: process.env.DATABASE_URL! }, schema })`
 * call at module-import time crashed boot when `DATABASE_URL` was unset,
 * which forced ~7 callsites across the codebase to defer the entire
 * repository module via `await import('@/infrastructure/database/...')` so
 * boot paths that don't touch the database (CLI's `schema` / `validate`
 * subcommands, type-only test fixtures) wouldn't trip the assertion.
 *
 * Move the initialization into a memoizing `getDb()` function. The first
 * caller validates `DATABASE_URL` and constructs the client; subsequent
 * callers reuse the cached client. Boot paths that don't touch the database
 * never call `getDb()` and thus never trip the env-var requirement.
 *
 * The `db` proxy preserves the eager-import API (`import { db } from
 * '@/infrastructure/database'` keeps working) by deferring property access
 * to `getDb()` on every read. The proxy is transparent — `db.select()`
 * triggers `getDb()` once, then chains the real Drizzle client's methods.
 * Better Auth's `drizzleAdapter` consumes `db` the same way and continues
 * to work unchanged.
 */

type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>

// eslint-disable-next-line functional/no-let, functional/prefer-immutable-types -- one-shot module-level memo cache; replaces the eager const that crashed at boot when DATABASE_URL was unset
let cached: DrizzleClient | undefined

// eslint-disable-next-line functional/prefer-immutable-types -- DrizzleClient is the upstream return shape from drizzle-orm/bun-sql; the lint rule cannot prove our consumers don't mutate it. We don't.
export const getDb = (): DrizzleClient => {
  if (cached !== undefined) return cached
  const url = process.env.DATABASE_URL
  if (url === undefined || url === '') {
    // eslint-disable-next-line functional/no-throw-statements -- explicit boundary failure: throwing here gives a clearer stack than letting drizzle({ connection: { url: undefined } }) fault deeper in the bun:sql driver
    throw new Error(
      'DATABASE_URL must be set before accessing the database. ' +
        'If this throws during module-import, a static import is reaching the database eagerly — ' +
        'switch to a lazy access pattern (call getDb() inside a function body).'
    )
  }
  // eslint-disable-next-line functional/no-expression-statements -- module-level memo cache assignment
  cached = drizzle({ connection: { url }, schema })
  return cached
}

/**
 * Lazy proxy preserving the eager `db` import API across ~36 static
 * importers. Each property access defers to `getDb()`; subsequent
 * accesses reuse the cached client. Drop this proxy in a future refactor
 * once every consumer migrates to explicit `getDb()` calls.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- DrizzleClient is upstream-mutable (Proxy<DrizzleClient> for the same reason as getDb's return)
export const db: DrizzleClient = new Proxy({} as DrizzleClient, {
  get: (_target, prop) => Reflect.get(getDb(), prop),
})

export type DrizzleDB = DrizzleClient
