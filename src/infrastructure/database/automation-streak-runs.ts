/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq, inArray, lt } from 'drizzle-orm'
import {
  STREAK_COUNTED_RUN_STATUSES,
  type StreakRun,
} from '@/domain/models/app/automations/failure-streak-service'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  automationDefinitions as automationDefinitionsPg,
  automationRuns as automationRunsPg,
} from '@/infrastructure/database/drizzle/schema/automation'
import {
  automationDefinitions as automationDefinitionsSqlite,
  automationRuns as automationRunsSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/automation'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'

const automationDefinitions = resolveDialectSchema(
  automationDefinitionsPg,
  automationDefinitionsSqlite
)
const automationRuns = resolveDialectSchema(automationRunsPg, automationRunsSqlite)

/**
 * The latest runs of `automationName` a failure streak reads, completed before
 * `before`, newest first, at most `limit` — the read behind
 * `AutomationRunOutcomeRepository.listStreakRuns`.
 */
export const selectStreakRuns = async (
  db: PortableDb,
  input: {
    readonly automationName: string
    readonly before: Readonly<Date>
    readonly limit: number
  }
): Promise<readonly StreakRun[]> => {
  const rows = await db
    .select({
      id: automationRuns.id,
      status: automationRuns.status,
      error: automationRuns.error,
      completedAt: automationRuns.completedAt,
    })
    .from(automationRuns)
    .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
    .where(
      and(
        eq(automationDefinitions.name, input.automationName),
        inArray(automationRuns.status, [...STREAK_COUNTED_RUN_STATUSES]),
        lt(automationRuns.completedAt, input.before)
      )
    )
    .orderBy(desc(automationRuns.completedAt))
    .limit(input.limit)
  return rows.flatMap((row): readonly StreakRun[] =>
    row.completedAt instanceof Date ? [{ ...row, completedAt: row.completedAt }] : []
  )
}
