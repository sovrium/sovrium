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
import {
  consoleLabels,
  resolveOperatorLanguage,
} from '@/application/use-cases/admin/operator-language'
import { adminRolesResponseSchema } from '@/domain/models/api/admin/users/roles'
import {
  ADMIN_TIER_ROLE_NAMES,
  assignableRoleNames,
  BUILT_IN_ROLES,
} from '@/domain/models/app/auth/roles'
import type { App } from '@/domain/models/app'

/** Names the configuration cannot redeclare, so it can never describe them. */
const UNDESCRIBABLE: ReadonlySet<string> = new Set<string>([
  ...BUILT_IN_ROLES,
  ...ADMIN_TIER_ROLE_NAMES,
])

/** The declared `auth.roles[].description` of `name`, verbatim, else null. */
const roleDescription = (app: App, name: string): string | null =>
  UNDESCRIBABLE.has(name)
    ? null
    : ((app.auth?.roles ?? []).find((role) => role.name === name)?.description ?? null)

const rolesList = defineAdminRead<undefined>({
  id: 'roles.list',
  method: 'get',
  path: '/api/admin/roles',
  pathParams: [],
  queryParams: [],
  tool: {
    suffix: 'roles_list',
    description:
      'The role names this app may assign — the built-ins, the admin-tier names and every declared role — sorted by name, each with its declared description (null when none), as GET /api/admin/roles answers them (admin-only, read-only).',
    inputSchema: { type: 'object', properties: {} },
  },
  openapi: {
    summary: 'List the assignable roles',
    description:
      'Every role name this app may assign, sorted by name: the built-ins, the admin-tier ' +
      'names and every role declared in `auth.roles`, each with the description its ' +
      '`auth.roles` entry declares (null when none). A projection of configuration — it ' +
      'says nothing about who holds which role. Admin only.',
    operationIdBase: 'listAdminRoles',
    responseSchema: adminRolesResponseSchema,
    responseDescription: 'The assignable roles',
  },
  http: { conditional: {} },
  subject: 'roles list',
  decode: () => ({ _tag: 'Ok', input: undefined }),
  // No admin audit event: the roles route has never written one.
  // Each label is phrased in the operator's console language.
  read: (app, _input, request) =>
    Effect.gen(function* () {
      const labels = consoleLabels(app, yield* resolveOperatorLanguage(request))
      const names = [...assignableRoleNames(app)].toSorted((a, b) => a.localeCompare(b))
      return answerWithSchema(adminRolesResponseSchema, {
        roles: names.map((name) => ({
          name,
          label: labels.role(name),
          description: roleDescription(app, name),
        })),
        total: names.length,
      })
    }),
})

/** The assignable-roles read. */
export const ROLES_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [rolesList]
