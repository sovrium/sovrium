/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, notInArray, or, sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AutomationRunOutcomeDatabaseError,
  AutomationRunOutcomeRepository,
} from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import {
  FINAL_FAILURE_RUN_STATUSES,
  INTERRUPTED_RUN_ERROR,
  STREAK_TERMINAL_RUN_STATUSES,
  type FinalFailure,
} from '@/domain/models/app/automations/automation-run-outcome-service'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  automationDefinitions as automationDefinitionsPg,
  automationDelayedSteps as automationDelayedStepsPg,
  automationRuns as automationRunsPg,
} from '@/infrastructure/database/drizzle/schema/automation'
import {
  automationDefinitions as automationDefinitionsSqlite,
  automationDelayedSteps as automationDelayedStepsSqlite,
  automationRuns as automationRunsSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/automation'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const automationDefinitions = resolveDialectSchema(
  automationDefinitionsPg,
  automationDefinitionsSqlite
)
const automationDelayedSteps = resolveDialectSchema(
  automationDelayedStepsPg,
  automationDelayedStepsSqlite
)
const automationRuns = resolveDialectSchema(automationRunsPg, automationRunsSqlite)

/** Wrap a DB promise, adapting failures to AutomationRunOutcomeDatabaseError. */
const wrap = makeDbWrap((cause) => new AutomationRunOutcomeDatabaseError({ cause }))

/** The statuses a previous server can leave behind that nothing will ever finish. */
const ORPHANABLE_STATUSES = ['running', 'queued']

/**
 * A run predates `instant` when it was TRIGGERED before it: `created_at` is the
 * trigger instant and never moves. Its start is deliberately not read — a run
 * this server created may carry an old `started_at` and is still this server's
 * to finish or to sweep as stuck, never an interruption.
 */
const predates = (instant: Readonly<Date>) => lt(automationRuns.createdAt, instant)

/**
 * The runs with a delayed step still `waiting`, which a restart must not close.
 * Inert today — nothing writes `automation_delayed_steps` — and kept for the
 * day delayed steps are resumed from the database (see the port).
 */
const resumableRunIds = () =>
  db
    .select({ runId: automationDelayedSteps.runId })
    .from(automationDelayedSteps)
    .where(eq(automationDelayedSteps.status, 'waiting'))

/** Started after `instant`, or never started and created after it. */
const startedAfterInstant = (instant: Readonly<Date>) =>
  or(
    gt(automationRuns.startedAt, instant),
    and(isNull(automationRuns.startedAt), gt(automationRuns.createdAt, instant))
  )

/** Close the orphaned rows and return their ids with their automation id. */
const closeOrphans = async (startedBefore: Readonly<Date>, error: string) => {
  const resumable = resumableRunIds()
  return (await db
    .update(automationRuns)
    .set({ status: 'failed', error, completedAt: new Date() })
    .where(
      and(
        inArray(automationRuns.status, ORPHANABLE_STATUSES),
        predates(startedBefore),
        notInArray(automationRuns.id, resumable)
      )
    )
    .returning({
      id: automationRuns.id,
      automationId: automationRuns.automationId,
    })) as ReadonlyArray<{ readonly id: string; readonly automationId: string }>
}

/** Name each closed run by its definition, in one read. */
const nameClosedRuns = async (
  closed: ReadonlyArray<{ readonly id: string; readonly automationId: string }>
) => {
  if (closed.length === 0) return []
  const definitions = await db
    .select({ id: automationDefinitions.id, name: automationDefinitions.name })
    .from(automationDefinitions)
    .where(
      inArray(
        automationDefinitions.id,
        closed.map((run) => run.automationId)
      )
    )
  const names = new Map(definitions.map((definition) => [definition.id, definition.name]))
  return closed.map((run) => ({ id: run.id, automationName: names.get(run.automationId) ?? '' }))
}

