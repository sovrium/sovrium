/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The records list read AS A NAMED PERSON on a request that carries no session
 * cookie — an MCP tool call, a calendar app polling a feed address.
 *
 * The caller's door resolved WHO she is (her account role and groups, and her
 * row-level context); this module turns that into the records API's own list
 * read: a session synthesised for her id, her row-level read rule pushed into
 * the query, and `createListRecordsProgram`, which applies her field-level read
 * permissions exactly as `GET /api/tables/:table/records` does. One road, so a
 * door that reads as someone can never read more than she could on the API.
 */

import { Effect } from 'effect'
import { createListRecordsProgram } from './list-records-program'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type {
  QueryFilter,
  QueryFilterNode,
} from '@/application/ports/repositories/tables/table-repository'
import type { App } from '@/domain/models/app'

/** How a door names the sessions it synthesises, so a trace says which door it was. */
export interface CallerSessionLabel {
  readonly id: string
  readonly token: string
}

/**
 * A synthetic session for `userId`, suitable for the application programs.
 * `userId` is `undefined` only on a door's fail-closed fallback caller; the
 * authorship helpers then fall back to `null` for `created_by` / `updated_by`.
 */
export const synthesizeCallerSession = (
  userId: string | undefined,
  label: CallerSessionLabel
): UserSession => {
  const now = new Date()
  return {
    id: label.id,
    userId: userId ?? '',
    token: label.token,
    expiresAt: now,
    createdAt: now,
    updatedAt: now,
    ipAddress: null,
    userAgent: null,
    impersonatedBy: null,
    activeOrganizationId: null,
    signInMethod: null,
  }
}

/** The caller's row-level read clause, as `buildReadListFilter` projected it. */
export type CallerRowFilter = { readonly and: readonly QueryFilterNode[] } | undefined

/** The list filter: the caller's row-level clause AND the door's own clauses. */
const mergeFilters = (
  rowFilter: CallerRowFilter,
  clauses: readonly QueryFilterNode[]
): QueryFilter | undefined => {
  const and = [...(rowFilter?.and ?? []), ...clauses]
  return and.length === 0 ? undefined : { and }
}

/**
 * One page of the table's records as the caller reads them. A row filter the
 * caller's rule resolved to "nothing" is the door's to short-circuit before
 * calling: this reads whatever the merged filter admits.
 */
export const listRecordsAsCaller = (input: {
  readonly app: App
  readonly tableName: string
  readonly session: UserSession
  readonly role: string
  readonly groups: readonly string[]
  readonly rowFilter: CallerRowFilter
  readonly clauses?: readonly QueryFilterNode[]
  readonly sort?: string
  readonly limit?: number
  readonly offset?: number
}) => {
  const filter = mergeFilters(input.rowFilter, input.clauses ?? [])
  return createListRecordsProgram({
    session: input.session,
    tableName: input.tableName,
    app: input.app,
    userRole: input.role,
    userGroups: input.groups,
    filter,
    ...(input.sort === undefined ? {} : { sort: input.sort }),
    limit: input.limit,
    offset: input.offset,
  }).pipe(
    Effect.withSpan('tables.list-records-as-caller', {
      attributes: { 'table.name': input.tableName },
    })
  )
}
