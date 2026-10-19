/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  isOpenToEveryone,
  SIGNED_OUT_VISITOR_ROLE,
  type PermissionCaller,
} from '@/domain/models/app/auth/permission-evaluation'
import { assignableRoleNames } from '@/domain/models/app/auth/roles/role'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import type { App } from '@/domain/models/app'

/**
 * The readers a field's audience is probed for: every role the app knows,
 * alone and with each declared group, and a signed-out visitor when the table
 * lets anyone read it.
 *
 * A role and a group are probed TOGETHER, never one under a stand-in for the
 * other: a target read by `group:sales` and a source read by `viewer` pass a
 * probe of each alone, yet a `member` in `sales` reads the target and not the
 * source. Single groups are enough because a grant admits a caller when her
 * role OR one of her groups is named, so a second group only ever adds fields:
 * whatever a reader in two groups reads, a reader in one of them already does.
 */
const readerProbes = (app: App, table: string): ReadonlyArray<PermissionCaller> => {
  const groups = (app.auth?.groups ?? []).map((group) => group.name)
  const signed = [...assignableRoleNames(app)].flatMap((role) => [
    { role, groups: [] as readonly string[] },
    ...groups.map((group) => ({ role, groups: [group] as readonly string[] })),
  ])
  const permissions = app.tables?.find((candidate) => candidate.name === table)?.permissions
  return isOpenToEveryone(permissions?.read)
    ? [...signed, { role: SIGNED_OUT_VISITOR_ROLE, groups: [] }]
    : signed
}

/**
 * Whether a file read out of `source` may go into `target`, another field of
 * the same record of `table`, without reaching anyone who could not read it
 * before: every reader who may read `target` may read `source` too. Asked
 * through the canonical field-read predicate ({@link isFieldReadableByCaller}),
 * so field grants, the built-in default rules and write-only fields all count;
 * the table's own read gate is the same for both fields. It fails closed: a
 * reader the probes leave unsettled counts as reading the target alone.
 */
export const fieldReadNoWider = (
  app: App,
  table: string,
  fields: { readonly target: string; readonly source: string }
): boolean =>
  readerProbes(app, table).every(
    (caller) =>
      !isFieldReadableByCaller(app, table, caller, fields.target) ||
      isFieldReadableByCaller(app, table, caller, fields.source)
  )
