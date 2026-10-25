/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The seed folder as one seeded account reads it (`--as`): of each seeded
 * table, the rows that account's row-level `read` rule admits, judged by the
 * rule the renderer applies, each row without the fields its role may not
 * read, judged by the records API's own read plan. Every board, every grid,
 * list and kanban, every record board and the Prototype board's store draw
 * from this one view, so a relationship never names a row the account cannot
 * read: the row is not there to be named.
 *
 * Without `--as` the seed folder is drawn as it is, for the sample
 * administrator, who reads every row and every field.
 */

import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  type TableLike,
} from '@/domain/models/app/tables/read-access-plan-service'
import {
  readerContextOf,
  visitorRowRule,
  type RowRuleReader,
  type RowRuleTable,
} from '@/domain/models/app/tables/visitor-row-rule-service'
import type { PageSeed, PageSeedAccount, PageSeedRow } from './design-system-page-seed-folder'
import type { App } from '@/domain/models/app'

/** A seeded account as a row rule and a read plan read her. */
const readerOf = (app: App, account: PageSeedAccount): RowRuleReader => ({
  userId: account.id,
  role: account.role,
  email: account.email,
  isUnrestricted: isAdminEquivalent(account.role, app),
})

/** The declared table a seeded table's rows belong to. */
const tableOf = (app: App, name: string) => app.tables?.find((candidate) => candidate.name === name)

/**
 * Of one table's seeded rows, those a seeded account's row-level `read` rule
 * admits; every one without an account.
 */
export const readableRowsOf = (
  app: App,
  table: string,
  rows: readonly PageSeedRow[],
  account: PageSeedAccount | undefined
): readonly PageSeedRow[] => {
  if (account === undefined) return rows
  const reader = readerOf(app, account)
  const rule = visitorRowRule(tableOf(app, table) as RowRuleTable | undefined, reader)
  if (rule.kind === 'all') return rows
  if (rule.kind === 'none') return []
  const context = readerContextOf(reader, new Map())
  return rows.filter((row) => rule.admits(row, context))
}

/**
 * Whether the account's role may read the table at all, and the fields it may
 * not read: a write-only field it is told the presence of stays, drawn as its
 * specimen as every seeded secret is.
 */
const fieldAccessOf = (app: App, name: string, account: PageSeedAccount) => {
  const table = tableOf(app, name)
  if (table === undefined) return { allowed: true, hidden: new Set<string>() }
  const plan = buildReadAccessPlan({
    app,
    table: table as TableLike,
    principal: { role: account.role, effectiveRoles: [account.role], isAuthenticated: true },
    policy: CANONICAL_READ_POLICY,
    rowContext: readerContextOf(readerOf(app, account), new Map()),
  })
  return {
    allowed: plan.allowed,
    hidden: new Set(
      [...plan.restrictedColumns].filter((field) => !plan.presenceColumns.has(field))
    ),
  }
}

/** One table's seeded rows as the account reads them. */
const tableAsAccount = (
  app: App,
  name: string,
  rows: readonly PageSeedRow[],
  account: PageSeedAccount
): readonly PageSeedRow[] => {
  const { allowed, hidden } = fieldAccessOf(app, name, account)
  if (!allowed) return []
  return readableRowsOf(app, name, rows, account).map((row) =>
    hidden.size === 0
      ? row
      : Object.fromEntries(Object.entries(row).filter(([field]) => !hidden.has(field)))
  )
}

/**
 * The seed folder as the account the export is drawn as reads it; the seed
 * folder itself without `--as`.
 */
export const seedAsAccountOf = (
  app: App,
  seed: PageSeed | undefined,
  account: PageSeedAccount | undefined
): PageSeed | undefined =>
  seed === undefined || account === undefined
    ? seed
    : {
        ...seed,
        tables: Object.fromEntries(
          Object.entries(seed.tables).map(([name, rows]) => [
            name,
            tableAsAccount(app, name, rows, account),
          ])
        ),
      }