/** A run's start as a `Date`: `started_at`, or `created_at` when it was never stamped. */
const startOf = (row: {
  readonly startedAt: Date | null
  readonly createdAt: Date | null
}): Readonly<Date> | undefined =>
  row.startedAt instanceof Date
    ? row.startedAt
    : row.createdAt instanceof Date
      ? row.createdAt
      : undefined

/** Close one stuck run, unless it finished meanwhile; answers whether it was closed. */
const closeStuckRun = async (
  run: { readonly id: string; readonly start: Readonly<Date> },
  error: string,
  now: Readonly<Date>
): Promise<boolean> => {
  const closed = await db
    .update(automationRuns)
    .set({
      status: 'timed-out',
      error,
      completedAt: now as Date,
      durationMs: Math.max(0, now.getTime() - run.start.getTime()),
    })
    .where(and(eq(automationRuns.id, run.id), eq(automationRuns.status, 'running')))
    .returning({ id: automationRuns.id })
  return closed.length > 0
}

/** Find the `running` rows past their automation's cutoff, then close each one. */
const closeStuckRuns = async (input: {
  readonly cutoffs: ReadonlyArray<{
    readonly automationName: string
    readonly startedBefore: Readonly<Date>
  }>
  readonly defaultStartedBefore: Readonly<Date>
  readonly error: string
}) => {
  const rows = await db
    .select({
      id: automationRuns.id,
      automationName: automationDefinitions.name,
      startedAt: automationRuns.startedAt,
      createdAt: automationRuns.createdAt,
    })
    .from(automationRuns)
    .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
    .where(
      and(eq(automationRuns.status, 'running'), notInArray(automationRuns.id, resumableRunIds()))
    )
  const cutoffByName = new Map(
    input.cutoffs.map((cutoff) => [cutoff.automationName, cutoff.startedBefore.getTime()])
  )
  const stuck = rows.flatMap((row) => {
    const start = startOf(row)
    const cutoff = cutoffByName.get(row.automationName) ?? input.defaultStartedBefore.getTime()
    return start !== undefined && start.getTime() < cutoff
      ? [{ id: row.id, automationName: row.automationName, start }]
      : []
  })
  const now = new Date()
  // One row at a time: a sweep closes a handful of rows at most, and a serial
  // chain holds one pooled connection rather than one per stuck run.
  const closed = await stuck.reduce<Promise<ReadonlyArray<(typeof stuck)[number]>>>(
    async (previous, run) => {
      const done = await previous
      return (await closeStuckRun(run, input.error, now)) ? [...done, run] : done
    },
    Promise.resolve([])
  )
  return closed.map((run) => ({ id: run.id, automationName: run.automationName }))
}

/** Runs created in `[from, to)`. */
const createdBetween = (from: Readonly<Date>, to: Readonly<Date>) =>
  and(gte(automationRuns.createdAt, from as Date), lt(automationRuns.createdAt, to as Date))

/** `1` for each row matching `condition`, summed — portable across both engines. */
// drizzle's `SQL` is a class carrying its own methods; `Readonly<SQL>` drops them.
const countWhere = (condition: ReturnType<typeof and>) =>
  sql<unknown>`sum(case when ${condition} then 1 else 0 end)`

/** Group the window's runs by automation, in the database. */
const tallyRuns = async (from: Readonly<Date>, to: Readonly<Date>) => {
  const rows = await db
    .select({
      automationName: automationDefinitions.name,
      runs: sql<unknown>`count(*)`,
      failed: countWhere(inArray(automationRuns.status, [...FINAL_FAILURE_RUN_STATUSES])),
      timedOut: countWhere(eq(automationRuns.status, 'timed-out')),
      interrupted: countWhere(
        and(eq(automationRuns.status, 'failed'), eq(automationRuns.error, INTERRUPTED_RUN_ERROR))
      ),
    })
    .from(automationRuns)
    .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
    .where(createdBetween(from, to))
    .groupBy(automationDefinitions.name)
  // Counts reach JS as numbers on SQLite and as strings on PostgreSQL (`int8`),
  // so every one goes through the shared coercion.
  return rows.map((row) => ({
    automationName: row.automationName,
    runs: toFiniteCount(row.runs),
    failed: toFiniteCount(row.failed),
    timedOut: toFiniteCount(row.timedOut),
    interrupted: toFiniteCount(row.interrupted),
  }))
}

