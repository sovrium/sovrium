/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { assignableRoleNames } from '@/domain/models/app/auth/roles/role'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import type { App } from '@/domain/models/app'
import type { PermissionCaller } from '@/domain/models/app/auth/permission-evaluation'

/**
 * The callers a field's readability is probed for: every role the app knows,
 * and a member of each declared group holding the lowest built-in role.
 */
const readabilityProbes = (app: App): ReadonlyArray<PermissionCaller> => [
  ...[...assignableRoleNames(app)].map((role) => ({ role, groups: [] as readonly string[] })),
  ...(app.auth?.groups ?? []).map((group) => ({ role: 'viewer', groups: [group.name] })),
]

/**
 * Partition `fields` of `tableName` by who may read them: fields that every
 * probed caller (each role the app knows, each declared group) reads alike
 * form one group, asked through the canonical field-read predicate
 * ({@link isFieldReadableByCaller}), so explicit field grants and the built-in
 * default rules both count.
 *
 * The knowledge index cuts one chunk sequence per group, so a reader who may
 * read one group and not another loses nothing she may read. The partition
 * decides nothing per reader: what a reader is served is decided for her own
 * roles, groups and assignments. Two fields no probe tells apart (grants naming
 * two different assignment roles, say) share a group, which then reaches only a
 * reader of both — a loss of recall, never a disclosure.
 *
 * Groups keep the declared field order and appear in the order of their first
 * field.
 */
export const partitionFieldsByReaders = (
  app: App,
  tableName: string,
  fields: ReadonlyArray<string>
): ReadonlyArray<ReadonlyArray<string>> => {
  const probes = readabilityProbes(app)
  const keyed = fields.map(
    (field) =>
      [
        field,
        probes
          .map((caller) => (isFieldReadableByCaller(app, tableName, caller, field) ? '1' : '0'))
          .join(''),
      ] as const
  )
  const keys = [...new Set(keyed.map(([, key]) => key))]
  return keys.map((key) => keyed.filter(([, fieldKey]) => fieldKey === key).map(([field]) => field))
}
