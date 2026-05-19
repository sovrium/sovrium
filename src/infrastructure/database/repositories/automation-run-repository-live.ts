/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq, sql, type SQL } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AutomationRunDatabaseError,
  AutomationRunRepository,
  type CreateRunInput,
  type CreateStepInput,
  type ListRunsOptions,
  type PersistedRun,
  type PersistedStep,
} from '@/application/ports/repositories/automation-run-repository'
import { db } from '@/infrastructure/database'
import {
  automationDefinitions,
  automationRuns,
  automationRunSteps,
} from '@/infrastructure/database/drizzle/schema/automation'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const wrap = makeDbWrap((cause) => new AutomationRunDatabaseError({ cause }))

const toIso = (
  value: Readonly<Date> | null | undefined
): string | null => (value instanceof Date ? value.toISOString() : null)

const toRun = (
  runRow: Readonly<typeof automationRuns.$inferSelect>,
  definitionName: string
): PersistedRun => ({
  id: runRow.id,
  automationId: runRow.automationId,
  automationName: definitionName,
  status: runRow.status,
  triggerData: runRow.triggerData,
  startedAt: toIso(runRow.startedAt),
  completedAt: toIso(runRow.completedAt),
  durationMs: runRow.durationMs,
  error: runRow.error,
})

const toStep = (row: Readonly<typeof automationRunSteps.$inferSelect>): PersistedStep => ({
  id: row.id,
  runId: row.runId,
  actionName: row.actionName,
  stepIndex: row.stepIndex,
  status: row.status,
  input: row.input,
  output: row.output,
  startedAt: toIso(row.startedAt),
  completedAt: toIso(row.completedAt),
  durationMs: row.durationMs,
  error: row.error,
})

const runInsertOptionals = (input: Readonly<CreateRunInput>) => ({
  ...(input.triggerData !== undefined ? { triggerData: input.triggerData as object } : {}),
  ...(input.startedAt !== undefined ? { startedAt: input.startedAt } : {}),
  ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
  ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
  ...(input.error !== undefined ? { error: input.error } : {}),
})

const stepValues = (runId: string, steps: readonly CreateStepInput[]) =>
  steps.map((step) => ({
    runId,
    actionName: step.actionName,
    stepIndex: step.stepIndex,
    status: step.status,
    ...(step.input !== undefined ? { input: step.input as object } : {}),
    ...(step.output !== undefined ? { output: step.output as object } : {}),
    ...(step.startedAt !== undefined ? { startedAt: step.startedAt } : {}),
    ...(step.completedAt !== undefined ? { completedAt: step.completedAt } : {}),
    ...(step.durationMs !== undefined ? { durationMs: step.durationMs } : {}),
    ...(step.error !== undefined ? { error: step.error } : {}),
  }))

const buildListFilters = (options: ListRunsOptions): ReadonlyArray<SQL> => {
  const nameFilter: ReadonlyArray<SQL> =
    options.automationName !== undefined
      ? [eq(automationDefinitions.name, options.automationName)]
      : []
  const statusFilter: ReadonlyArray<SQL> =
    options.status !== undefined ? [eq(automationRuns.status, options.status)] : []
  return [...nameFilter, ...statusFilter]
}

const resolvePaging = (
  options: ListRunsOptions
): { readonly page: number; readonly pageSize: number | undefined } => {
  const page = options.page !== undefined && options.page >= 1 ? options.page : 1
  const pageSize =
    options.pageSize !== undefined && options.pageSize >= 1 ? options.pageSize : undefined
  return { page, pageSize }
}

const listAllRuns = async (
  options: ListRunsOptions
): Promise<{ readonly runs: ReadonlyArray<PersistedRun>; readonly total: number }> => {
  const filters = buildListFilters(options)
  const whereClause = filters.length === 0 ? undefined : and(...filters)

  const countQuery = db
    .select({ value: sql<number>`count(*)::int` })
    .from(automationRuns)
    .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
  const countRows = await (whereClause === undefined ? countQuery : countQuery.where(whereClause))
  const total = Number(countRows[0]?.value ?? 0)

  const baseQuery = db
    .select({
      run: automationRuns,
      definitionName: automationDefinitions.name,
    })
    .from(automationRuns)
    .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
  const filtered = whereClause === undefined ? baseQuery : baseQuery.where(whereClause)
  const ordered = filtered.orderBy(desc(automationRuns.createdAt))

  const { page, pageSize } = resolvePaging(options)
  const rows =
    pageSize !== undefined
      ? await ordered.limit(pageSize).offset((page - 1) * pageSize)
      : await ordered
  return {
    runs: rows.map((row) => toRun(row.run, row.definitionName)),
    total,
  }
}

export const AutomationRunRepositoryLive = Layer.succeed(AutomationRunRepository, {
  findById: (id) =>
    wrap(async () => {
      const rows = await db
        .select({
          run: automationRuns,
          definitionName: automationDefinitions.name,
        })
        .from(automationRuns)
        .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
        .where(eq(automationRuns.id, id))
        .limit(1)
      const head = rows[0]
      return head ? toRun(head.run, head.definitionName) : undefined
    }),

  listByAutomationName: (automationName) =>
    wrap(async () => {
      const rows = await db
        .select({
          run: automationRuns,
          definitionName: automationDefinitions.name,
        })
        .from(automationRuns)
        .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
        .where(eq(automationDefinitions.name, automationName))
        .orderBy(desc(automationRuns.createdAt))
      return rows.map((row) => toRun(row.run, row.definitionName))
    }),

  listAll: (options: ListRunsOptions) => wrap(async () => listAllRuns(options)),

  findStepsByRunId: (runId) =>
    wrap(async () => {
      const rows = await db
        .select()
        .from(automationRunSteps)
        .where(eq(automationRunSteps.runId, runId))
        .orderBy(automationRunSteps.stepIndex)
      return rows.map(toStep)
    }),

  create: (input) =>
    wrap(async () => {
      const [runRow] = await db
        .insert(automationRuns)
        .values({
          automationId: input.automationId,
          status: input.status,
          ...runInsertOptionals(input),
        })
        .returning()
      if (!runRow) {
        throw new Error('Failed to insert automation_run row')
      }

      const steps = input.steps ?? []
      if (steps.length > 0) {
        await db.insert(automationRunSteps).values(stepValues(runRow.id, steps))
      }

      const defRows = await db
        .select({ name: automationDefinitions.name })
        .from(automationDefinitions)
        .where(eq(automationDefinitions.id, input.automationId))
        .limit(1)
      const automationName = defRows[0]?.name ?? ''

      return toRun(runRow, automationName)
    }),

  updateStatus: (input) =>
    wrap(async () => {
      const [updated] = await db
        .update(automationRuns)
        .set({ status: input.status })
        .where(eq(automationRuns.id, input.id))
        .returning()
      if (!updated) return undefined
      const defRows = await db
        .select({ name: automationDefinitions.name })
        .from(automationDefinitions)
        .where(eq(automationDefinitions.id, updated.automationId))
        .limit(1)
      return toRun(updated, defRows[0]?.name ?? '')
    }),
})
