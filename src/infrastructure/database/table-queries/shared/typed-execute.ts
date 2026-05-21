/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { executeRawTyped } from '@/infrastructure/database/sql/dialect-execute'
import type { DrizzleTransaction } from '@/infrastructure/database'
import type { SQL } from 'drizzle-orm'

export async function typedExecute<T = Record<string, unknown>>(
  tx: Readonly<DrizzleTransaction>,
  query: Readonly<SQL>
): Promise<readonly T[]> {
  return executeRawTyped<T>(tx, query)
}
