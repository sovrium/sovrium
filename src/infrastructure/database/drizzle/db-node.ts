/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Node.js-specific database driver using postgres.js
// Use max 1 connection to avoid connection pool issues in test environment
const client = postgres(process.env.DATABASE_URL!, { max: 1 })
export const db = drizzle({ client, schema })

export type DrizzleDB = typeof db
