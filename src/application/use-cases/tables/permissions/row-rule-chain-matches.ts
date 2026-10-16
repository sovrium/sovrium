/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rows a reader's lookup leaves admit: the related rows of a
 * `<relationship>.<column>` chain, and the rows whose many-to-many field holds
 * the value of a `contains` (read from the link table, on the ruled table or
 * one relationship away).
 *
 * A row rule may read one many-to-one relationship deep (see
 * `row-rule-chain-service.ts`). Each such leaf is answered here once per
 * request: the ids of the related rows whose column satisfies it, read with
 * the leaf's value bound as a parameter (S3). The evaluator then judges the
 * ruled row by its relationship alone — in the list's SQL and against a
 * fetched row alike — so every door gives the same answer.
 *
 * Every failure fails CLOSED: a leaf whose chain cannot be followed, whose
 * value does not resolve for this reader, or whose lookup faults gets no entry,
 * and a leaf with no entry admits no row. A fault is logged; it is never a 500.
 */

import { Effect } from 'effect'
import {
  DataSourceRepository,
  type DataSourceDatabaseError,
} from '@/application/ports/repositories/tables/data-source-repository'
import {
  resolvePredicateValue,
  type CurrentUserContext,
} from '@/domain/models/app/tables/row-level-evaluator-service'
import {
  chainLeafKey,
  isRowRuleChain,
  lookupLeavesOf,
  resolveRowRuleChain,
} from '@/domain/models/app/tables/row-rule-chain-service'
import { isUserListField } from '@/domain/models/app/tables/user-list-field-service'
import { logError } from '@/infrastructure/logging'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'
import type { RowLevelPermissions, RowLevelPredicate } from '@/domain/models/app/tables/permissions'

/** The fields of a table, as far as a chain reads them. */
type ScopeTable = Parameters<typeof resolveRowRuleChain>[0]

/** The ruled table and every table of the app: what a chain is followed through. */
export interface RowRuleScope {
  readonly table: ScopeTable
  readonly tables: ReadonlyArray<ScopeTable>
}

/**
 * The scope a door judges a table's rules in, or `undefined` when it holds no
 * table or not a full declaration (a rule chain then admits no row).
 */
export const rowRuleScopeOf = (
  table: object | undefined,
  tables: ReadonlyArray<object> | undefined
): RowRuleScope | undefined =>
  table !== undefined && 'name' in table && 'fields' in table && Array.isArray(table.fields)
    ? {
        table: table as ScopeTable,
        tables: (tables ?? []) as ReadonlyArray<ScopeTable>,
      }
    : undefined

/** The table and column a lookup leaf reads: the related table of a chain, or the ruled table. */
const holderOf = (
  leaf: RowLevelPredicate,
  scope: RowRuleScope
): { readonly table: string; readonly column: string } | undefined => {
  if (!isRowRuleChain(leaf.field)) return { table: scope.table.name, column: leaf.field }
  const chain = resolveRowRuleChain(scope.table, scope.tables, leaf.field)
  return 'refusal' in chain ? undefined : { table: chain.relatedTable, column: chain.column }
}

/**
 * The ids of the rows of `holder.table` whose `holder.column` holds one of
 * `value` — a `contains` leaf's membership test: a many-to-many relationship
 * read from its link table, or a `user` field with `allowMultiple` read from
 * its own list column. `undefined` for any other field, so the leaf admits no
 * row.
 */
const membershipIds = (
  holder: { readonly table: string; readonly column: string },
  value: NonNullable<ReturnType<typeof resolvePredicateValue>>,
  scope: RowRuleScope
): Effect.Effect<readonly unknown[] | undefined, DataSourceDatabaseError, DataSourceRepository> =>
  Effect.gen(function* () {
    const field = [scope.table, ...scope.tables]
      .find((table) => table.name === holder.table)
      ?.fields.find((candidate) => candidate.name === holder.column)
    const values: readonly unknown[] = Array.isArray(value) ? value : [value]
    const repo = yield* DataSourceRepository
    if (isUserListField(field)) {
      return yield* repo.fetchUserListHolders({
        table: holder.table,
        column: holder.column,
        userIds: values.map(String),
      })
    }
    if (field?.relationType !== 'many-to-many' || field.relatedTable === undefined) {
      return undefined
    }
    return yield* repo.fetchManyToManyHolders({
      table: holder.table,
      relatedTable: field.relatedTable,
      relatedIds: values.map(String),
    })
  })

/** The ids of the rows a column leaf of a chain admits: the related rows whose column satisfies it. */
const columnIds = (
  leaf: RowLevelPredicate,
  holder: { readonly table: string; readonly column: string },
  value: NonNullable<ReturnType<typeof resolvePredicateValue>>
): Effect.Effect<readonly unknown[], DataSourceDatabaseError, DataSourceRepository> =>
  Effect.gen(function* () {
    const filter = {
      field: holder.column,
      operator: leaf.operator,
      value: leaf.operator === 'in' && !Array.isArray(value) ? [value] : value,
    } as DataFilter
    const repo = yield* DataSourceRepository
    const rows = yield* repo.fetchRecords(holder.table, { fields: ['id'], filter: [filter] })
    return rows.map((row) => row['id'])
  })

/** The ids one lookup leaf admits, or `undefined` when it admits none knowably. */
const admittedIds = (
  leaf: RowLevelPredicate,
  ctx: CurrentUserContext,
  scope: RowRuleScope
): Effect.Effect<readonly unknown[] | undefined, never, DataSourceRepository> =>
  Effect.gen(function* () {
    const holder = holderOf(leaf, scope)
    const value = resolvePredicateValue(leaf.value, ctx)
    if (holder === undefined || value === undefined) return undefined
    const lookup =
      leaf.operator === 'contains'
        ? membershipIds(holder, value, scope)
        : columnIds(leaf, holder, value)
    return yield* lookup.pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          logError('[PERMISSIONS] Row rule lookup failed; the rule admits no row', cause, {
            field: leaf.field,
          })
        )
      ),
      // effect-swallow: failing closed — a leaf with no entry admits no row, so a fault can only NARROW what is read.
      Effect.orElseSucceed(() => undefined)
    )
  })

/** The `when` of each of a table's four row rules, in a fixed order. */
const ruleWhens = (rlp: RowLevelPermissions | undefined) =>
  rlp === undefined ? [] : [rlp.read?.when, rlp.write?.when, rlp.create?.when, rlp.delete?.when]

/**
 * `ctx` with the related rows each chain leaf of `rlp` admits. Unchanged when
 * the rules hold no chain, or when no `scope` was given.
 */
export const withChainMatches = (
  ctx: CurrentUserContext,
  rlp: RowLevelPermissions | undefined,
  scope: RowRuleScope | undefined
): Effect.Effect<CurrentUserContext, never, DataSourceRepository> =>
  Effect.gen(function* () {
    const leaves = ruleWhens(rlp).flatMap((when) => lookupLeavesOf(when))
    if (leaves.length === 0 || scope === undefined) return ctx
    const unique = [...new Map(leaves.map((leaf) => [chainLeafKey(leaf), leaf])).values()]
    const entries = yield* Effect.forEach(unique, (leaf) =>
      admittedIds(leaf, ctx, scope).pipe(Effect.map((ids) => [chainLeafKey(leaf), ids] as const))
    )
    const known = entries.filter(
      (entry): entry is readonly [string, readonly unknown[]] => entry[1] !== undefined
    )
    return { ...ctx, chainMatches: new Map(known) }
  }).pipe(Effect.withSpan('tables.load-row-rule-chain-matches'))
