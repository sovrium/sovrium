/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

/**
 * Database connection for Better Auth using node-postgres driver
 *
 * IMPORTANT: Better Auth's drizzle adapter does NOT support Bun's native SQL driver.
 * It requires a traditional PostgreSQL driver like 'pg', 'postgres', '@neondatabase/serverless',
 * or '@vercel/postgres'.
 *
 * @see https://github.com/better-auth/better-auth/issues/2283
 * @see https://www.better-auth.com/docs/adapters/drizzle
 *
 * This is separate from the main app's db (which uses bun-sql for better performance).
 * Better Auth operations are isolated to this connection.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Connection pool size
})

export const authDb = drizzle(pool, { schema })

export type AuthDrizzleDB = typeof authDb
