/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AutomationRunDatabaseError,
  AutomationRunRepository,
  type CreateRunInput,
  type CreateStepInput,
  type ListRunsOptions,
  type PersistedRun,
  type PersistedStep,
  type RunReaderScope,
  type RunRecordRef,
} from '@/application/ports/repositories/automations/automation-run-repository'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import { db } from '@/infrastructure/database'
import * as park from '@/infrastructure/database/automation-run-park'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  automationDefinitions as automationDefinitionsPg,
  automationRunRefs as automationRunRefsPg,
  automationRuns as automationRunsPg,
  automationRunSteps as automationRunStepsPg,
} from '@/infrastructure/database/drizzle/schema/automation'
import {
  automationDefinitions as automationDefinitionsSqlite,
  automationRunRefs as automationRunRefsSqlite,
  automationRuns as automationRunsSqlite,
  automationRunSteps as automationRunStepsSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/automation'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { castToInt } from '@/infrastructure/database/table-queries/query-helpers/aggregation-helpers'

const automationDefinitions = resolveDialectSchema(
  automationDefinitionsPg,
  automationDefinitionsSqlite
)
const automationRuns = resolveDialectSchema(automationRunsPg, automationRunsSqlite)
const automationRunSteps = resolveDialectSchema(automationRunStepsPg, automationRunStepsSqlite)
const automationRunRefs = resolveDialectSchema(automationRunRefsPg, automationRunRefsSqlite)

/** Wrap a DB promise, adapting failures to AutomationRunDatabaseError. */
const wrap = makeDbWrap((cause) => new AutomationRunDatabaseError({ cause }))

/** A nullable Date as ISO 8601 (or null): the run timestamps are present-or-null, never absent. */
const toIso = (value: Readonly<Date> | null | undefined): string | null =>
  value instanceof Date ? value.toISOString() : null

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
  triggeredByUserId: runRow.triggeredByUserId,
  startedByHand: runRow.startedByHand,
  relay: runRow.relay,
  valuesErasedAt: toIso(runRow.valuesErasedAt),
  resumeAt: toIso(runRow.resumeAt),
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
  logs: row.logs,
  reads: row.reads,
  nested: row.nested,
})

/** The optional-column overlay for a run insert, out of `create` for its complexity. */
const runInsertOptionals = (input: Readonly<CreateRunInput>) => ({
  ...(input.triggerData !== undefined ? { triggerData: input.triggerData as object } : {}),
  ...(input.triggeredByUserId !== undefined ? { triggeredByUserId: input.triggeredByUserId } : {}),
  ...(input.startedByHand === true ? { startedByHand: true } : {}),
  ...(input.relay !== undefined ? { relay: input.relay as object } : {}),
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
    ...(step.logs !== undefined ? { logs: step.logs as object } : {}),
    ...(step.reads !== undefined ? { reads: step.reads as object } : {}),
    ...(step.nested !== undefined ? { nested: step.nested as object } : {}),
  }))

/**
 * Index the records a run read (`system.automation_run_refs`), its own and
 * those the runs its synchronous calls started read. A ref already there is
 * kept as it is, so a run finalised twice indexes nothing twice.
 */
const insertRunRefs = async (
  runId: string,
  input: {
    readonly refs?: readonly RunRecordRef[]
    readonly refsFromRuns?: readonly string[]
  }
): Promise<void> => {
  const own = (input.refs ?? []).map((ref) => ({
    runId,
    tableName: ref.table,
    recordId: ref.record,
  }))
  const inherited =
    input.refsFromRuns === undefined || input.refsFromRuns.length === 0
      ? []
      : await db
          .select({ tableName: automationRunRefs.tableName, recordId: automationRunRefs.recordId })
          .from(automationRunRefs)
          .where(inArray(automationRunRefs.runId, [...input.refsFromRuns]))
  const rows = [
    ...own,
    ...inherited
      .filter((ref) => ref.tableName !== '')
      .map((ref) => ({ runId, tableName: ref.tableName, recordId: ref.recordId })),
  ]
  if (rows.length === 0) return
  await db.insert(automationRunRefs).values(rows).onConflictDoNothing()
}

/**
 * The runs a scoped caller may read: those they started by hand, and the runs
 * a request names them an approver of. In the WHERE clause, so a count over
 * the same filters counts only these.
 */
const readableByFilters = (readableBy: RunReaderScope | undefined): ReadonlyArray<SQL> =>
  readableBy === undefined
    ? []
    : [
        or(
          and(
            eq(automationRuns.startedByHand, true),
            eq(automationRuns.triggeredByUserId, readableBy.userId)
          ),
          ...(readableBy.runIds.length === 0
            ? []
            : [inArray(automationRuns.id, [...readableBy.runIds])])
        ) as SQL,
      ]

