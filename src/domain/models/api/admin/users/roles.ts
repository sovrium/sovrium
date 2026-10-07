/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/roles` — the role names this app may
 * assign, as rows.
 *
 * Encodes the body the `roles.list` read (`application/use-cases/admin/
 * roles-read-operations.ts`) answers, over HTTP and as an MCP tool: `{ roles, total }`, each
 * row `{ name }`, sorted by `localeCompare`. The set is
 * `assignableRoleNames(app)` — the built-ins, the admin-tier names and every
 * name declared in `app.auth.roles[]` — so it is a projection of
 * CONFIGURATION, not of data: it says nothing about who holds which role.
 *
 * The envelope key is `roles`, not `items`, because the Users and Invitations
 * console pages bind it with `rowsKey: 'roles'`; renaming it would silently
 * empty their role pickers. `total` counts the rows this response carried.
 *
 * Takes no query parameter: the list is small, closed and unpaged.
 */

import { Schema } from 'effect'

/** One assignable role. A role name is its own identity; there is no id. */
export const adminRoleItemSchema = Schema.Struct({
  name: Schema.String.annotate({
    description:
      'An assignable role name: a built-in (`admin`, `member`, `viewer`), an admin-tier name, or one declared in `auth.roles`. The name is the identity; no numeric id exists.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
}).annotate({ identifier: 'AdminRoleItem' })

/**
 * Response schema for `GET /api/admin/roles`.
 */
export const adminRolesResponseSchema = Schema.Struct({
  roles: Schema.Array(adminRoleItemSchema).annotate({
    description:
      'Every role this app may assign, sorted by name. Read-only: offering a name here never grants the right to assign it, which is decided where the write happens.',
  }),
  total: Schema.Int.annotate({
    description: 'How many roles this response carries.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'AdminRolesResponse',
})

/** @public */
export type AdminRoleItem = typeof adminRoleItemSchema.Type
/** @public */
export type AdminRolesResponse = typeof adminRolesResponseSchema.Type
