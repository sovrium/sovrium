/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A table's row-level read rule, as it applies to ONE reader — the question
 * every server-side read of rows asks before a row reaches a visitor.
 *
 * The records API answers it in SQL (`row-level-guard.ts`); a server-rendered
 * page and a hosted form read rows through other doors and answer it in memory,
 * against the rows they fetched. This is the in-memory answer, in one place, so
 * a list, a search, a select's options, a sidebar, a hosted form's choices and a
 * single record cannot each grow their own:
 *
 *  - `all`   — nothing to check: the table declares no read rule, or the reader
 *              is unrestricted (the records API lets an admin read every row);
 *  - `none`  — no row is admitted: an anonymous reader under a rule that names
 *              the signed-in person, which cannot be evaluated without one —
 *              the records API answers her the same, through the signed-out
 *              context (`signedOutContext`) in which no `$currentUser` value
 *              resolves and such a rule matches no row, in SQL and in memory;
 *  - `check` — evaluate each row, after loading the reader's assignments for
 *              the `scopeTables` the rule names (the caller loads them its own
 *              way: a Promise on a page, an Effect in a use-case).
 *
 * An anonymous reader is judged by the same rule as anyone else (a rule naming
 * no one — `status = published` — applies to her as written); only a rule that
 * names `$currentUser` refuses her outright.
 */

import { isAdminRole } from '@/domain/models/app/auth/permission-evaluation'
import {
  evaluateRecordAgainstPredicate,
  isPredicateGroup,
  rowRuleNamesCurrentUser,
  type CurrentUserContext,
} from './row-level-evaluator-service'
import { readStoredValues } from './stored-value-service'
import type { RowLevelWhen } from './permissions'

type RecordRow = Readonly<Record<string, unknown>>

/** Who reads: the signed-in person, or `undefined` for a visitor with no session. */
export interface RowRuleReader {
  readonly userId: string
  readonly role: string
  readonly email?: string | undefined
  readonly isUnrestricted?: boolean | undefined
}

/** The read rule of a table, as far as one reader is concerned. */
export type VisitorRowRule =
  | { readonly kind: 'all' }
  | { readonly kind: 'none' }
  | {
      readonly kind: 'check'
      /** The `$currentUser.assignments.<table>` scopes the rule reads. */
      readonly scopeTables: readonly string[]
      /** Is this row admitted, given the reader's assignments per scope table? */
      readonly admits: (
        record: RecordRow,
        assignments: ReadonlyMap<string, readonly string[]>
      ) => boolean
    }

/** The minimal table shape the rule is read from. */
export interface RowRuleTable {
  readonly rowLevelPermissions?:
    { readonly read?: { readonly when?: RowLevelWhen | undefined } | undefined } | undefined
  /** The declared fields — a boolean one is read as the records API reads it. */
  readonly fields?:
    ReadonlyArray<{ readonly name: string; readonly type?: string | undefined }> | undefined
}

/** Extract `tableSlug` from the typed `{ kind: 'currentUser', path: ... }` form. */
function scopeFromTypedValue(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const obj = value as {
    readonly kind?: string
    readonly path?: { readonly kind?: string; readonly tableSlug?: string }
  }
  if (obj.kind !== 'currentUser' || obj.path?.kind !== 'assignment') return undefined
  return typeof obj.path.tableSlug === 'string' ? obj.path.tableSlug : undefined
}

/** Extract `tableSlug` from the string-template form `$currentUser.assignments.<slug>`. */
function scopeFromTemplateValue(value: unknown): string | undefined {
  const prefix = '$currentUser.assignments.'
  if (typeof value !== 'string' || !value.startsWith(prefix)) return undefined
  const slug = value.slice(prefix.length)
  return slug.length > 0 ? slug : undefined
}

/**
 * The `$currentUser.assignments.<table>` scope tables a rule reads, in both the
 * typed and the string-template spelling, across every condition of a group.
 */
export function scopeTablesOfRule(predicate: RowLevelWhen): readonly string[] {
  if (isPredicateGroup(predicate)) return predicate.conditions.flatMap(scopeTablesOfRule)
  const scope = scopeFromTemplateValue(predicate.value) ?? scopeFromTypedValue(predicate.value)
  return scope === undefined ? [] : [scope]
}

/** The context a reader is evaluated against, her assignments loaded. */
function contextOf(
  reader: RowRuleReader | undefined,
  assignments: ReadonlyMap<string, readonly string[]>
): CurrentUserContext {
  return {
    userId: reader?.userId ?? '',
    email: reader?.email,
    role: reader?.role ?? '',
    isUnrestricted: reader?.isUnrestricted === true,
    assignments,
  }
}

/** The records API lets an admin, and an unrestricted account, read every row. */
const readsEveryRow = (reader: RowRuleReader | undefined): boolean =>
  reader !== undefined && (reader.isUnrestricted === true || isAdminRole(reader.role))

/** The read rule of `table` for `reader` — see the module header for the three answers. */
export function visitorRowRule(
  table: RowRuleTable | undefined,
  reader: RowRuleReader | undefined
): VisitorRowRule {
  const predicate = table?.rowLevelPermissions?.read?.when
  if (!predicate) return { kind: 'all' }
  if (readsEveryRow(reader)) return { kind: 'all' }
  if (reader === undefined && rowRuleNamesCurrentUser(predicate)) return { kind: 'none' }
  return {
    kind: 'check',
    scopeTables: reader === undefined ? [] : [...new Set(scopeTablesOfRule(predicate))],
    // Judged as the records API reads the row: a SQLite `1`/`0` boolean is
    // `true`/`false` before the rule sees it.
    admits: (record, assignments) =>
      evaluateRecordAgainstPredicate(
        readStoredValues(table, record),
        predicate,
        contextOf(reader, assignments)
      ),
  }
}

/** The page of rows a read asks for, and the columns it names. */
export interface RowWindow {
  /** Rows per page; absent keeps every row. */
  readonly pageSize?: number | undefined
  /** 1-based page; `1` when absent. */
  readonly page?: number | undefined
  /** The columns to keep; absent keeps every column. */
  readonly fields?: readonly string[] | undefined
}

/**
 * The admitted rows of a read judged in memory: the rows `verdicts` admits
 * (one verdict per row, in order), then the window's page of them, each
 * narrowed to the window's fields — with `total`, the count of ADMITTED rows
 * across every page, as the records API counts them. The rule reads columns a
 * read need not name, so a read judged here fetches whole rows and narrows them
 * only after the rule has been asked.
 */
export function admittedWindow(
  rows: readonly RecordRow[],
  verdicts: readonly boolean[],
  window: RowWindow
): { readonly rows: readonly RecordRow[]; readonly total: number } {
  const admitted = rows.filter((_, index) => verdicts[index] === true)
  const start = ((window.page ?? 1) - 1) * (window.pageSize ?? 0)
  const page =
    window.pageSize === undefined ? admitted : admitted.slice(start, start + window.pageSize)
  const { fields } = window
  const narrowed =
    fields === undefined
      ? page
      : page.map((row) =>
          Object.fromEntries(Object.entries(row).filter(([k]) => fields.includes(k)))
        )
  return { rows: narrowed, total: admitted.length }
}
