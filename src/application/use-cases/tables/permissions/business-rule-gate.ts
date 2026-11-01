/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE door a record write passes for the table's business rules
 * (`tables[].rules`): every write orchestration — single create, update,
 * delete and restore, batch create, update, delete and restore, upsert — calls it after the
 * caller's permissions were judged and before it writes, so a rule binds
 * every road that converges there: the records API, the native and bulk
 * forms, the CSV import, the MCP tools, the AI chat and the automations.
 *
 * It judges the whole write at once and fails once, listing every rule every
 * row broke: a bulk write is refused whole, nothing written.
 *
 * An update, a delete or a restore is judged twice on the same rules: once on the row as
 * the door read it, for an early answer, and once more INSIDE the write's own
 * transaction, on the row as it stands when the write lands
 * ({@link prepareRuleJudge}). That second judgement is the one that binds: of
 * two writes racing on one record, the second is judged on what the first left.
 *
 * A rule describes data, not the caller (a `$currentUser` value is refused in
 * its config), so it is judged with a bare context — no account lookup. A rule
 * reading another record has its lookup leaves loaded first, once per write.
 *
 * `sovrium seed` writes BELOW this door (it calls the write programs
 * directly), and is the only writer the rules do not bind.
 */

import { Effect } from 'effect'
import { BusinessRuleViolationError, type BusinessRuleViolation } from '@/domain/errors'
import { defaultLanguageTranslator } from '@/domain/models/app/languages/translation-resolver'
import {
  bareRuleContext,
  ruleViolations,
  ruleWhensOf,
  rulesNeedLookups,
  rulesOf,
} from '@/domain/models/app/tables/business-rule-service'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import { findTableByName } from '@/domain/models/app/tables/table-lookup-service'
import { rowRuleScopeOf, withWhenMatches } from './row-rule-chain-matches'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type {
  InTransactionRuleJudge,
  JudgedRows,
} from '@/application/ports/repositories/tables/in-transaction-rule-judge'
import type { App } from '@/domain/models/app'

type StoredRow = Readonly<Record<string, unknown>>

/**
 * One row of a write, as the rules judge it. A `restore` is judged as an
 * update that changes no field, on the trashed row as it will stand restored
 * (`rowAsRestored`, `business-rule-service.ts`).
 */
export interface RuleWrite {
  readonly op: 'create' | 'update' | 'delete' | 'restore'
  /** The row as it stands; a write to a row that could not be read is left to the write. */
  readonly existing?: StoredRow
  /** The fields the write sends (none for a delete). */
  readonly change: StoredRow
  /** Position of the row in a bulk write, reported with its violations. */
  readonly index?: number
  /** Id of the row in a bulk write, reported with its violations. */
  readonly recordId?: string
}

/** A write to judge: the table, the writer, and each row. */
export interface BusinessRuleGateInput {
  readonly app: App
  readonly tableName: string
  /** Who writes: the creator a created row is stamped with. */
  readonly userId: string
  /**
   * The writer's role, read against `exemptRoles` and, with `userGroups`, to
   * keep a refusal from naming a field she may not read; absent for a write no
   * person made.
   */
  readonly userRole?: string
  readonly userGroups?: readonly string[]
  readonly writes: readonly RuleWrite[]
}

/**
 * A rule's message as its reader is told it: a `$t:` key translated in the
 * app's default language (`sovrium validate` refuses one missing a language),
 * as every other `$t:` text of a surface addressed to no reader in particular.
 */
export const ruleMessageText = (app: App, message: string): string =>
  defaultLanguageTranslator(app.languages)(message)

/**
 * A violation as its writer is told it: without `field` when she may not read
 * that field, as the `_locks` block never names one. A write no person made
 * keeps it.
 */
const toldTo = (input: Omit<BusinessRuleGateInput, 'writes'>) => {
  if (input.userRole === undefined) return (violation: BusinessRuleViolation) => violation
  const caller = { role: input.userRole, groups: [...(input.userGroups ?? [])] }
  return (violation: BusinessRuleViolation): BusinessRuleViolation => {
    if (violation.field === undefined) return violation
    if (isFieldReadableByCaller(input.app, input.tableName, caller, violation.field)) {
      return violation
    }
    const { field: _hidden, ...rest } = violation
    return rest
  }
}

/** The table and the writer a judgement is made for: everything but the rows. */
export type RuleJudgeScope = Omit<BusinessRuleGateInput, 'writes'>

