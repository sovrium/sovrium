/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A row rule chain the engine cannot follow is refused before the app starts.
 *
 * `<relationship>.<column>` reads one many-to-one relationship deep (see
 * `row-rule-chain-service.ts`). Anything else — a first part that is not such a
 * relationship, a second part that is no column of the related table, a chain
 * through two relationships — has no answer, and would otherwise surface as a `500` on
 * every read of the table. `sovrium validate` and the boot refuse it instead,
 * naming the table, the chain and why.
 */

import { chainLeavesOf, resolveRowRuleChain } from './row-rule-chain-service'
import type { RowLevelWhen } from './row-level-permissions'

type RuleOperation = 'read' | 'write' | 'create' | 'delete'

const OPERATIONS: readonly RuleOperation[] = ['read', 'write', 'create', 'delete']

interface ChainCheckedTable {
  readonly name: string
  readonly fields: ReadonlyArray<{
    readonly name: string
    readonly type: string
    readonly relatedTable?: string
    readonly relationType?: string
    readonly allowMultiple?: boolean
  }>
  readonly rowLevelPermissions?: Readonly<
    Partial<Record<RuleOperation, { readonly when: RowLevelWhen } | undefined>>
  >
}

/** The first refusal of a table's row rule chains, or `undefined` when every chain resolves. */
const tableChainError = (
  table: ChainCheckedTable,
  tables: ReadonlyArray<ChainCheckedTable>
): string | undefined =>
  OPERATIONS.flatMap((operation) => chainLeavesOf(table.rowLevelPermissions?.[operation]?.when))
    .map((leaf) => {
      const resolved = resolveRowRuleChain(table, tables, leaf.field)
      return 'refusal' in resolved
        ? `Table "${table.name}": row rule on "${leaf.field}" cannot be followed: ${resolved.refusal}`
        : undefined
    })
    .find((message) => message !== undefined)

/** The first row rule chain of the app that cannot be followed, or `undefined`. */
export const validateRowRuleChains = (
  tables: ReadonlyArray<ChainCheckedTable>
): string | undefined =>
  tables.map((table) => tableChainError(table, tables)).find((message) => message !== undefined)
