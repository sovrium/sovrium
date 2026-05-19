/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'


export const ensureTrigramExtension = async (): Promise<void> => {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
}

export const trigramSearch = async (
  tableName: string,
  column: string,
  query: string,
  limit = 20
): Promise<readonly { readonly id: string; readonly similarity: number }[]> => {
  await ensureTrigramExtension()

  const result = await db.execute(sql`
    SELECT
      id::text,
      similarity(${sql.raw(column)}, ${query}) AS similarity
    FROM ${sql.raw(tableName)}
    WHERE similarity(${sql.raw(column)}, ${query}) > 0.1
    ORDER BY similarity DESC
    LIMIT ${limit}
  `)

  return (result as readonly Record<string, unknown>[]).map((row) => ({
    id: (row as { id: string }).id,
    similarity: (row as { similarity: number }).similarity,
  }))
}
