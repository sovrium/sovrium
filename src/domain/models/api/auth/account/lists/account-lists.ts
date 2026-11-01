/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * `GET /api/account/lists/:list` — the five account lists a page binds with
 * `dataSource: { auth: <list> }`, each scoped to the reader by the server.
 *
 * Every row is projected here, never handed over as the auth store holds it: a
 * session row carries its bearer token and an API key row its hash, and
 * neither may reach a page. The answer is `{ rows }`, the shape a system read
 * source names with `rowsKey: rows`.
 */

const text = (description: string) => Schema.String.annotate({ description })
const optionalText = (description: string) =>
  Schema.optional(Schema.NullOr(Schema.String.annotate({ description })))

export const accountPasskeyRowSchema = Schema.Struct({
  id: text('Passkey id — the `target` of renamePasskey and removePasskey'),
  name: text('The name the reader gave the passkey (empty when she gave none)'),
  deviceType: optionalText('Authenticator class: `singleDevice` or `multiDevice`'),
  createdAt: optionalText('ISO 8601 instant the passkey was registered'),
})

export const accountSessionRowSchema = Schema.Struct({
  id: text('Session id — the `target` of revokeSession; never the session token'),
  device: text('A readable name for the browser and system the session was opened on'),
  ipAddress: optionalText('The address the session was opened from'),
  lastActiveAt: optionalText('ISO 8601 instant the session was last refreshed'),
  current: Schema.Boolean.annotate({ description: 'Whether this is the session reading the list' }),
})

export const accountApiKeyRowSchema = Schema.Struct({
  id: text('API key id — the `target` of revokeApiKey; never the key'),
  name: text('The key’s name'),
  prefix: text('The first characters of the key, enough to recognise it'),
  lastUsedAt: optionalText('ISO 8601 instant the key was last used'),
  expiresAt: optionalText('ISO 8601 instant the key stops working'),
})

export const accountMemberRowSchema = Schema.Struct({
  id: text('User id — the `target` of setRole'),
  name: text('Display name'),
  email: text('Email address'),
  image: optionalText('Avatar URL'),
  role: text('The member’s role'),
  joinedAt: optionalText('ISO 8601 instant the account was created'),
})

export const accountInvitationRowSchema = Schema.Struct({
  id: text(
    'Invitation id — the `target` of resendInvitation and revokeInvitation; never its token'
  ),
  email: text('Address the invitation was sent to'),
  role: text('Role the invitee will join as'),
  invitedBy: optionalText('Email of the person who sent it'),
  sentAt: optionalText('ISO 8601 instant it was sent'),
  expiresAt: text('ISO 8601 instant the link stops working'),
})

const rowsOf = <S extends Schema.Top>(row: S, identifier: string) =>
  Schema.Struct({ rows: Schema.Array(row) }).annotate({
    strictKeys: true,
    title: 'sovrium:strict-keys',
    identifier,
  })

export const accountPasskeysResponseSchema = rowsOf(accountPasskeyRowSchema, 'AccountPasskeys')
export const accountSessionsResponseSchema = rowsOf(accountSessionRowSchema, 'AccountSessions')
export const accountApiKeysResponseSchema = rowsOf(accountApiKeyRowSchema, 'AccountApiKeys')
export const accountMembersResponseSchema = rowsOf(accountMemberRowSchema, 'AccountMembers')
export const accountInvitationsResponseSchema = rowsOf(
  accountInvitationRowSchema,
  'AccountInvitations'
)

export type AccountSessionRow = Schema.Schema.Type<typeof accountSessionRowSchema>

/** `POST /api/auth/revoke-session` — one of the caller's sessions, by id (a list row) or token. */
export const accountRevokeSessionRequestSchema = Schema.Struct({
  id: Schema.optional(
    Schema.String.annotate({ description: 'Session id, as a sessions row holds it' })
  ),
  token: Schema.optional(
    Schema.String.annotate({ description: 'Session token, as Better Auth takes it' })
  ),
})

/**
 * `POST /api/auth/decline-invitation` — the invitee's answer from her invitation
 * link. Public: the token is the credential. An outstanding invitation is
 * withdrawn exactly as a revoke; any other token answers 404.
 */
export const accountDeclineInvitationRequestSchema = Schema.Struct({
  token: Schema.String.annotate({
    description: 'The invitation token, as the link in the invitation email carries it',
  }).check(Schema.isMinLength(1)),
}).annotate({ identifier: 'AccountDeclineInvitationRequest' })

/** Returned `200 OK` once the invitation is declined and its link stops working. */
export const accountDeclineInvitationResponseSchema = Schema.Struct({
  declined: Schema.Literal(true).annotate({
    description: 'The invitation was declined; its link no longer works',
  }),
}).annotate({ identifier: 'AccountDeclineInvitationResponse' })
