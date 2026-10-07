/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The assignable-roles admin read, as a registry entry: `GET /api/admin/roles`
 * and its MCP tool, derived from one description.
 *
 * The set is `assignableRoleNames(app)`: the built-ins, the admin-tier names,
 * and every name declared in `app.auth.roles[]`. It is COMPUTED from the auth
 * config and stored in no table, which is why the Users and Invitations
 * consoles bind it as a system source rather than a table-backed option list.
 * A rows envelope (`{ roles, total }`), so the shared `rowsKey` / `totalKey`
 * contract every other system source reads applies unchanged; sorted by name,
 * so the option order does not depend on declaration accidents.
 *
 * Read-only, and a projection of configuration rather than of data: it reveals
 * nothing about who holds which role, and offering a name here never grants
 * the right to assign it — that is decided where the write happens. It writes
 * no admin audit event, as the route never has.
 */

import { Effect } from 'effect'
import {
  answerWithSchema,
  defineAdminRead,
  type AdminReadOperation,
} from '@/application/use-cases/admin/admin-read-operation'
import { adminRolesResponseSchema } from '@/domain/models/api/admin/users/roles'
import { assignableRoleNames } from '@/domain/models/app/auth/roles'

const rolesList = defineAdminRead<undefined>({
  id: 'roles.list',
  method: 'get',
  path: '/api/admin/roles',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'roles_list',
    description:
      'The role names this app may assign — the built-ins, the admin-tier names and every declared role — sorted by name, as GET /api/admin/roles answers them (admin-only, read-only).',
    inputSchema: { type: 'object', properties: {} },
  },
  openapi: {
    summary: 'List the assignable roles',
    description:
      'Every role name this app may assign, sorted by name: the built-ins, the admin-tier ' +
      'names and every role declared in `auth.roles`. A projection of configuration — it ' +
      'says nothing about who holds which role. Admin only.',
    operationIdBase: 'listAdminRoles',
    responseSchema: adminRolesResponseSchema,
    responseDescription: 'The assignable roles',
  },
  http: { conditional: {} },
  subject: 'roles list',
  decode: () => ({ _tag: 'Ok', input: undefined }),
  // No admin audit event: the roles route has never written one.
  read: (app) =>
    Effect.sync(() => {
      const names = [...assignableRoleNames(app)].toSorted((a, b) => a.localeCompare(b))
      return answerWithSchema(adminRolesResponseSchema, {
        roles: names.map((name) => ({ name })),
        total: names.length,
      })
    }),
})

/** The assignable-roles read. */
export const ROLES_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [rolesList]