/** Every rule every row of `writes` breaks, as its writer is told it; `undefined` when none. */
const refusalOf = (
  input: RuleJudgeScope,
  ctx: Parameters<typeof ruleViolations>[3]['ctx'],
  writes: readonly RuleWrite[]
): Readonly<BusinessRuleViolationError> | undefined => {
  const { app, tableName } = input
  const writer = { role: input.userRole }
  const told = toldTo(input)
  const violations: readonly BusinessRuleViolation[] = writes.flatMap((write) => {
    if (write.op !== 'create' && write.existing === undefined) return []
    const judged = ruleViolations(app, tableName, writer, {
      op: write.op,
      existing: write.existing ?? {},
      change: write.change,
      ctx,
    })
    return judged.map(told).map((violation) => ({
      ...violation,
      message: ruleMessageText(app, violation.message),
      ...(write.index === undefined ? {} : { index: write.index }),
      ...(write.recordId === undefined ? {} : { recordId: write.recordId }),
    }))
  })
  return violations.length > 0 ? new BusinessRuleViolationError(tableName, violations) : undefined
}

/**
 * The table's rules, ready to judge a write on the rows it changes — the
 * judgement a repository runs INSIDE the write's transaction, on the rows as
 * that transaction reads them ({@link InTransactionRuleJudge}). `writesOf`
 * turns those rows into the writes to judge. The records a lookup leaf reads
 * are read here, once, so the judgement itself reads nothing. `undefined` for
 * a table without rules: nothing to judge, no lock to take.
 */
export const prepareRuleJudge = (
  input: RuleJudgeScope,
  writesOf: (rows: JudgedRows) => readonly RuleWrite[]
): Effect.Effect<InTransactionRuleJudge | undefined, never, DataSourceRepository> => {
  const { app, tableName } = input
  const table = findTableByName(app.tables, tableName)
  if (rulesOf(table).length === 0) return Effect.undefined
  return Effect.gen(function* () {
    const bare = bareRuleContext(input.userId, input.userRole)
    const ctx = rulesNeedLookups(table)
      ? yield* withWhenMatches(bare, ruleWhensOf(table), rowRuleScopeOf(table, app.tables))
      : bare
    return (rows: JudgedRows) => refusalOf(input, ctx, writesOf(rows))
  }).pipe(Effect.withSpan('tables.prepare-rule-judge', { attributes: { tableName } }))
}

/** Fail with the judge's refusal of `rows`, if it refuses them. */
export const refuseUnderRules = (
  judge: InTransactionRuleJudge | undefined,
  rows: JudgedRows
): Effect.Effect<void, BusinessRuleViolationError> => {
  const refusal = judge?.(rows)
  return (refusal === undefined ? Effect.void : Effect.fail(refusal)).pipe(
    Effect.withSpan('tables.refuse-under-rules')
  )
}

/** One row as a judge reads it: keyed by its id, absent when there is none. */
export const judgedRowsOf = (recordId: string, row: StoredRow | null | undefined): JudgedRows =>
  new Map(row === undefined || row === null ? [] : [[recordId, row]])

/**
 * The rules' step of a one-record write that sends no field — a delete or a
 * restore: the table's rules prepared, judged once on the row `readRow`
 * answers (the early answer), and handed on for the write to judge again
 * inside its transaction. A row `readRow` does not find is left to the write,
 * which answers it. `readRow` runs only for a table with rules.
 */
export const prepareRowOpRuleJudge = <E, R>(
  scope: RuleJudgeScope,
  write: { readonly op: 'delete' | 'restore'; readonly recordId: string },
  readRow: Effect.Effect<StoredRow | null | undefined, E, R>
): Effect.Effect<
  InTransactionRuleJudge | undefined,
  E | BusinessRuleViolationError,
  R | DataSourceRepository
> =>
  prepareRuleJudge(scope, (rows) => {
    const existing = rows.get(write.recordId)
    return existing === undefined ? [] : [{ op: write.op, existing, change: {} }]
  }).pipe(
    Effect.flatMap((judge) =>
      judge === undefined
        ? Effect.undefined
        : readRow.pipe(
            Effect.flatMap((row) => refuseUnderRules(judge, judgedRowsOf(write.recordId, row))),
            Effect.as(judge)
          )
    ),
    Effect.withSpan('tables.prepare-row-op-rule-judge', {
      attributes: { tableName: scope.tableName, op: write.op },
    })
  )

/**
 * Refuse the write when one of its rows breaks one of the table's rules, with
 * {@link BusinessRuleViolationError} listing every violation. Free for a table
 * without rules.
 */
export const authorizeBusinessRules = (
  input: BusinessRuleGateInput
): Effect.Effect<void, BusinessRuleViolationError, DataSourceRepository> => {
  if (input.writes.length === 0) return Effect.void
  return prepareRuleJudge(input, () => input.writes).pipe(
    Effect.flatMap((judge) => refuseUnderRules(judge, new Map())),
    Effect.withSpan('tables.authorize-business-rules', {
      attributes: { tableName: input.tableName },
    })
  )
}
