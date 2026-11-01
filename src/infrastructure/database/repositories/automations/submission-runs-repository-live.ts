/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, count, desc, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import {
  SubmissionRunsDatabaseError,
  SubmissionRunsRepository,
  type SubmissionRunCount,
  type SubmissionRunRow,
  type SubmissionRunsFilter,
} from '@/application/ports/repositories/automations/submission-runs-repository'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { layerOverDatabase, type Dialect } from '@/infrastructure/database/drizzle/layer'
import {
  automationDefinitions as automationDefinitionsPg,
  automationRuns as automationRunsPg,
} from '@/infrastructure/database/drizzle/schema/automation'
import {
  automationDefinitions as automationDefinitionsSqlite,
  automationRuns as automationRunsSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/automation'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import type { RecordTriggerSource } from '@/domain/models/app/automations/trigger-entries-service'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'

const automationRuns = resolveDialectSchema(automationRunsPg, automationRunsSqlite)
const automationDefinitions = resolveDialectSchema(
  automationDefinitionsPg,
  automationDefinitionsSqlite
)

const wrap = makeDbWrap((cause) => new SubmissionRunsDatabaseError({ cause }))

/**
 * The submission a `form` trigger's run carries (`submissionId`), and the
 * record a `record` trigger's run carries (`record.id`), as text on both
 * engines: a record id stored as a JSON number reads as its digits.
 */
const submissionIdOfRun = (dialect: Dialect): SQL<string | null> =>
  dialect.kind === 'sqlite'
    ? sql`CAST(json_extract(${automationRuns.triggerData}, '$.submissionId') AS TEXT)`
    : sql`(${automationRuns.triggerData} ->> 'submissionId')`

const recordIdOfRun = (dialect: Dialect): SQL<string | null> =>
  dialect.kind === 'sqlite'
    ? sql`CAST(json_extract(${automationRuns.triggerData}, '$.record.id') AS TEXT)`
    : sql`(${automationRuns.triggerData} -> 'record' ->> 'id')`

/** The form half: these automations' runs carrying one of these submissions. */
const formHalf = (
  dialect: Dialect,
  automations: readonly string[],
  ids: readonly string[]
): SQL | undefined =>
  automations.length === 0 || ids.length === 0
    ? undefined
    : and(
        inArray(automationDefinitions.name, [...automations]),
        inArray(submissionIdOfRun(dialect), [...ids])
      )

/**
 * The runs one record-trigger source started: its automation, narrowed to the
 * entries on the `submitTo` table by the trigger name each run records (and to
 * the unnamed runs of old, when its first entry is one of them).
 */
const fromRecordSource = (source: RecordTriggerSource): SQL | undefined =>
  and(
    eq(automationDefinitions.name, source.automationName),
    or(
      source.triggerNames.length === 0
        ? undefined
        : inArray(automationRuns.triggerName, [...source.triggerNames]),
      source.orUnrecorded ? isNull(automationRuns.triggerName) : undefined
    ) ?? sql`1 = 0`
  )

/** The record half: these trigger entries' runs carrying one of these records. */
const recordHalf = (
  dialect: Dialect,
  sources: readonly RecordTriggerSource[],
  ids: readonly string[]
): SQL | undefined =>
  sources.length === 0 || ids.length === 0
    ? undefined
    : and(or(...sources.map(fromRecordSource)), inArray(recordIdOfRun(dialect), [...ids]))

/**
 * The runs some submissions started, as one predicate over runs ⋈ definitions.
 * Every value is bound as a parameter; a filter with nothing to match matches
 * no run rather than every run.
 */
export const submissionRunsCondition = (filter: SubmissionRunsFilter, dialect: Dialect): SQL =>
  or(
    formHalf(dialect, filter.formAutomations, filter.submissionIds),
    recordHalf(dialect, filter.recordAutomations, filter.recordIds)
  ) ?? sql`1 = 0`

/** The run-history narrowing to some submissions' runs, or none when the read asked for none. */
export const submissionRunsConditions = (
  filter: SubmissionRunsFilter | undefined,
  dialect: Dialect
): ReadonlyArray<SQL> => (filter === undefined ? [] : [submissionRunsCondition(filter, dialect)])

/** The matched runs, newest first, each with the submission or record it carries. */
const listRunsImpl = async (
  db: PortableDb,
  dialect: Dialect,
  filter: SubmissionRunsFilter
): Promise<readonly SubmissionRunRow[]> =>
  (await db
    .select({
      id: automationRuns.id,
      automationName: automationDefinitions.name,
      status: automationRuns.status,
      createdAt: automationRuns.createdAt,
      submissionId: submissionIdOfRun(dialect),
      recordId: recordIdOfRun(dialect),
    })
    .from(automationRuns)
    .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
    .where(submissionRunsCondition(filter, dialect))
    .orderBy(
      desc(automationRuns.createdAt),
      desc(automationRuns.id)
    )) as readonly SubmissionRunRow[]

/** The matched runs counted per carried submission and record, in one grouped read. */
const countRunsImpl = async (
  db: PortableDb,
  dialect: Dialect,
  filter: SubmissionRunsFilter
): Promise<readonly SubmissionRunCount[]> => {
  const submissionId = submissionIdOfRun(dialect)
  const recordId = recordIdOfRun(dialect)
  const rows = await db
    .select({ submissionId, recordId, runs: count() })
    .from(automationRuns)
    .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
    .where(submissionRunsCondition(filter, dialect))
    .groupBy(submissionId, recordId)
  return rows.map((row) => ({
    submissionId: row.submissionId,
    recordId: row.recordId,
    runs: toFiniteCount(row.runs),
  }))
}

/** Submission Runs Repository Implementation (Drizzle), over `automation_runs`. */
export const SubmissionRunsRepositoryLive = layerOverDatabase(SubmissionRunsRepository, {
  listRuns: (db, dialect) => (filter) => wrap(async () => listRunsImpl(db, dialect, filter)),
  countRuns: (db, dialect) => (filter) => wrap(async () => countRunsImpl(db, dialect, filter)),
})
