/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import type { LinkTargetWrite } from './link-target-check'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'

/**
 * One upsert record as the link check sees it, holding the row it would update
 * — the one its merge fields match — read only when the check needs it (a many-to-one value it would refuse), so
 * an upsert whose links are all readable reads nothing more. A record that
 * lacks a merge value, or matches no row, is a create and holds nothing.
 */
export const upsertLinkTargetWrite =
  (
    repo: TableRepository['Service'],
    session: Readonly<UserSession>,
    tableName: string,
    merge: { readonly fieldsToMergeOn: readonly string[]; readonly hiddenIds: readonly string[] }
  ) =>
  (fields: Readonly<Record<string, unknown>>): LinkTargetWrite => {
    const { fieldsToMergeOn, hiddenIds } = merge
    // A row the caller's read rule hides is no match, so the write holds none of it.
    const visible =
      hiddenIds.length === 0 ? [] : [{ field: 'id', operator: 'notIn', value: hiddenIds }]
    return fieldsToMergeOn.some((name) => fields[name] === undefined || fields[name] === null)
      ? { fields }
      : {
          fields,
          held: repo
            .listRecords({
              session,
              tableName,
              filter: {
                and: [
                  ...fieldsToMergeOn.map((name) => ({
                    field: name,
                    operator: 'equals',
                    value: fields[name],
                  })),
                  ...visible,
                ],
              },
            })
            .pipe(Effect.map((rows) => rows[0])),
        }
  }
