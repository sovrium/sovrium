/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { describedRef } from '@/domain/models/api/combinators/described-ref'
import { email, looseIsoDateTime, uri } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { timestampSchema } from '../combinators/common'

// ============================================================================
// User Schemas
// ============================================================================

/**
 * User schema
 *
 * Represents a user in API responses.
 * Based on Better Auth user model.
 */
export const userSchema = Schema.Struct({
  ...Schema.Struct({
    id: Schema.String.annotate({ description: 'Unique user identifier' }),
    email: email({ description: 'User email address' }),
    name: Schema.NullOr(Schema.String.annotate({ description: 'User display name' })),
    image: optionalField(Schema.NullOr(uri({ description: 'User avatar URL' }))),
    emailVerified: Schema.Boolean.annotate({ description: 'Whether email is verified' }),
    // The caller's interface-language preference, carried on the `{ user }`
    // envelope `GET /api/auth/get-session` returns. An engine-owned column on
    // `auth.user` (Better Auth `user.additionalFields`), not an app config
    // option.
    //
    // Declared HERE, beside `image`, because this schema is what says which
    // fields a `$session.<field>` token can resolve. The token reads the
    // envelope DYNAMICALLY — `resolveSessionTemplate` validates nothing against
    // `SessionFieldSchema`, which gates only the `session:` field on a `text`
    // component — so this contract is the one place the client and the server
    // share a vocabulary for it. Left out, `$session.language` would resolve at
    // runtime while being undocumented, which is the worse of the two failures.
    //
    // OPTIONAL-and-nullable, exactly like `image` one line above, and
    // deliberately NOT tightened when the column landed. This schema describes
    // an envelope BETTER AUTH composes, not one Sovrium builds: the shape is
    // upstream's to vary, and `image` — a Better Auth built-in older than this
    // field — is declared the same way for the same reason. Requiring the key
    // here would be a stronger claim about somebody else's response than the
    // field beside it makes about its own.
    //
    // The account EXPORT contract is the opposite case and IS required: that
    // payload is assembled by `buildExportPayload`, so the key is always there.
    language: optionalField(
      Schema.NullOr(
        Schema.String.annotate({
          description:
            "The user's interface-language preference (a code or locale the app declares), or null",
        })
      )
    ),
  }).fields,
  ...timestampSchema.fields,
})

/**
 * User with role schema (for admin endpoints)
 */
export const userWithRoleSchema = Schema.Struct({
  ...userSchema.fields,
  role: Schema.Literals(['admin', 'member', 'viewer']).annotate({ description: 'User role' }),
  banned: optionalField(Schema.Boolean.annotate({ description: 'Whether user is banned' })),
  banReason: optionalField(
    Schema.NullOr(Schema.String.annotate({ description: 'Reason for ban' }))
  ),
  banExpiresAt: optionalField(Schema.NullOr(looseIsoDateTime({ description: 'Ban expiration' }))),
}).annotate({ identifier: 'UserWithRole' })

// ============================================================================
// Session Schemas
// ============================================================================

/**
 * Session schema
 *
 * Represents an authentication session.
 */
export const sessionSchema = Schema.Struct({
  ...Schema.Struct({
    id: Schema.String.annotate({ description: 'Session identifier' }),
    userId: Schema.String.annotate({ description: 'User ID this session belongs to' }),
    token: Schema.String.annotate({ description: 'Session token' }),
    expiresAt: looseIsoDateTime({ description: 'Session expiration timestamp' }),
    ipAddress: optionalField(
      Schema.NullOr(Schema.String.annotate({ description: 'IP address of session' }))
    ),
    userAgent: optionalField(
      Schema.NullOr(Schema.String.annotate({ description: 'User agent string' }))
    ),
  }).fields,
  ...timestampSchema.fields,
})

/**
 * Session with user schema
 */
export const sessionWithUserSchema = Schema.Struct({
  session: sessionSchema,
  user: userSchema,
}).annotate({ identifier: 'SessionWithUser' })

// ============================================================================
// Auth Response Schemas
// ============================================================================

/**
 * Sign-in response schema
 *
 * Returned on successful email/password sign-in.
 */
export const signInResponseSchema = Schema.Struct({
  user: userSchema.annotate({ description: 'Authenticated user data' }),
  session: sessionSchema.annotate({ description: 'New session data' }),
  token: optionalField(Schema.String.annotate({ description: 'Bearer token for API calls' })),
})

/**
 * Sign-up response schema
 *
 * Returned on successful user registration.
 */
export const signUpResponseSchema = Schema.Struct({
  user: userSchema.annotate({ description: 'Newly created user data' }),
  session: optionalField(sessionSchema.annotate({ description: 'Session if auto-login enabled' })),
  token: optionalField(
    Schema.String.annotate({ description: 'Bearer token if auto-login enabled' })
  ),
})

/**
 * Sign-out response schema
 */
export const signOutResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({ description: 'Sign-out succeeded' }),
})

/**
 * Session response schema
 *
 * Returned when fetching current session.
 * Wraps sessionWithUserSchema with a distinct OpenAPI name so Knip
 * does not flag it as a duplicate export while OpenAPI emits a $ref.
 */
