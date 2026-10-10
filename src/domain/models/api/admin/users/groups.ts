/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contracts for group membership in the operator console.
 *
 * Two endpoints:
 *
 * - `GET /api/admin/groups` — the groups this app DECLARES (`app.auth.groups`),
 *   as rows. A projection of configuration, like `GET /api/admin/roles`: it says
 *   which groups exist, never who belongs to them. Admin-tier read; the console's
 *   Groups picker binds it through `optionsSource` with `rowsKey: 'groups'`.
 * - `PUT /api/admin/users/:userId/groups` — set the account's membership to
 *   exactly the listed groups. The body is the WHOLE desired set, which is what a
 *   multi-select commits; the server diffs it against the stored membership and
 *   reports what it added and removed. Sending the set an account already has
 *   changes nothing and answers 200 with two empty lists. Admin-equivalent only;
 *   every other caller, signed in or not, receives 404.
 *
 * A group is named by its NAME, never by the id of the team that stores it:
 * the name is the identity the config declares, and the id is a storage detail
 * an operator never sees.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

const groupNameSchema = Schema.String.annotate({
  description:
    'A group name declared in `auth.groups`. The name is the identity; no id is exposed.',
}).pipe(Schema.check(Schema.isMinLength(1)))

/** One declared group. */
export const adminGroupItemSchema = Schema.Struct({
  name: groupNameSchema,
  description: optionalField(
    Schema.String.annotate({
      description: 'The description the config gives the group, when it gives one.',
    })
  ),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'AdminGroupItem' })

/** Response schema for `GET /api/admin/groups`. */
export const adminGroupsResponseSchema = Schema.Struct({
  groups: Schema.Array(adminGroupItemSchema).annotate({
    description:
      'Every group declared in `auth.groups`, sorted by name. Empty when the app declares none. Read-only: it lists which groups exist, not who belongs to them.',
  }),
  total: Schema.Int.annotate({
    description: 'How many groups this response carries.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'AdminGroupsResponse' })

/** Request body for `PUT /api/admin/users/:userId/groups`. */
export const adminUserGroupsUpdateRequestSchema = Schema.Struct({
  groups: Schema.Array(groupNameSchema).annotate({
    description:
      'The complete set of groups the account should belong to. Groups not listed are left; groups listed are joined; a name repeated counts once. An empty list removes the account from every group. Every name must be declared in `auth.groups`, or the whole request is refused with 400 and nothing changes.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'AdminUserGroupsUpdateRequest',
})

/** Response body for `PUT /api/admin/users/:userId/groups`. */
export const adminUserGroupsUpdateResponseSchema = Schema.Struct({
  userId: Schema.String.annotate({
    description: 'The account whose membership was set.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  groups: Schema.Array(groupNameSchema).annotate({
    description: 'The account’s membership after the write, sorted by name.',
  }),
  added: Schema.Array(groupNameSchema).annotate({
    description: 'Groups the account joined in this request, sorted by name. Empty when none.',
  }),
  removed: Schema.Array(groupNameSchema).annotate({
    description: 'Groups the account left in this request, sorted by name. Empty when none.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'AdminUserGroupsUpdateResponse',
})

/** @public */
export type AdminGroupItem = typeof adminGroupItemSchema.Type
/** @public */
export type AdminGroupsResponse = typeof adminGroupsResponseSchema.Type
/** @public */
export type AdminUserGroupsUpdateRequest = typeof adminUserGroupsUpdateRequestSchema.Type
/** @public */
export type AdminUserGroupsUpdateResponse = typeof adminUserGroupsUpdateResponseSchema.Type
