/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  betterAuthErrorSchema,
  errorResponseSchema,
  validationErrorResponseSchema,
} from '@/domain/models/api/_shared/error'
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
} from '@/domain/models/api/auth/auth'
import { type StaticGroupSpec, jsonResponse } from './_shared/route-spec'


const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)
const authError = (description: string) => jsonResponse(betterAuthErrorSchema, description)
const validationError = (description: string) =>
  jsonResponse(validationErrorResponseSchema, description)

export const authGroup: StaticGroupSpec = {
  tag: 'auth',
  tagDescription: 'Authentication and session endpoints',
  routes: [
    {
      method: 'post',
      pathTemplate: '/api/auth/sign-up/email',
      summary: 'Register a new user',
      description: 'Creates a new user account with email and password.',
      operationIdBase: 'postAuthSignUpEmail',
      responses: {
        200: jsonResponse(signUpResponseSchema, 'User registered successfully'),
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
        200: jsonResponse(signInResponseSchema, 'Sign-in successful'),
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
        200: jsonResponse(signOutResponseSchema, 'Signed out successfully'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/auth/session',
      summary: 'Get current session',
      description: 'Returns the current user session and user data.',
      operationIdBase: 'getAuthSession',
      responses: {
        200: jsonResponse(getSessionResponseSchema, 'Current session'),
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
        200: jsonResponse(listSessionsResponseSchema, 'List of sessions'),
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
        200: jsonResponse(revokeSessionResponseSchema, 'Session revoked'),
        401: authError('Not authenticated'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/auth/request-password-reset',
      summary: 'Request password reset',
      description: 'Sends a password reset email. Always returns 200 to prevent email enumeration.',
      operationIdBase: 'postAuthRequestPasswordReset',
      responses: {
        200: jsonResponse(
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
        200: jsonResponse(resetPasswordResponseSchema, 'Password reset successful'),
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
        200: jsonResponse(changePasswordResponseSchema, 'Password changed'),
        401: authError('Not authenticated'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/auth/verify-email',
      summary: 'Verify email address',
      description: 'Verifies the email address using a token.',
      operationIdBase: 'postAuthVerifyEmail',
      responses: {
        200: jsonResponse(verifyEmailResponseSchema, 'Email verified'),
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
        200: jsonResponse(sendVerificationEmailResponseSchema, 'Verification email sent'),
        401: authError('Not authenticated'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/auth/admin/list-users',
      summary: 'List all users (admin)',
      description:
        'Returns paginated list of all users with role information. Requires admin role.',
      operationIdBase: 'getAuthAdminListUsers',
      responses: {
        200: jsonResponse(adminListUsersResponseSchema, 'List of users'),
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
        200: jsonResponse(adminGetUserResponseSchema, 'User details'),
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
        200: jsonResponse(adminUpdateUserResponseSchema, 'User created'),
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
        200: jsonResponse(adminUpdateUserResponseSchema, 'User updated'),
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
        200: jsonResponse(adminDeleteUserResponseSchema, 'User deleted'),
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
        200: jsonResponse(adminBanUserResponseSchema, 'User banned'),
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
        200: jsonResponse(adminUnbanUserResponseSchema, 'User unbanned'),
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
        200: jsonResponse(adminUpdateUserResponseSchema, 'Role updated'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('User not found'),
      },
    },
  ],
}
