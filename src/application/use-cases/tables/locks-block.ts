/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `_locks` block a records-API answer carries beside `fields`: what the
 * table's business rules keep THIS reader from changing on the stored row
 * (`locksOf`). Absent on a table without rules and when nothing is locked.
 *
 * A single-record read judges every rule, a lock reading the parent through a
 * relationship included: {@link locksReaderContext} loads those lookups once.
 * A list judges only the rules that read the record's own columns, so it never
 * costs one query per row.
 */

import { Effect } from 'effect'
import {
  bareRuleContext,
  locksOf,
  rulesNeedLookups,
  ruleWhensOf,
  translatedLocks,
  type LocksBlock,
} from '@/domain/models/app/tables/business-rule-service'
import { findTableByName } from '@/domain/models/app/tables/table-lookup-service'
import { ruleMessageText } from './permissions/business-rule-gate'
import { rowRuleScopeOf, withWhenMatches } from './permissions/row-rule-chain-matches'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { App } from '@/domain/models/app'
import type { CurrentUserContext } from '@/domain/models/app/tables/row-level-evaluator-service'

const tableOf = (app: App | undefined, tableName: string) => findTableByName(app?.tables, tableName)

/**
 * The context the rules of `tableName` are judged in for one single-record
 * read, the rows their relationship hops admit loaded; `undefined` for a table
 * without rules.
 */
export const locksReaderContext = (input: {
  readonly app?: App | undefined
  readonly tableName: string
  readonly userRole?: string | undefined
}): Effect.Effect<CurrentUserContext | undefined, never, DataSourceRepository> => {
  const table = tableOf(input.app, input.tableName)
  if (table?.rules === undefined || table.rules.length === 0) return Effect.undefined
  const bare = bareRuleContext('', input.userRole)
  if (!rulesNeedLookups(table)) return Effect.succeed(bare)
  return withWhenMatches(bare, ruleWhensOf(table), rowRuleScopeOf(table, input.app?.tables)).pipe(
    Effect.withSpan('tables.locks-reader-context', { attributes: { tableName: input.tableName } })
  )
}

/**
 * The `_locks` spread of one stored row for one reader. With a `rulesContext`
 * from {@link locksReaderContext}, every rule is judged; without one (a list),
 * only the rules reading the row's own columns.
 */
export const locksBlock = (input: {
  readonly app?: App | undefined
  readonly tableName: string
  readonly userRole?: string | undefined
  readonly userGroups?: readonly string[] | undefined
  readonly record: Readonly<Record<string, unknown>>
  readonly rulesContext?: CurrentUserContext | undefined
}): { readonly _locks?: LocksBlock } => {
  const { app, tableName } = input
  const table = tableOf(app, tableName)
  if (app === undefined || table?.rules === undefined || table.rules.length === 0) return {}
  const reader = {
    ...(input.userRole === undefined ? {} : { role: input.userRole }),
    groups: input.userGroups ?? [],
  }
  const ctx = input.rulesContext ?? bareRuleContext('', input.userRole)
  const locks = locksOf({
    ...{ app, tableName, reader, existing: input.record, ctx },
    ownColumnsOnly: input.rulesContext === undefined,
  })
  return locks === undefined
    ? {}
    : { _locks: translatedLocks(locks, (reason) => ruleMessageText(app, reason)) }
}