/**
 * Automation Run Outcome Repository Implementation (Drizzle).
 *
 * Every timestamp goes through the dialect's own column mapping, so the same
 * `Date` compares correctly against `timestamptz` on PostgreSQL and against
 * epoch milliseconds on SQLite.
 */
export const AutomationRunOutcomeRepositoryLive = Layer.succeed(AutomationRunOutcomeRepository, {
  failOrphanedRuns: ({ startedBefore, error }) =>
    wrap(async () => nameClosedRuns(await closeOrphans(startedBefore, error))),

  timeOutStuckRuns: (input) => wrap(() => closeStuckRuns(input)),

  listFinalFailures: ({ from, to, automationName }) =>
    wrap(async () => {
      const rows = await db
        .select({
          id: automationRuns.id,
          automationName: automationDefinitions.name,
          completedAt: automationRuns.completedAt,
          error: automationRuns.error,
        })
        .from(automationRuns)
        .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
        .where(
          and(
            inArray(automationRuns.status, [...FINAL_FAILURE_RUN_STATUSES]),
            gte(automationRuns.completedAt, from),
            lt(automationRuns.completedAt, to),
            ...(automationName === undefined
              ? []
              : [eq(automationDefinitions.name, automationName)])
          )
        )
        .orderBy(asc(automationRuns.completedAt))
      return rows.flatMap((row): readonly FinalFailure[] =>
        row.completedAt instanceof Date ? [{ ...row, completedAt: row.completedAt }] : []
      )
    }),

  findFirstCompletedAfter: ({ automationName, after }) =>
    wrap(async () => {
      const rows = await db
        .select({ completedAt: automationRuns.completedAt })
        .from(automationRuns)
        .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
        .where(
          and(
            eq(automationDefinitions.name, automationName),
            eq(automationRuns.status, 'completed'),
            gt(automationRuns.completedAt, after)
          )
        )
        .orderBy(asc(automationRuns.completedAt))
        .limit(1)
      const first = rows[0]?.completedAt
      return first instanceof Date ? first : undefined
    }),

  listRecentEndedStatuses: ({ automationName, limit, startedAfter }) =>
    wrap(async () => {
      const rows = await db
        .select({ status: automationRuns.status })
        .from(automationRuns)
        .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
        .where(
          and(
            eq(automationDefinitions.name, automationName),
            inArray(automationRuns.status, [...STREAK_TERMINAL_RUN_STATUSES]),
            ...(startedAfter === undefined ? [] : [startedAfterInstant(startedAfter)])
          )
        )
        // A run closed while still queued was never stamped: it sorts by when
        // it was created, like everywhere else a missing start is read.
        .orderBy(desc(sql`coalesce(${automationRuns.startedAt}, ${automationRuns.createdAt})`))
        .limit(limit)
      return rows.map((row) => row.status)
    }),

  countRunsByAutomationBetween: ({ from, to }) => wrap(() => tallyRuns(from, to)),

  findLastFailureError: ({ automationName, from, to }) =>
    wrap(async () => {
      const rows = await db
        .select({ error: automationRuns.error })
        .from(automationRuns)
        .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
        .where(
          and(
            eq(automationDefinitions.name, automationName),
            inArray(automationRuns.status, [...FINAL_FAILURE_RUN_STATUSES]),
            createdBetween(from, to)
          )
        )
        .orderBy(desc(automationRuns.createdAt))
        .limit(1)
      const error = rows[0]?.error
      return typeof error === 'string' && error !== '' ? error : undefined
    }),
})
