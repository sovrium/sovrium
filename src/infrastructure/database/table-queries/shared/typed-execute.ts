/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DrizzleTransaction } from '@/infrastructure/database'
import type { SQL } from 'drizzle-orm'

/**
 * Execute a SQL query within a transaction and return typed results.
 *
 * Centralizes the type assertion needed because Drizzle's tx.execute()
 * return type doesn't match Record<string, unknown>[]. By keeping the
 * single `as unknown as` cast here, call sites remain cast-free.
 *
 * @param tx - Drizzle transaction
 * @param query - SQL query (from drizzle-orm sql template tag)
 * @returns Typed array of results
 */
export async function typedExecute<T = Record<string, unknown>>(
  tx: Readonly<DrizzleTransaction>,
  query: Readonly<SQL>
): Promise<readonly T[]> {
  return (await tx.execute(query)) as unknown as readonly T[]
}
