/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The part of a subscriber's grant a live subscription depends on, reduced to
 * one comparable string.
 *
 * A subscription resolves the caller's access once, at the handshake, and
 * judges every change it fans out against that snapshot. The periodic grant
 * re-check resolves the same access again and closes the connection when it
 * no longer matches — so the comparison has to see exactly what the snapshot
 * was used for, and nothing else:
 *
 *  - whether the table may be read at all;
 *  - which columns may be read (`undefined` meaning every column);
 *  - which rows may be read: every row, the rows a grant admits (by id), or
 *    none — the same admission a list of the table answers its reader with;
 *  - the roles each row a grant names gives the reader, which open on that
 *    row's changes the fields those roles read;
 *  - the row-level context the table's read rule is judged against — the
 *    caller's identity, role, unrestricted flag, and the record ids their
 *    `user_access` grants assign per scope table.
 *
 * Order carries no meaning in any of those sets, so they are sorted before
 * serialising: two resolutions of the same grant always produce the same
 * string, whatever order the database returned the rows in.
 */

import type { RowGrants, RowReadAdmission } from './row-read-admission-service'

/** The row-level context a read rule is judged against, as far as a grant decides it. */
export interface GrantRowContext {
  readonly userId: string
  readonly email: string | undefined
  readonly role: string
  readonly isUnrestricted: boolean
  readonly assignments: ReadonlyMap<string, readonly string[]>
  readonly activeAssignment?: string | undefined
}

/** What one resolution of a subscriber's grant decided. */
export interface ResolvedGrant {
  readonly allowed: boolean
  /** The readable columns, or `undefined` when every column is readable. */
  readonly columns: readonly string[] | undefined
  /** The rows the reader may read, as a list of the table admits them. */
  readonly rows: RowReadAdmission
  /** Each row a grant names on the table, with the roles granted on it; none when absent. */
  readonly grants?: RowGrants | undefined
  /** The row-level context, or `undefined` when no row rule governs the table. */
  readonly rowContext: GrantRowContext | undefined
}

const sorted = (values: readonly string[]): readonly string[] =>
  values.toSorted((a, b) => a.localeCompare(b, 'en'))

const rowContextShape = (context: GrantRowContext | undefined): unknown =>
  context === undefined
    ? 'none'
    : {
        userId: context.userId,
        email: context.email ?? '',
        role: context.role,
        isUnrestricted: context.isUnrestricted,
        activeAssignment: context.activeAssignment ?? '',
        assignments: sorted([...context.assignments.keys()]).map((scope) => [
          scope,
          sorted((context.assignments.get(scope) ?? []).map(String)),
        ]),
      }

const rowsShape = (rows: RowReadAdmission): unknown =>
  rows.kind === 'granted-rows' ? [rows.kind, sorted(rows.ids)] : rows.kind

const grantsShape = (grants: RowGrants | undefined): unknown =>
  sorted([...(grants ?? new Map<string, readonly string[]>()).keys()]).map((id) => [
    id,
    sorted(grants?.get(id) ?? []),
  ])

/** One comparable string for a resolved grant — equal exactly when the grants are the same. */
export const grantFingerprint = (grant: ResolvedGrant): string =>
  JSON.stringify({
    allowed: grant.allowed,
    columns: grant.columns === undefined ? '*' : sorted(grant.columns),
    rows: rowsShape(grant.rows),
    grants: grantsShape(grant.grants),
    rowContext: rowContextShape(grant.rowContext),
  })
