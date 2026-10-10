/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The declared-groups admin read, as a registry entry: `GET /api/admin/groups`
 * and its MCP tool, derived from one description.
 *
 * The roles read's sibling, and built the same way: `app.auth.groups[]` as
 * `{ groups, total }` rows, each `{ name, description? }`, sorted by name. It
 * is COMPUTED from the auth config and stored in no table, which is why the
 * console binds it as an option source for its Groups picker.
 *
 * A projection of configuration, never of data: it says which groups exist and
 * nothing about who belongs to them. It writes no admin audit event, as the
 * roles read writes none.
 */

import { Effect } from 'effect'
import {
  answerWithSchema,
  defineAdminRead,
  type AdminReadOperation,
} from '@/application/use-cases/admin/admin-read-operation'
import { adminGroupsResponseSchema } from '@/domain/models/api/admin/users/groups'

const groupsList = defineAdminRead<undefined>({
  id: 'groups.list',
  method: 'get',
  path: '/api/admin/groups',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'groups_list',
    description:
      'The groups this app declares in auth.groups — each name and its description — sorted by name, as GET /api/admin/groups answers them (admin-only, read-only; never who belongs).',
    inputSchema: { type: 'object', properties: {} },
  },
  openapi: {
    summary: 'List the declared groups',
    description:
      'Every group declared in `auth.groups`, sorted by name, with the description the ' +
      'config gives it. A projection of configuration — it says nothing about who belongs ' +
      'to which group. Admin only.',
    operationIdBase: 'listAdminGroups',
    responseSchema: adminGroupsResponseSchema,
    responseDescription: 'The declared groups',
  },
  http: { conditional: {} },
  subject: 'groups list',
  decode: () => ({ _tag: 'Ok', input: undefined }),
  // No admin audit event: a projection of configuration, like the roles read.
  read: (app) =>
    Effect.sync(() => {
      const groups = (app.auth?.groups ?? [])
        .map((group) =>
          group.description === undefined
            ? { name: group.name }
            : { name: group.name, description: group.description }
        )
        .toSorted((a, b) => a.name.localeCompare(b.name))
      return answerWithSchema(adminGroupsResponseSchema, { groups, total: groups.length })
    }),
})

/** The declared-groups read. */
export const GROUPS_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [groupsList]
