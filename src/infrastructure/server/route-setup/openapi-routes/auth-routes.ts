/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type OpenAPIHono, createRoute } from '@hono/zod-openapi'
import {
  adminBanUserResponseSchema,
  adminDeleteUserResponseSchema,
  adminGetUserResponseSchema,
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
} from '@/domain/models/api/auth'
import {
  betterAuthErrorSchema,
  errorResponseSchema,
  validationErrorResponseSchema,
} from '@/domain/models/api/error'

/**
 * Register authentication routes for OpenAPI schema generation
 *
 * These route definitions mirror Better Auth's runtime endpoints but use
 * our Zod schemas with `.openapi('Name')` annotations, producing named
 * `components/schemas` entries with `$ref` references instead of inline
 * duplication. During the export merge, these definitions take precedence
 * over Better Auth's auto-generated ones for overlapping paths.
 */
export function registerAuthRoutes(app: OpenAPIHono): void {
  // ========================================================================
  // Core Auth Endpoints
  // ========================================================================

  // POST /api/auth/sign-up/email
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/auth/sign-up/email',
      summary: 'Register a new user',
      description: 'Creates a new user account with email and password.',
      operationId: 'postAuthSignUpEmail',
      tags: ['auth'],
      responses: {
        200: {
          content: { 'application/json': { schema: signUpResponseSchema } },
          description: 'User registered successfully',
        },
        400: {
          content: { 'application/json': { schema: validationErrorResponseSchema } },
          description: 'Validation error',
        },
        429: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Rate limited',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // POST /api/auth/sign-in/email
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/auth/sign-in/email',
      summary: 'Sign in with email and password',
      description: 'Authenticates a user and creates a new session.',
      operationId: 'postAuthSignInEmail',
      tags: ['auth'],
      responses: {
        200: {
          content: { 'application/json': { schema: signInResponseSchema } },
          description: 'Sign-in successful',
        },
        401: {
          content: { 'application/json': { schema: betterAuthErrorSchema } },
          description: 'Invalid credentials',
        },
        429: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Rate limited',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // POST /api/auth/sign-out
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/auth/sign-out',
      summary: 'Sign out current session',
      description: 'Invalidates the current session.',
      operationId: 'postAuthSignOut',
      tags: ['auth'],
      responses: {
        200: {
          content: { 'application/json': { schema: signOutResponseSchema } },
          description: 'Signed out successfully',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // GET /api/auth/session
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/auth/session',
      summary: 'Get current session',
      description: 'Returns the current user session and user data.',
      operationId: 'getAuthSession',
      tags: ['auth'],
      responses: {
        200: {
          content: { 'application/json': { schema: getSessionResponseSchema } },
          description: 'Current session',
        },
        401: {
          content: { 'application/json': { schema: betterAuthErrorSchema } },
          description: 'Not authenticated',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // GET /api/auth/list-sessions
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/auth/list-sessions',
      summary: 'List all user sessions',
      description: 'Returns all active sessions for the authenticated user.',
      operationId: 'getAuthListSessions',
      tags: ['auth'],
      responses: {
        200: {
          content: { 'application/json': { schema: listSessionsResponseSchema } },
          description: 'List of sessions',
        },
        401: {
          content: { 'application/json': { schema: betterAuthErrorSchema } },
          description: 'Not authenticated',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // POST /api/auth/revoke-session
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/auth/revoke-session',
      summary: 'Revoke a specific session',
      description: 'Invalidates a specific session by token.',
      operationId: 'postAuthRevokeSession',
      tags: ['auth'],
      responses: {
        200: {
          content: { 'application/json': { schema: revokeSessionResponseSchema } },
          description: 'Session revoked',
        },
        401: {
          content: { 'application/json': { schema: betterAuthErrorSchema } },
          description: 'Not authenticated',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // ========================================================================
  // Password Management
  // ========================================================================

  // POST /api/auth/request-password-reset
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/auth/request-password-reset',
      summary: 'Request password reset',
      description: 'Sends a password reset email. Always returns 200 to prevent email enumeration.',
      operationId: 'postAuthRequestPasswordReset',
      tags: ['auth'],
      responses: {
        200: {
          content: { 'application/json': { schema: forgotPasswordResponseSchema } },
          description: 'Reset email sent (or silently ignored if email not found)',
        },
        429: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Rate limited',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // POST /api/auth/reset-password
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/auth/reset-password',
      summary: 'Reset password with token',
      description: 'Resets the password using a token from the reset email.',
      operationId: 'postAuthResetPassword',
      tags: ['auth'],
      responses: {
        200: {
          content: { 'application/json': { schema: resetPasswordResponseSchema } },
          description: 'Password reset successful',
        },
        400: {
          content: { 'application/json': { schema: betterAuthErrorSchema } },
          description: 'Invalid or expired token',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // POST /api/auth/change-password
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/auth/change-password',
      summary: 'Change password',
      description: 'Changes the password for the authenticated user.',
      operationId: 'postAuthChangePassword',
      tags: ['auth'],
      responses: {
        200: {
          content: { 'application/json': { schema: changePasswordResponseSchema } },
          description: 'Password changed',
        },
        401: {
          content: { 'application/json': { schema: betterAuthErrorSchema } },
          description: 'Not authenticated',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // ========================================================================
  // Email Verification
  // ========================================================================

  // POST /api/auth/verify-email
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/auth/verify-email',
      summary: 'Verify email address',
      description: 'Verifies the email address using a token.',
      operationId: 'postAuthVerifyEmail',
      tags: ['auth'],
      responses: {
        200: {
          content: { 'application/json': { schema: verifyEmailResponseSchema } },
          description: 'Email verified',
        },
        400: {
          content: { 'application/json': { schema: betterAuthErrorSchema } },
          description: 'Invalid or expired token',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // POST /api/auth/send-verification-email
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/auth/send-verification-email',
      summary: 'Resend verification email',
      description: 'Sends a new verification email to the authenticated user.',
      operationId: 'postAuthSendVerificationEmail',
      tags: ['auth'],
      responses: {
        200: {
          content: { 'application/json': { schema: sendVerificationEmailResponseSchema } },
          description: 'Verification email sent',
        },
        401: {
          content: { 'application/json': { schema: betterAuthErrorSchema } },
          description: 'Not authenticated',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // ========================================================================
  // Admin Endpoints
  // ========================================================================

  // GET /api/auth/admin/list-users
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/auth/admin/list-users',
      summary: 'List all users (admin)',
      description:
        'Returns paginated list of all users with role information. Requires admin role.',
      operationId: 'getAuthAdminListUsers',
      tags: ['auth'],
      responses: {
        200: {
          content: { 'application/json': { schema: adminListUsersResponseSchema } },
          description: 'List of users',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Not authenticated',
        },
        403: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Not authorized (admin required)',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // GET /api/auth/admin/get-user
  app.openapi(
    createRoute({
      method: 'get',
      path: '/api/auth/admin/get-user',
      summary: 'Get user details (admin)',
      description: 'Returns detailed user information including role and ban status.',
      operationId: 'getAuthAdminGetUser',
      tags: ['auth'],
      responses: {
        200: {
          content: { 'application/json': { schema: adminGetUserResponseSchema } },
          description: 'User details',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Not authenticated',
        },
        404: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'User not found',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // POST /api/auth/admin/create-user
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/auth/admin/create-user',
      summary: 'Create user (admin)',
      description: 'Creates a new user account. Password must be 8-128 characters.',
      operationId: 'postAuthAdminCreateUser',
      tags: ['auth'],
      responses: {
        200: {
          content: { 'application/json': { schema: adminUpdateUserResponseSchema } },
          description: 'User created',
        },
        400: {
          content: { 'application/json': { schema: validationErrorResponseSchema } },
          description: 'Validation error',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Not authenticated',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // POST /api/auth/admin/update-user
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/auth/admin/update-user',
      summary: 'Update user (admin)',
      description: 'Updates user details including name, email, and role.',
      operationId: 'postAuthAdminUpdateUser',
      tags: ['auth'],
      responses: {
        200: {
          content: { 'application/json': { schema: adminUpdateUserResponseSchema } },
          description: 'User updated',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Not authenticated',
        },
        404: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'User not found',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // POST /api/auth/admin/delete-user
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/auth/admin/delete-user',
      summary: 'Delete user (admin)',
      description: 'Permanently deletes a user account.',
      operationId: 'postAuthAdminDeleteUser',
      tags: ['auth'],
      responses: {
        200: {
          content: { 'application/json': { schema: adminDeleteUserResponseSchema } },
          description: 'User deleted',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Not authenticated',
        },
        404: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'User not found',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // POST /api/auth/admin/ban-user
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/auth/admin/ban-user',
      summary: 'Ban user (admin)',
      description: 'Bans a user with an optional reason and expiration.',
      operationId: 'postAuthAdminBanUser',
      tags: ['auth'],
      responses: {
        200: {
          content: { 'application/json': { schema: adminBanUserResponseSchema } },
          description: 'User banned',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Not authenticated',
        },
        404: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'User not found',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // POST /api/auth/admin/unban-user
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/auth/admin/unban-user',
      summary: 'Unban user (admin)',
      description: 'Removes ban from a user account.',
      operationId: 'postAuthAdminUnbanUser',
      tags: ['auth'],
      responses: {
        200: {
          content: { 'application/json': { schema: adminUnbanUserResponseSchema } },
          description: 'User unbanned',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Not authenticated',
        },
        404: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'User not found',
        },
      },
    }),
    (c) => c.json({} as never)
  )

  // POST /api/auth/admin/set-role
  app.openapi(
    createRoute({
      method: 'post',
      path: '/api/auth/admin/set-role',
      summary: 'Set user role (admin)',
      description: 'Changes a user role to admin or user.',
      operationId: 'postAuthAdminSetRole',
      tags: ['auth'],
      responses: {
        200: {
          content: { 'application/json': { schema: adminUpdateUserResponseSchema } },
          description: 'Role updated',
        },
        401: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'Not authenticated',
        },
        404: {
          content: { 'application/json': { schema: errorResponseSchema } },
          description: 'User not found',
        },
      },
    }),
    (c) => c.json({} as never)
  )
}