/** Build the SQL filter list for {@link listAllRuns}. */
const buildListFilters = (options: ListRunsOptions): ReadonlyArray<SQL> => {
  const nameFilter: ReadonlyArray<SQL> =
    options.automationName !== undefined
      ? [eq(automationDefinitions.name, options.automationName)]
      : []
  const statusFilter: ReadonlyArray<SQL> =
    options.status !== undefined ? [eq(automationRuns.status, options.status)] : []
  return [...nameFilter, ...statusFilter, ...readableByFilters(options.readableBy)]
}

/** `(page, pageSize)` defaults; `pageSize` undefined when the caller did not paginate. */
const resolvePaging = (
  options: ListRunsOptions
): { readonly page: number; readonly pageSize: number | undefined } => {
  const page = options.page !== undefined && options.page >= 1 ? options.page : 1
  const pageSize =
    options.pageSize !== undefined && options.pageSize >= 1 ? options.pageSize : undefined
  return { page, pageSize }
}

/** Drizzle implementation for {@link AutomationRunRepository.listAll}. */
const listAllRuns = async (
  options: ListRunsOptions
): Promise<{ readonly runs: ReadonlyArray<PersistedRun>; readonly total: number }> => {
  const filters = buildListFilters(options)
  const whereClause = filters.length === 0 ? undefined : and(...filters)

  // Count first (matching the filters), then page.
  const countQuery = db
    .select({ value: castToInt(sql`COUNT(*)`) })
    .from(automationRuns)
    .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
  const countRows = await (whereClause === undefined ? countQuery : countQuery.where(whereClause))
  const total = toFiniteCount(countRows[0]?.value)

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
/** The run row's columns a finalisation writes: status, timings, error, and the park or its clearing. */
const finalisedColumns = (
  input: Parameters<(typeof AutomationRunRepository.Service)['finaliseRun']>[0]
): Readonly<Record<string, unknown>> => ({
  status: input.status,
  // Parking sets when and where the run resumes; any other finalisation clears both.
  resumeAt: input.park?.resumeAt ?? null,
  resumeCursor: input.park?.cursor ?? null,
  ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
  ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
  ...(input.error !== undefined ? { error: input.error } : {}),
})

const findRunById = async (id: string): Promise<PersistedRun | undefined> => {
  const rows = await db
    .select({ run: automationRuns, definitionName: automationDefinitions.name })
    .from(automationRuns)
    .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
    .where(eq(automationRuns.id, id))
    .limit(1)
  const head = rows[0]
  return head ? toRun(head.run, head.definitionName) : undefined
}

export const AutomationRunRepositoryLive = Layer.succeed(AutomationRunRepository, {
  findById: (id) => wrap(() => findRunById(id)),

  listByAutomationName: (automationName, readableBy) =>
    wrap(async () => {
      const rows = await db
        .select({
          run: automationRuns,
          definitionName: automationDefinitions.name,
        })
        .from(automationRuns)
        .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
        .where(
          and(eq(automationDefinitions.name, automationName), ...readableByFilters(readableBy))
        )
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
      await insertRunRefs(runRow.id, input)

      // The definition name, so the returned shape includes it.
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
      // Plain UPDATE: `status` is `text` with no CHECK, so any engine label is accepted.
      const [updated] = await db
        .update(automationRuns)
        .set({
          status: input.status,
          ...(input.startedAt !== undefined ? { startedAt: input.startedAt } : {}),
        })
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

  recordStepOutput: ({ runId, stepIndex, output }) =>
    wrap(async () => {
      const updated = await db
        .update(automationRunSteps)
        .set({ output: output as object })
        .where(
          and(eq(automationRunSteps.runId, runId), eq(automationRunSteps.stepIndex, stepIndex))
        )
        .returning({ id: automationRunSteps.id })
      return updated.length > 0
    }),

  finaliseRun: (input) =>
    wrap(async () => {
      const [updated] = await db
        .update(automationRuns)
        .set(finalisedColumns(input))
        .where(eq(automationRuns.id, input.id))
        .returning()
      if (!updated) return undefined

      // Append step rows: they land with the terminal status, never earlier.
      const steps = input.steps ?? []
      if (steps.length > 0) {
        await db.insert(automationRunSteps).values(stepValues(updated.id, steps))
      }
      await insertRunRefs(updated.id, input)

      const defRows = await db
        .select({ name: automationDefinitions.name })
        .from(automationDefinitions)
        .where(eq(automationDefinitions.id, updated.automationId))
        .limit(1)
      return toRun(updated, defRows[0]?.name ?? '')
    }),

  hasWaitingDelayRuns: wrap(park.hasWaitingDelayRuns),
  listDueDelayedRuns: (input) => wrap(() => park.listDueDelayedRuns(input)),
  claimDelayedRun: (input) =>
    wrap(async () => {
      const claimed = await park.claimDelayedRun(input)
      const run = claimed === undefined ? undefined : await findRunById(input.id)
      return run === undefined ? undefined : { run, cursor: claimed?.cursor }
    }),
  cancelWaitingRun: (input) => wrap(() => park.cancelWaitingRun(input)),
  updateStep: (input) => wrap(() => park.updateRunStep(input)),
})
