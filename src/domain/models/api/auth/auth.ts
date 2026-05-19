/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { timestampSchema } from '../_shared/common'


export const userSchema = z
  .object({
    id: z.string().describe('Unique user identifier'),
    email: z.email().describe('User email address'),
    name: z.string().nullable().describe('User display name'),
    image: z.url().nullable().optional().describe('User avatar URL'),
    emailVerified: z.boolean().describe('Whether email is verified'),
  })
  .extend(timestampSchema.shape)

export const userWithRoleSchema = userSchema
  .extend({
    role: z.enum(['admin', 'member', 'viewer']).describe('User role'),
    banned: z.boolean().optional().describe('Whether user is banned'),
    banReason: z.string().nullable().optional().describe('Reason for ban'),
    banExpiresAt: z.iso.datetime().nullable().optional().describe('Ban expiration'),
  })
  .openapi('UserWithRole')


export const sessionSchema = z
  .object({
    id: z.string().describe('Session identifier'),
    userId: z.string().describe('User ID this session belongs to'),
    token: z.string().describe('Session token'),
    expiresAt: z.iso.datetime().describe('Session expiration timestamp'),
    ipAddress: z.string().nullable().optional().describe('IP address of session'),
    userAgent: z.string().nullable().optional().describe('User agent string'),
  })
  .extend(timestampSchema.shape)

export const sessionWithUserSchema = z
  .object({
    session: sessionSchema,
    user: userSchema,
  })
  .openapi('SessionWithUser')


export const signInResponseSchema = z.object({
  user: userSchema.describe('Authenticated user data'),
  session: sessionSchema.describe('New session data'),
  token: z.string().optional().describe('Bearer token for API calls'),
})

export const signUpResponseSchema = z.object({
  user: userSchema.describe('Newly created user data'),
  session: sessionSchema.optional().describe('Session if auto-login enabled'),
  token: z.string().optional().describe('Bearer token if auto-login enabled'),
})

export const signOutResponseSchema = z.object({
  success: z.literal(true).describe('Sign-out succeeded'),
})

export const getSessionResponseSchema = sessionWithUserSchema.openapi('GetSessionResponse')

export const listSessionsResponseSchema = z.object({
  sessions: z.array(sessionSchema).describe('List of active sessions'),
})

export const revokeSessionResponseSchema = z.object({
  success: z.literal(true).describe('Session revoked successfully'),
})


export const forgotPasswordResponseSchema = z.object({
  success: z.literal(true).describe('Password reset email sent'),
})

export const resetPasswordResponseSchema = z.object({
  success: z.literal(true).describe('Password reset successful'),
})

export const changePasswordResponseSchema = z.object({
  success: z.literal(true).describe('Password changed successfully'),
})


export const verifyEmailResponseSchema = z.object({
  user: userSchema.describe('User with verified email'),
})

export const sendVerificationEmailResponseSchema = z.object({
  success: z.literal(true).describe('Verification email sent'),
})


export const adminListUsersResponseSchema = z.object({
  users: z.array(userWithRoleSchema).describe('List of users'),
  total: z.number().describe('Total user count'),
  page: z.number().describe('Current page'),
  limit: z.number().describe('Items per page'),
})

export const adminGetUserResponseSchema = z.object({
  user: userWithRoleSchema.describe('User details'),
})

export const adminUpdateUserResponseSchema = z.object({
  user: userWithRoleSchema.describe('Updated user'),
})

export const adminDeleteUserResponseSchema = z.object({
  success: z.literal(true).describe('User deleted'),
})

export const adminBanUserResponseSchema = z.object({
  user: userWithRoleSchema.describe('Banned user'),
})

export const adminUnbanUserResponseSchema = z.object({
  user: userWithRoleSchema.describe('Unbanned user'),
})


export type User = z.infer<typeof userSchema>
export type UserWithRole = z.infer<typeof userWithRoleSchema>
export type Session = z.infer<typeof sessionSchema>
export type SessionWithUser = z.infer<typeof sessionWithUserSchema>
export type SignInResponse = z.infer<typeof signInResponseSchema>
export type SignUpResponse = z.infer<typeof signUpResponseSchema>
export type SignOutResponse = z.infer<typeof signOutResponseSchema>
export type GetSessionResponse = z.infer<typeof getSessionResponseSchema>
export type ListSessionsResponse = z.infer<typeof listSessionsResponseSchema>
