/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  adminAcceptInvitationResponseSchema,
  adminBanUserResponseSchema,
  adminDeleteUserResponseSchema,
  adminGetUserResponseSchema,
  adminInviteUserResponseSchema,
  adminListUsersResponseSchema,
  adminUnbanUserResponseSchema,
  adminUpdateUserResponseSchema,
  changePasswordResponseSchema,
  forgotPasswordResponseSchema,
  getSessionResponseSchema,
  listSessionsResponseSchema,
  resetPasswordResponseSchema,
  revokeSessionResponseSchema,
  sendVerificationEmailResponseSchema,
  signInResponseSchema,
  signOutResponseSchema,
  signUpResponseSchema,
  verifyEmailResponseSchema,
} from '@/domain/models/api/auth/auth'
import {
  betterAuthErrorSchema,
  errorResponseSchema,
  validationErrorResponseSchema,
} from '@/domain/models/api/combinators/error'
import { effectJsonResponse } from '@/presentation/api/openapi/route-fragments'
import { type StaticGroupSpec } from '../openapi/route-spec'

/**
 * Authentication route group.
 *
 * These route definitions mirror Better Auth's runtime endpoints but use our
 * Zod schemas with `.openapi('Name')` annotations, producing named
 * `components/schemas` entries with `$ref` references instead of inline
 * duplication. During the export merge, these definitions take precedence
 * over Better Auth's auto-generated ones for overlapping paths.
 */

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)
const authError = (description: string) => effectJsonResponse(betterAuthErrorSchema, description)
const validationError = (description: string) =>
  effectJsonResponse(validationErrorResponseSchema, description)

