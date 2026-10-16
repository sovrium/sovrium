/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * How long the invitation link stays valid: the same grammar as
 * `auth.invitationTokenExpiry` — a duration string (`"30s"`, `"15m"`, `"72h"`,
 * `"7d"`) or a positive whole number of milliseconds. Written literally so a
 * malformed lifetime is refused when the app is validated, not on the first run.
 */
const InviteUserExpiresInSchema = Schema.Union([
  Schema.String.pipe(
    Schema.annotate({ description: 'Duration string, e.g. "30s", "15m", "72h", "7d"' }),
    Schema.check(Schema.isPattern(/^[1-9]\d*[smhd]$/))
  ),
  Schema.Finite.pipe(
    Schema.annotate({ description: 'Lifetime in milliseconds (positive integer)' }),
    Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
  ),
])

/**
 * Auth Invite User Action (type: auth, operator: inviteUser)
 *
 * Invite a person by email: the account is created without a password, a
 * single-use invitation link is stored, and the invitation email is sent — the
 * same invitation an operator issues by hand. The invitee chooses their own
 * password when they accept. An address that already belongs to an account
 * that signs in is skipped by default (`ifExists: skip`) so a re-fired trigger
 * never fails a run; `ifExists: fail` makes it fail the step instead.
 */
export const AuthInviteUserActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('auth').pipe(
    Schema.annotate({
      description: "Constant value 'auth' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('inviteUser').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'auth' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    email: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Email address the invitation is sent to' })
    ),
    name: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          defaultNote: 'the part of the address before the @',
          description:
            "Invitee's display name, used in the email and on the account until they change it",
        })
      )
    ),
    role: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'Role the account holds once the invitation is accepted: a built-in role, an admin-tier role, or one declared in auth.roles. A literal name the app does not know is refused when the app is validated; a templated name is checked when the step runs.',
      })
    ),
    expiresIn: Schema.optional(
      InviteUserExpiresInSchema.pipe(
        Schema.annotate({
          defaultNote: 'auth.invitationTokenExpiry, or 72h',
          description: 'How long the invitation link stays valid',
        })
      )
    ),
    ifExists: Schema.optional(
      Schema.Literals(['skip', 'fail']).pipe(
        Schema.annotate({
          defaultNote: 'skip',
          description:
            'What to do when the address already belongs to an account that can sign in: skip succeeds without sending anything, fail fails the step. An account whose invitation is still pending is invited again either way.',
        })
      )
    ),
  }).annotate({
    description:
      'Who is invited, with which role, how long the link lasts, and what happens when they already have an account.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AuthInviteUserAction',
    title: 'Auth Invite User Action',
    description:
      'Invite a person by email to create their own password and join with a role; reports whether an invitation was sent',
  })
)

/** @public */
export type AuthInviteUserAction = Schema.Schema.Type<typeof AuthInviteUserActionSchema>
