/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq, sql, type SQL } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
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

/**
 * Convert nullable Date to ISO 8601 string (or null) for the API contract.
 *
 * The `PersistedRun.startedAt` (and related) fields are intentionally
 * `string | null` because the public Run schema (Zod runSchema) uses
 * `.nullable()` for these timestamps — they are never `undefined`, only
 * present-or-null.
 */
const toIso = (
  value: Readonly<Date> | null | undefined
  // eslint-disable-next-line unicorn/no-null -- API contract uses null for missing timestamps
): string | null => (value instanceof Date ? value.toISOString() : null)

/**
 * Map a raw Drizzle row to the public `PersistedRun` shape, joining the
 * definition name. Pre-joined inputs avoid N+1 lookups.
 */
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

/**
 * Build the optional-column overlay for a run insert. Pulled out so the
 * `create` callback stays under the complexity threshold — every conditional
 * spread on the literal counted toward `create`'s cyclomatic complexity.
 */
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

/**
 * Build the SQL filter list for {@link listAllRuns}. Spreads optional
 * conditions immutably so the result is a frozen ReadonlyArray<SQL>.
 */
const buildListFilters = (options: ListRunsOptions): ReadonlyArray<SQL> => {
  const nameFilter: ReadonlyArray<SQL> =
    options.automationName !== undefined
      ? [eq(automationDefinitions.name, options.automationName)]
      : []
  const statusFilter: ReadonlyArray<SQL> =
    options.status !== undefined ? [eq(automationRuns.status, options.status)] : []
  return [...nameFilter, ...statusFilter]
}

/**
 * Resolve `(page, pageSize)` defaults from raw options. Returns `pageSize`
 * undefined when the caller didn't ask to paginate.
 */
const resolvePaging = (
  options: ListRunsOptions
): { readonly page: number; readonly pageSize: number | undefined } => {
  const page = options.page !== undefined && options.page >= 1 ? options.page : 1
  const pageSize =
    options.pageSize !== undefined && options.pageSize >= 1 ? options.pageSize : undefined
  return { page, pageSize }
}

/**
 * Drizzle implementation for {@link AutomationRunRepository.listAll}. Pulled
 * out of the `Effect.tryPromise` callback so the latter stays under the
 * complexity cap.
 */
const listAllRuns = async (
  options: ListRunsOptions
): Promise<{ readonly runs: ReadonlyArray<PersistedRun>; readonly total: number }> => {
  const filters = buildListFilters(options)
  const whereClause = filters.length === 0 ? undefined : and(...filters)

  // Count first (matching the filters), then page.
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

/**
 * Automation Run Repository Implementation (Drizzle).
 *
 * Backs `system.automation_runs` and `system.automation_run_steps` — the
 * execution-history tables read by the Runs API. The engine calls
 * `create()` after a run completes; readers (`listByAutomationName`,
 * `findById`, `findStepsByRunId`) JOIN definitions by `automation_id` so
 * callers can filter by user-facing name.
 */
export const AutomationRunRepositoryLive = Layer.succeed(AutomationRunRepository, {
  findById: (id) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select({
            run: automationRuns,
            definitionName: automationDefinitions.name,
          })
          .from(automationRuns)
          .innerJoin(
            automationDefinitions,
            eq(automationDefinitions.id, automationRuns.automationId)
          )
          .where(eq(automationRuns.id, id))
          .limit(1)
        const head = rows[0]
        return head ? toRun(head.run, head.definitionName) : undefined
      },
      catch: (cause) => new AutomationRunDatabaseError({ cause }),
    }),

  listByAutomationName: (automationName) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select({
            run: automationRuns,
            definitionName: automationDefinitions.name,
          })
          .from(automationRuns)
          .innerJoin(
            automationDefinitions,
            eq(automationDefinitions.id, automationRuns.automationId)
          )
          .where(eq(automationDefinitions.name, automationName))
          .orderBy(desc(automationRuns.createdAt))
        return rows.map((row) => toRun(row.run, row.definitionName))
      },
      catch: (cause) => new AutomationRunDatabaseError({ cause }),
    }),

  listAll: (options: ListRunsOptions) =>
    Effect.tryPromise({
      try: async () => listAllRuns(options),
      catch: (cause) => new AutomationRunDatabaseError({ cause }),
    }),

  findStepsByRunId: (runId) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select()
          .from(automationRunSteps)
          .where(eq(automationRunSteps.runId, runId))
          .orderBy(automationRunSteps.stepIndex)
        return rows.map(toStep)
      },
      catch: (cause) => new AutomationRunDatabaseError({ cause }),
    }),

  create: (input) =>
    Effect.tryPromise({
      try: async () => {
        const [runRow] = await db
          .insert(automationRuns)
          .values({
            automationId: input.automationId,
            status: input.status,
            ...runInsertOptionals(input),
          })
          .returning()
        if (!runRow) {
          // eslint-disable-next-line functional/no-throw-statements -- Effect.tryPromise's catch wrapper requires throw to map to AutomationRunDatabaseError
          throw new Error('Failed to insert automation_run row')
        }

        const steps = input.steps ?? []
        if (steps.length > 0) {
          // eslint-disable-next-line functional/no-expression-statements
          await db.insert(automationRunSteps).values(stepValues(runRow.id, steps))
        }

        // Look up the definition name so the returned shape includes it.
        // The same query path the readers use, no caching needed at this layer.
        const defRows = await db
          .select({ name: automationDefinitions.name })
          .from(automationDefinitions)
          .where(eq(automationDefinitions.id, input.automationId))
          .limit(1)
        const automationName = defRows[0]?.name ?? ''

        return toRun(runRow, automationName)
      },
      catch: (cause) => new AutomationRunDatabaseError({ cause }),
    }),

  updateStatus: (input) =>
    Effect.tryPromise({
      try: async () => {
        // Plain UPDATE; no CHECK constraint on the status column (status
        // is `text`) so 'cancelled' is accepted alongside the engine-set
        // values ('completed', 'failed', 'timed-out', etc.).
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
      },
      catch: (cause) => new AutomationRunDatabaseError({ cause }),
    }),
})