export const getSessionResponseSchema = sessionWithUserSchema.annotate({
  identifier: 'GetSessionResponse',
})

/**
 * List sessions response schema
 */
export const listSessionsResponseSchema = Schema.Struct({
  sessions: Schema.Array(sessionSchema).annotate({ description: 'List of active sessions' }),
})

/**
 * Revoke session response schema
 */
export const revokeSessionResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({ description: 'Session revoked successfully' }),
})

// ============================================================================
// Password Schemas
// ============================================================================

/**
 * Password reset request response schema
 */
export const forgotPasswordResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({ description: 'Password reset email sent' }),
})

/**
 * Password reset response schema
 */
export const resetPasswordResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({ description: 'Password reset successful' }),
})

/**
 * Change password response schema
 */
export const changePasswordResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({ description: 'Password changed successfully' }),
})

// ============================================================================
// Verification Schemas
// ============================================================================

/**
 * Email verification response schema
 */
export const verifyEmailResponseSchema = Schema.Struct({
  user: userSchema.annotate({ description: 'User with verified email' }),
})

/**
 * Send verification email response schema
 */
export const sendVerificationEmailResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({ description: 'Verification email sent' }),
})

// ============================================================================
// Admin Schemas
// ============================================================================

/**
 * Admin list users response schema
 */
export const adminListUsersResponseSchema = Schema.Struct({
  users: Schema.Array(userWithRoleSchema).annotate({ description: 'List of users' }),
  total: Schema.Finite.annotate({ description: 'Total user count' }),
  page: Schema.Finite.annotate({ description: 'Current page' }),
  limit: Schema.Finite.annotate({ description: 'Items per page' }),
})

/**
 * Admin get user response schema
 */
export const adminGetUserResponseSchema = Schema.Struct({
  user: describedRef(userWithRoleSchema, 'User details'),
})

/**
 * Admin update user response schema
 */
export const adminUpdateUserResponseSchema = Schema.Struct({
  user: describedRef(userWithRoleSchema, 'Updated user'),
})

/**
 * Admin delete user response schema
 */
export const adminDeleteUserResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({ description: 'User deleted' }),
})

/**
 * Admin ban user response schema
 */
export const adminBanUserResponseSchema = Schema.Struct({
  user: describedRef(userWithRoleSchema, 'Banned user'),
})

/**
 * Admin unban user response schema
 */
export const adminUnbanUserResponseSchema = Schema.Struct({
  user: describedRef(userWithRoleSchema, 'Unbanned user'),
})

/**
 * The invited account as returned by the invitation endpoints.
 *
 * Deliberately NOT {@link userWithRoleSchema}: an invited account is a
 * PLACEHOLDER until the invitation is accepted — it carries no credential
 * account row, so `emailVerified` / `banned` / `role` are not yet meaningful
 * facts about a person who can sign in. The invitation handlers return exactly
 * these three fields, and the catalogue must describe what ships rather than
 * what the sibling admin operations happen to return.
 */
const invitedUserSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Invited user id' }),
  email: email({ description: 'Invited email address' }),
  name: Schema.String.annotate({ description: 'Invited display name' }),
})

/**
 * Admin invite-user response schema.
 *
 * A Sovrium-owned Hono route, not a Better Auth plugin endpoint — which is
 * precisely why it was missing from the catalogue. An admin-issued invitation
 * is the ONLY onboarding path when `allowSignUp: false`, so an integrator who
 * cannot discover this endpoint cannot onboard anyone at all.
 */
export const adminInviteUserResponseSchema = Schema.Struct({
  user: invitedUserSchema.annotate({ description: 'The invited (placeholder) account' }),
  invitationSent: Schema.Literal(true).annotate({
    description: 'The invitation email was dispatched',
  }),
})

/**
 * Admin accept-invitation response schema.
 *
 * PUBLIC by design — the invitee arrives from an emailed link with no session,
 * so this path is exempt from the admin-plane guard. The response carries a
 * `Set-Cookie` session for the freshly-onboarded account; `sessionEstablished`
 * appears only on the soft-fail path where sign-in did not complete and the
 * customer must use the regular sign-in form.
 */
export const adminAcceptInvitationResponseSchema = Schema.Struct({
  user: invitedUserSchema.annotate({ description: 'The now-onboarded account' }),
  status: Schema.Literal('accepted').annotate({ description: 'Invitation acceptance outcome' }),
  sessionEstablished: optionalField(
    Schema.Boolean.annotate({
      description: 'Absent on success; false when the post-accept sign-in did not complete',
    })
  ),
})

// ============================================================================
// TypeScript Types
// ============================================================================

export type User = typeof userSchema.Type
export type UserWithRole = typeof userWithRoleSchema.Type
export type Session = typeof sessionSchema.Type
export type SessionWithUser = typeof sessionWithUserSchema.Type
export type SignInResponse = typeof signInResponseSchema.Type
export type SignUpResponse = typeof signUpResponseSchema.Type
export type SignOutResponse = typeof signOutResponseSchema.Type
export type GetSessionResponse = typeof getSessionResponseSchema.Type
export type ListSessionsResponse = typeof listSessionsResponseSchema.Type