export const authGroup: StaticGroupSpec = {
  tag: 'Auth',
  tagDescription: 'Authentication and session endpoints',
  routes: [
    // --- Core auth ---
    {
      method: 'post',
      pathTemplate: '/api/auth/sign-up/email',
      summary: 'Register a new user',
      description: 'Creates a new user account with email and password.',
      operationIdBase: 'postAuthSignUpEmail',
      responses: {
        200: effectJsonResponse(signUpResponseSchema, 'User registered successfully'),
        400: validationError('Validation error'),
        429: errorResponse('Rate limited'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/auth/sign-in/email',
      summary: 'Sign in with email and password',
      description: 'Authenticates a user and creates a new session.',
      operationIdBase: 'postAuthSignInEmail',
      responses: {
        200: effectJsonResponse(signInResponseSchema, 'Sign-in successful'),
        401: authError('Invalid credentials'),
        429: errorResponse('Rate limited'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/auth/sign-out',
      summary: 'Sign out current session',
      description: 'Invalidates the current session.',
      operationIdBase: 'postAuthSignOut',
      responses: {
        200: effectJsonResponse(signOutResponseSchema, 'Signed out successfully'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/auth/session',
      summary: 'Get current session',
      description: 'Returns the current user session and user data.',
      operationIdBase: 'getAuthSession',
      responses: {
        200: effectJsonResponse(getSessionResponseSchema, 'Current session'),
        401: authError('Not authenticated'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/auth/list-sessions',
      summary: 'List all user sessions',
      description: 'Returns all active sessions for the authenticated user.',
      operationIdBase: 'getAuthListSessions',
      responses: {
        200: effectJsonResponse(listSessionsResponseSchema, 'List of sessions'),
        401: authError('Not authenticated'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/auth/revoke-session',
      summary: 'Revoke a specific session',
      description: 'Invalidates a specific session by token.',
      operationIdBase: 'postAuthRevokeSession',
      responses: {
        200: effectJsonResponse(revokeSessionResponseSchema, 'Session revoked'),
        401: authError('Not authenticated'),
      },
    },
    // --- Password management ---
    {
      method: 'post',
      pathTemplate: '/api/auth/request-password-reset',
      summary: 'Request password reset',
      description: 'Sends a password reset email. Always returns 200 to prevent email enumeration.',
      operationIdBase: 'postAuthRequestPasswordReset',
      responses: {
        200: effectJsonResponse(
          forgotPasswordResponseSchema,
          'Reset email sent (or silently ignored if email not found)'
        ),
        429: errorResponse('Rate limited'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/auth/reset-password',
      summary: 'Reset password with token',
      description: 'Resets the password using a token from the reset email.',
      operationIdBase: 'postAuthResetPassword',
      responses: {
        200: effectJsonResponse(resetPasswordResponseSchema, 'Password reset successful'),
        400: authError('Invalid or expired token'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/auth/change-password',
      summary: 'Change password',
      description: 'Changes the password for the authenticated user.',
      operationIdBase: 'postAuthChangePassword',
      responses: {
        200: effectJsonResponse(changePasswordResponseSchema, 'Password changed'),
        401: authError('Not authenticated'),
      },
    },
    // --- Email verification ---
    {
      method: 'post',
      pathTemplate: '/api/auth/verify-email',
      summary: 'Verify email address',
      description: 'Verifies the email address using a token.',
      operationIdBase: 'postAuthVerifyEmail',
      responses: {
        200: effectJsonResponse(verifyEmailResponseSchema, 'Email verified'),
        400: authError('Invalid or expired token'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/auth/send-verification-email',
      summary: 'Resend verification email',
      description: 'Sends a new verification email to the authenticated user.',
      operationIdBase: 'postAuthSendVerificationEmail',
      responses: {
        200: effectJsonResponse(sendVerificationEmailResponseSchema, 'Verification email sent'),
        401: authError('Not authenticated'),
      },
    },
    // --- Admin ---
    {
      method: 'get',
      pathTemplate: '/api/auth/admin/list-users',
      summary: 'List all users (admin)',
      description:
        'Returns paginated list of all users with role information. Requires admin role.',
      operationIdBase: 'getAuthAdminListUsers',
      responses: {
        200: effectJsonResponse(adminListUsersResponseSchema, 'List of users'),
        401: errorResponse('Not authenticated'),
        403: errorResponse('Not authorized (admin required)'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/auth/admin/get-user',
      summary: 'Get user details (admin)',
      description: 'Returns detailed user information including role and ban status.',
      operationIdBase: 'getAuthAdminGetUser',
      responses: {
        200: effectJsonResponse(adminGetUserResponseSchema, 'User details'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('User not found'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/auth/admin/create-user',
      summary: 'Create user (admin)',
      description: 'Creates a new user account. Password must be 8-128 characters.',
      operationIdBase: 'postAuthAdminCreateUser',
      responses: {
        200: effectJsonResponse(adminUpdateUserResponseSchema, 'User created'),
        400: validationError('Validation error'),
        401: errorResponse('Not authenticated'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/auth/admin/update-user',
      summary: 'Update user (admin)',
      description: 'Updates user details including name, email, and role.',
      operationIdBase: 'postAuthAdminUpdateUser',
      responses: {
        200: effectJsonResponse(adminUpdateUserResponseSchema, 'User updated'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('User not found'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/auth/admin/delete-user',
      summary: 'Delete user (admin)',
      description: 'Permanently deletes a user account.',
      operationIdBase: 'postAuthAdminDeleteUser',
      responses: {
        200: effectJsonResponse(adminDeleteUserResponseSchema, 'User deleted'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('User not found'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/auth/admin/ban-user',
      summary: 'Ban user (admin)',
      description: 'Bans a user with an optional reason and expiration.',
      operationIdBase: 'postAuthAdminBanUser',
      responses: {
        200: effectJsonResponse(adminBanUserResponseSchema, 'User banned'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('User not found'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/auth/admin/unban-user',
      summary: 'Unban user (admin)',
      description: 'Removes ban from a user account.',
      operationIdBase: 'postAuthAdminUnbanUser',
      responses: {
        200: effectJsonResponse(adminUnbanUserResponseSchema, 'User unbanned'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('User not found'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/auth/admin/set-role',
      summary: 'Set user role (admin)',
      description: 'Changes a user role to admin or user.',
      operationIdBase: 'postAuthAdminSetRole',
      responses: {
        200: effectJsonResponse(adminUpdateUserResponseSchema, 'Role updated'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('User not found'),
      },
    },
    // --- Admin invitations (Sovrium-owned Hono routes) ---
    //
    // These two are NOT Better Auth plugin endpoints — they live in
    // `admin-invitation-routes.ts` because Better Auth has no first-class
    // admin-driven invitation matching Sovrium's "1 app = 1 organization" model.
    // Better Auth's own OpenAPI plugin therefore cannot see them, which is
    // exactly why they were absent from the catalogue while every sibling admin
    // operation was present. Since an admin invitation is the ONLY onboarding
    // path when `allowSignUp: false`, that gap hid the endpoint an integrator's
    // whole onboarding flow depends on.
    {
      method: 'post',
      pathTemplate: '/api/auth/admin/invite-user',
      summary: 'Invite user (admin)',
      description:
        'Issues a passwordless invitation: creates a placeholder account, mints a ' +
        'single-use token, and emails the invitee an activation link. The role must ' +
        'be assignable for this app. Unaffected by `allowSignUp: false` — an admin ' +
        'invitation remains the onboarding path when self-signup is disabled.',
      operationIdBase: 'postAuthAdminInviteUser',
      responses: {
        200: effectJsonResponse(adminInviteUserResponseSchema, 'Invitation issued'),
        400: validationError('Invalid email, name, or a role this app does not know'),
        401: errorResponse('Not authenticated'),
        // 404, not 403: a caller who is not admin-equivalent is refused with the
        // anti-enumeration 404 (S1), so the endpoint's existence is not
        // discoverable to them.
        404: errorResponse('Not found (caller is not admin-equivalent)'),
        422: errorResponse('Email already maps to a fully-onboarded user'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/auth/admin/accept-invitation',
      summary: 'Accept an admin invitation',
      description:
        'PUBLIC — the invitee arrives from an emailed link with no session. Validates ' +
        'the single-use token, sets the account password, marks the email verified, ' +
        'consumes the token, and signs the customer in (the response carries the ' +
        'session cookie).',
      operationIdBase: 'postAuthAdminAcceptInvitation',
      responses: {
        200: effectJsonResponse(adminAcceptInvitationResponseSchema, 'Invitation accepted'),
        400: validationError('Invalid input, or an unknown / already-consumed token'),
        410: errorResponse('Invitation token expired'),
      },
    },
  ],
}
