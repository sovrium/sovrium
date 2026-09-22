/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { executeRawTyped } from '@/infrastructure/database/sql/dialect-execute'
import type { DrizzleTransaction } from '@/infrastructure/database'
import type { SQL } from 'drizzle-orm'

/**
 * Execute a SQL query within a transaction and return typed results.
 *
 * Dialect-aware: delegates to `executeRawTyped`, which runs `.execute()` on
 * PostgreSQL and `.all()` on SQLite (the bun-sqlite client has no `.execute()`)
 * and normalizes both to a rows array. Call sites stay cast-free.
 *
 * @param tx - Drizzle transaction
 * @param query - SQL query (from drizzle-orm sql template tag)
 * @returns Typed array of results
 */
export async function typedExecute<T = Record<string, unknown>>(
  tx: Readonly<DrizzleTransaction>,
  query: Readonly<SQL>
): Promise<readonly T[]> {
  return executeRawTyped<T>(tx, query)
}
