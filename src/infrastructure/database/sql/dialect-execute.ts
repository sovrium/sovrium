/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import { extractRows } from './sql-utils'
import type { SQL } from 'drizzle-orm'


export interface RawSqlRunner {
  readonly execute?: (query: Readonly<SQL>) => Promise<unknown> | unknown
  readonly all?: (query: Readonly<SQL>) => Promise<unknown> | unknown
}

export const executeRaw = async (
  runner: Readonly<RawSqlRunner>,
  query: Readonly<SQL>
): Promise<ReadonlyArray<Record<string, unknown>>> => {
  const { dialect } = parseDatabaseDialectConfig()

  if (dialect === 'postgres') {
    if (typeof runner.execute !== 'function') {
      throw new TypeError('executeRaw: PostgreSQL runner is missing an execute() method')
    }
    return extractRows(await runner.execute(query))
  }

  if (typeof runner.all !== 'function') {
    throw new TypeError('executeRaw: SQLite runner is missing an all() method')
  }
  return extractRows(await runner.all(query))
}

export const executeRawTyped = async <T = Record<string, unknown>>(
  runner: Readonly<RawSqlRunner>,
  query: Readonly<SQL>
): Promise<readonly T[]> => (await executeRaw(runner, query)) as unknown as readonly T[]
