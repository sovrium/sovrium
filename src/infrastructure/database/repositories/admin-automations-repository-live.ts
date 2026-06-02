/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq, gte, lt, type SQL } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AdminAutomationsDatabaseError,
  AdminAutomationsRepository,
  type AdminAutomationOverviewRow,
  type AdminAutomationRunRow,
  type AdminRunsListFilters,
} from '@/application/ports/repositories/admin-automations-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  automationDefinitions as automationDefinitionsPg,
  automationRuns as automationRunsPg,
} from '@/infrastructure/database/drizzle/schema/automation'
import {
  automationDefinitions as automationDefinitionsSqlite,
  automationRuns as automationRunsSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/automation'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const automationRuns = resolveDialectSchema(automationRunsPg, automationRunsSqlite)
const automationDefinitions = resolveDialectSchema(
  automationDefinitionsPg,
  automationDefinitionsSqlite
)

const wrap = makeDbWrap((cause) => new AdminAutomationsDatabaseError({ cause }))

const buildListConditions = (filters: AdminRunsListFilters): ReadonlyArray<SQL> => {
  const statusFilter: ReadonlyArray<SQL> =
    filters.status !== undefined ? [eq(automationRuns.status, filters.status)] : []
  const nameFilter: ReadonlyArray<SQL> =
    filters.automationName !== undefined
      ? [eq(automationDefinitions.name, filters.automationName)]
      : []
  const idFilter: ReadonlyArray<SQL> =
    filters.automationId !== undefined
      ? [eq(automationRuns.automationId, filters.automationId)]
      : []
  const fromFilter: ReadonlyArray<SQL> =
    filters.from !== undefined ? [gte(automationRuns.createdAt, filters.from)] : []
  const toFilter: ReadonlyArray<SQL> =
    filters.to !== undefined ? [lt(automationRuns.createdAt, filters.to)] : []
  const cursorFilter: ReadonlyArray<SQL> =
    filters.cursorBefore !== undefined ? [lt(automationRuns.createdAt, filters.cursorBefore)] : []
  return [...statusFilter, ...nameFilter, ...idFilter, ...fromFilter, ...toFilter, ...cursorFilter]
}

const listAdminRunsImpl = async (
  filters: AdminRunsListFilters
): Promise<ReadonlyArray<AdminAutomationRunRow>> => {
  const conditions = buildListConditions(filters)
  const whereClause = conditions.length === 0 ? undefined : and(...conditions)
  const baseQuery = db
    .select({
      id: automationRuns.id,
      automationName: automationDefinitions.name,
      status: automationRuns.status,
      triggerData: automationRuns.triggerData,
      startedAt: automationRuns.startedAt,
      completedAt: automationRuns.completedAt,
      durationMs: automationRuns.durationMs,
      error: automationRuns.error,
      createdAt: automationRuns.createdAt,
    })
    .from(automationRuns)
    .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
  const filtered = whereClause === undefined ? baseQuery : baseQuery.where(whereClause)
  return (await filtered
    .orderBy(desc(automationRuns.createdAt))
    .limit(filters.limit + 1)) as ReadonlyArray<AdminAutomationRunRow>
}

export const AdminAutomationsRepositoryLive = Layer.succeed(AdminAutomationsRepository, {
  listOverviewRowsSince: (since) =>
    wrap(
      async () =>
        (await db
          .select({
            startedAt: automationRuns.startedAt,
            createdAt: automationRuns.createdAt,
            status: automationRuns.status,
          })
          .from(automationRuns)
          .where(gte(automationRuns.createdAt, since))) as ReadonlyArray<AdminAutomationOverviewRow>
    ),

  listOverviewStatusesSince: (since) =>
    wrap(
      async () =>
        (await db
          .select({ status: automationRuns.status })
          .from(automationRuns)
          .where(gte(automationRuns.createdAt, since))) as ReadonlyArray<{
          status: string | null
        }>
    ),

  listAdminRuns: (filters) => wrap(async () => listAdminRunsImpl(filters)),

  findAdminRunById: (runId) =>
    wrap(async () => {
      const rows = (await db
        .select({
          id: automationRuns.id,
          automationName: automationDefinitions.name,
          status: automationRuns.status,
          triggerData: automationRuns.triggerData,
          startedAt: automationRuns.startedAt,
          completedAt: automationRuns.completedAt,
          durationMs: automationRuns.durationMs,
          error: automationRuns.error,
          createdAt: automationRuns.createdAt,
        })
        .from(automationRuns)
        .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
        .where(eq(automationRuns.id, runId))
        .limit(1)) as ReadonlyArray<AdminAutomationRunRow>
      return rows[0]
    }),
})
