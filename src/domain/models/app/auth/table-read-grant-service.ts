/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE table-level read verdict: may this caller read rows of this table at
 * all, before any row or field is looked at?
 *
 * Every door onto a table's records asks it — the records API through the
 * application's authorization use-cases, a server-rendered page and a hosted
 * form through the caller-record gate — so they cannot disagree about which
 * table a person may read. The answer is a verdict rather than a boolean so a
 * door maps it to its transport the same way it maps every other verdict:
 * `NotFound` is the anti-enumeration answer, never "forbidden", because a
 * caller who may not read a table learns nothing about it.
 *
 * The decision itself is {@link hasReadPermissionForCaller}: the inheritance-
 * and override-aware grant over the caller's effective roles, and, for a
 * visitor who is not signed in to an app with sign-in, only a table whose
 * resolved `read` is `'all'`.
 */

import {
  hasReadPermissionForCaller,
  type ReadGateCaller,
  type TableGateScope,
} from './permission-evaluator-service'

/** A verdict that admits the caller, inside `rowRule` (the verb's row rule, as projected). */
export interface AllowedVerdict<RowRule> {
  readonly _tag: 'Allowed'
  readonly rowRule: RowRule
}

/** The caller may not learn that the record, or the table, exists. */
export interface NotFoundVerdict {
  readonly _tag: 'NotFound'
}

/**
 * The table-level read verdict: `Allowed` carries no row rule (`no-rlp`) — the
 * row-level read rule is the next question, asked by the door that reads rows.
 */
export type TableReadGrant = AllowedVerdict<'no-rlp'> | NotFoundVerdict

export const NOT_FOUND_VERDICT: NotFoundVerdict = { _tag: 'NotFound' }
const TABLE_READ_ALLOWED: AllowedVerdict<'no-rlp'> = { _tag: 'Allowed', rowRule: 'no-rlp' }

/** The table the read grant is asked about (an undeclared table is never readable). */
export type ReadGrantTable = Parameters<typeof hasReadPermissionForCaller>[0]

/**
 * May the caller read the table? `scope` is the app (or its table list), for
 * `inherit` and for telling a signed-out visitor of an app with sign-in apart.
 */
export const judgeTableReadGrant = (
  table: ReadGrantTable,
  caller: ReadGateCaller,
  scope?: TableGateScope
): TableReadGrant =>
  hasReadPermissionForCaller(table, caller, scope) ? TABLE_READ_ALLOWED : NOT_FOUND_VERDICT
