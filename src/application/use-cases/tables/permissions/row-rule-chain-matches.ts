/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The related rows a reader's `<relationship>.<column>` row rules admit.
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
import { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import {
  resolvePredicateValue,
  type CurrentUserContext,
} from '@/domain/models/app/tables/row-level-evaluator-service'
import {
  chainLeafKey,
  chainLeavesOf,
  resolveRowRuleChain,
} from '@/domain/models/app/tables/row-rule-chain-service'
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
 * The scope a door judges a table's rules in, or `undefined` when the table it
 * holds is not a full declaration (a rule chain then admits no row).
 */
export const rowRuleScopeOf = (
  table: object,
  tables: ReadonlyArray<object> | undefined
): RowRuleScope | undefined =>
  'name' in table && 'fields' in table && Array.isArray(table.fields)
    ? {
        table: table as ScopeTable,
        tables: (tables ?? []) as ReadonlyArray<ScopeTable>,
      }
    : undefined

/** The ids of the related rows one chain leaf admits, or `undefined` when it admits none knowably. */
const admittedIds = (
  leaf: RowLevelPredicate,
  ctx: CurrentUserContext,
  scope: RowRuleScope
): Effect.Effect<readonly unknown[] | undefined, never, DataSourceRepository> =>
  Effect.gen(function* () {
    const chain = resolveRowRuleChain(scope.table, scope.tables, leaf.field)
    const value = resolvePredicateValue(leaf.value, ctx)
    if ('refusal' in chain || value === undefined) return undefined
    const filter = {
      field: chain.column,
      operator: leaf.operator,
      value: leaf.operator === 'in' && !Array.isArray(value) ? [value] : value,
    } as DataFilter
    const repo = yield* DataSourceRepository
    return yield* repo.fetchRecords(chain.relatedTable, { fields: ['id'], filter: [filter] }).pipe(
      Effect.map((rows) => rows.map((row) => row['id'])),
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          logError('[PERMISSIONS] Row rule chain lookup failed; the rule admits no row', cause, {
            chain: leaf.field,
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
    const leaves = ruleWhens(rlp).flatMap((when) => chainLeavesOf(when))
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
