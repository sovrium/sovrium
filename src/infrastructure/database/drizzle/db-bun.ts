/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { drizzle } from 'drizzle-orm/bun-sql'
import * as schema from './schema'


type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>

let cached: DrizzleClient | undefined

export const getDb = (): DrizzleClient => {
  if (cached !== undefined) return cached
  const url = process.env.DATABASE_URL
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_URL must be set before accessing the database. ' +
        'If this throws during module-import, a static import is reaching the database eagerly — ' +
        'switch to a lazy access pattern (call getDb() inside a function body).'
    )
  }
  cached = drizzle({ connection: { url }, schema })
  return cached
}

export const db: DrizzleClient = new Proxy({} as DrizzleClient, {
  get: (_target, prop) => Reflect.get(getDb(), prop),
})

export type DrizzleDB = DrizzleClient
