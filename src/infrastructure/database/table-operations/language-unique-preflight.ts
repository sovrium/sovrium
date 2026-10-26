/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The duplicate pre-flight of a translatable unique field ([internal ref] A1.5), the
 * per-language half of `unique-constraint-drift.ts`.
 *
 * Before a per-language unique index is built over rows that exist — `unique`
 * added to a translatable field, a language added or declared again — the live
 * rows are probed for a value two of them share in that language. A field whose
 * `translatable` is turned off while it stays unique is probed on the value
 * each map collapses to. Either is refused naming each shared value, its
 * language and the ids holding it, before any DDL; `allowDestructive` does not
 * lift it, since it authorises losing languages, not breaking uniqueness.
 *
 * Only a column that holds maps today is probed: wrapping plain values as
 * `{ "<default>": value }` cannot make two records equal in one language.
 */

import { Effect } from 'effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { executeSQL, type SQLExecutionError, type TransactionLike } from '../sql/sql-execution'
import {
  formatLanguageDuplicateRefusal,
  languageValueExpression,
  sharedValuesOf,
  sharedValuesQuery,
  type DeclaredLanguageIndex,
} from '../sql/sql-language-unique-indexes'
import { collapsedValueDdl, sqliteMapColumns } from '../sql/sql-translatable-columns'
import type { Table } from '@/domain/models/app/tables'

/**
 * The columns of `relation` holding maps today: `jsonb` on PostgreSQL, a
 * `json_valid` CHECK in SQLite's stored definition.
 */
export const liveMapColumns = (
  tx: TransactionLike,
  relation: string,
  existingColumns: ReadonlyMap<string, unknown>
): Effect.Effect<ReadonlySet<string>, SQLExecutionError> =>
  isSqliteRuntime()
    ? executeSQL(tx, `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = $1`, [
        relation,
      ]).pipe(
        Effect.map((rows) => {
          const createSql = (rows[0] as { readonly sql?: unknown } | undefined)?.sql
          return sqliteMapColumns(typeof createSql === 'string' ? createSql : '')
        })
      )
    : Effect.succeed(
        new Set(
          [...existingColumns.entries()]
            .filter(
              ([, column]) =>
                String((column as { readonly dataType?: unknown }).dataType).toLowerCase() ===
                'jsonb'
            )
            .map(([name]) => name)
        )
      )

/** The refusal of one probe, or none when no value is shared. */
const probe = (
  tx: TransactionLike,
  relation: string,
  expression: string,
  refusal: (values: ReturnType<typeof sharedValuesOf>) => string
): Effect.Effect<readonly string[], SQLExecutionError> =>
  executeSQL(tx, sharedValuesQuery(relation, expression)).pipe(
    Effect.map((rows) => {
      const values = sharedValuesOf(rows)
      return values.length === 0 ? [] : [refusal(values)]
    })
  )

/**
 * The refusals of the per-language indexes `missing` would build over the live
 * rows of `relation`, and of the unique fields in `collapsing` whose maps would
 * collapse to a shared value. Read-only: `SELECT`s only.
 */
export const languageUniqueRefusals = (params: {
  readonly tx: TransactionLike
  readonly table: Table
  readonly relation: string
  readonly mapColumns: ReadonlySet<string>
  readonly missing: readonly DeclaredLanguageIndex[]
  readonly collapsing: readonly string[]
}): Effect.Effect<readonly string[], SQLExecutionError> =>
  Effect.gen(function* () {
    const { tx, table, relation, mapColumns } = params
    const languages = yield* Effect.forEach(
      params.missing.filter((index) => mapColumns.has(index.field)),
      (index) =>
        probe(tx, relation, languageValueExpression(index.field, index.code), (values) =>
          formatLanguageDuplicateRefusal({
            tableName: table.name,
            field: index.field,
            language: index.code,
            values,
          })
        )
    )
    const collapses = yield* Effect.forEach(
      table.fields.filter(
        (field) => params.collapsing.includes(field.name) && mapColumns.has(field.name)
      ),
      (field) =>
        probe(tx, relation, collapsedValueDdl(field), (values) =>
          formatLanguageDuplicateRefusal({ tableName: table.name, field: field.name, values })
        )
    )
    return [...languages.flat(), ...collapses.flat()]
  })
