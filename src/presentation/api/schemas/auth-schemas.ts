/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'
import { timestampSchema } from './common-schemas'

// ============================================================================
// User Schemas
// ============================================================================

/**
 * User schema
 *
 * Represents a user in API responses.
 * Based on Better Auth user model.
 */
export const userSchema = z
  .object({
    id: z.string().describe('Unique user identifier'),
    email: z.email().describe('User email address'),
    name: z.string().nullable().describe('User display name'),
    image: z.url().nullable().optional().describe('User avatar URL'),
    emailVerified: z.boolean().describe('Whether email is verified'),
  })
  .merge(timestampSchema)

/**
 * User with role schema (for admin endpoints)
 */
export const userWithRoleSchema = userSchema.extend({
  role: z.enum(['user', 'admin']).describe('User role'),
  banned: z.boolean().optional().describe('Whether user is banned'),
  banReason: z.string().nullable().optional().describe('Reason for ban'),
  banExpiresAt: z.iso.datetime().nullable().optional().describe('Ban expiration'),
})

// ============================================================================
// Session Schemas
// ============================================================================

/**
 * Session schema
 *
 * Represents an authentication session.
 */
export const sessionSchema = z
  .object({
    id: z.string().describe('Session identifier'),
    userId: z.string().describe('User ID this session belongs to'),
    token: z.string().describe('Session token'),
    expiresAt: z.iso.datetime().describe('Session expiration timestamp'),
    ipAddress: z.string().nullable().optional().describe('IP address of session'),
    userAgent: z.string().nullable().optional().describe('User agent string'),
  })
  .merge(timestampSchema)

/**
 * Session with user schema
 */
export const sessionWithUserSchema = z.object({
  session: sessionSchema,
  user: userSchema,
})

// ============================================================================
// Auth Response Schemas
// ============================================================================

/**
 * Sign-in response schema
 *
 * Returned on successful email/password sign-in.
 */
export const signInResponseSchema = z.object({
  user: userSchema.describe('Authenticated user data'),
  session: sessionSchema.describe('New session data'),
  token: z.string().optional().describe('Bearer token for API calls'),
})

/**
 * Sign-up response schema
 *
 * Returned on successful user registration.
 */
export const signUpResponseSchema = z.object({
  user: userSchema.describe('Newly created user data'),
  session: sessionSchema.optional().describe('Session if auto-login enabled'),
  token: z.string().optional().describe('Bearer token if auto-login enabled'),
})

/**
 * Sign-out response schema
 */
export const signOutResponseSchema = z.object({
  success: z.literal(true).describe('Sign-out succeeded'),
})

/**
 * Session response schema
 *
 * Returned when fetching current session.
 */
export const getSessionResponseSchema = sessionWithUserSchema

/**
 * List sessions response schema
 */
export const listSessionsResponseSchema = z.object({
  sessions: z.array(sessionSchema).describe('List of active sessions'),
})

/**
 * Revoke session response schema
 */
export const revokeSessionResponseSchema = z.object({
  success: z.literal(true).describe('Session revoked successfully'),
})

// ============================================================================
// Password Schemas
// ============================================================================

/**
 * Password reset request response schema
 */
export const forgotPasswordResponseSchema = z.object({
  success: z.literal(true).describe('Password reset email sent'),
})

/**
 * Password reset response schema
 */
export const resetPasswordResponseSchema = z.object({
  success: z.literal(true).describe('Password reset successful'),
})

/**
 * Change password response schema
 */
export const changePasswordResponseSchema = z.object({
  success: z.literal(true).describe('Password changed successfully'),
})

// ============================================================================
// Verification Schemas
// ============================================================================

/**
 * Email verification response schema
 */
export const verifyEmailResponseSchema = z.object({
  user: userSchema.describe('User with verified email'),
})

/**
 * Send verification email response schema
 */
export const sendVerificationEmailResponseSchema = z.object({
  success: z.literal(true).describe('Verification email sent'),
})

// ============================================================================
// Admin Schemas
// ============================================================================

/**
 * Admin list users response schema
 */
export const adminListUsersResponseSchema = z.object({
  users: z.array(userWithRoleSchema).describe('List of users'),
  total: z.number().describe('Total user count'),
  page: z.number().describe('Current page'),
  limit: z.number().describe('Items per page'),
})

/**
 * Admin get user response schema
 */
export const adminGetUserResponseSchema = z.object({
  user: userWithRoleSchema.describe('User details'),
})

/**
 * Admin update user response schema
 */
export const adminUpdateUserResponseSchema = z.object({
  user: userWithRoleSchema.describe('Updated user'),
})

/**
 * Admin delete user response schema
 */
export const adminDeleteUserResponseSchema = z.object({
  success: z.literal(true).describe('User deleted'),
})

/**
 * Admin ban user response schema
 */
export const adminBanUserResponseSchema = z.object({
  user: userWithRoleSchema.describe('Banned user'),
})

/**
 * Admin unban user response schema
 */
export const adminUnbanUserResponseSchema = z.object({
  user: userWithRoleSchema.describe('Unbanned user'),
})

// ============================================================================
// Organization Schemas
// ============================================================================

/**
 * Organization schema
 */
export const organizationSchema = z
  .object({
    id: z.string().describe('Organization identifier'),
    name: z.string().describe('Organization name'),
    slug: z.string().describe('URL-friendly slug'),
    logo: z.url().nullable().optional().describe('Organization logo URL'),
  })
  .merge(timestampSchema)

/**
 * Organization member schema
 */
export const organizationMemberSchema = z.object({
  id: z.string().describe('Member record ID'),
  userId: z.string().describe('User ID'),
  organizationId: z.string().describe('Organization ID'),
  role: z.enum(['owner', 'admin', 'member']).describe('Member role'),
  createdAt: z.iso.datetime().describe('Join timestamp'),
  user: userSchema.optional().describe('User details'),
})

/**
 * Organization invitation schema
 */
export const organizationInvitationSchema = z.object({
  id: z.string().describe('Invitation ID'),
  email: z.email().describe('Invited email'),
  organizationId: z.string().describe('Organization ID'),
  role: z.enum(['admin', 'member']).describe('Invited role'),
  status: z.enum(['pending', 'accepted', 'rejected', 'expired']).describe('Invitation status'),
  expiresAt: z.iso.datetime().describe('Expiration timestamp'),
  createdAt: z.iso.datetime().describe('Creation timestamp'),
})

/**
 * Create organization response schema
 */
export const createOrganizationResponseSchema = z.object({
  organization: organizationSchema.describe('Created organization'),
})

/**
 * Get organization response schema
 */
export const getOrganizationResponseSchema = z.object({
  organization: organizationSchema.describe('Organization details'),
})

/**
 * List organizations response schema
 */
export const listOrganizationsResponseSchema = z.object({
  organizations: z.array(organizationSchema).describe('User organizations'),
})

/**
 * Update organization response schema
 */
export const updateOrganizationResponseSchema = z.object({
  organization: organizationSchema.describe('Updated organization'),
})

/**
 * Delete organization response schema
 */
export const deleteOrganizationResponseSchema = z.object({
  success: z.literal(true).describe('Organization deleted'),
})

/**
 * List organization members response schema
 */
export const listOrganizationMembersResponseSchema = z.object({
  members: z.array(organizationMemberSchema).describe('Organization members'),
})

/**
 * Add organization member response schema
 */
export const addOrganizationMemberResponseSchema = z.object({
  member: organizationMemberSchema.describe('Added member'),
})

/**
 * Remove organization member response schema
 */
export const removeOrganizationMemberResponseSchema = z.object({
  success: z.literal(true).describe('Member removed'),
})

/**
 * Update member role response schema
 */
export const updateMemberRoleResponseSchema = z.object({
  member: organizationMemberSchema.describe('Updated member'),
})

/**
 * Invite member response schema
 */
export const inviteMemberResponseSchema = z.object({
  invitation: organizationInvitationSchema.describe('Created invitation'),
})

/**
 * Accept invitation response schema
 */
export const acceptInvitationResponseSchema = z.object({
  member: organizationMemberSchema.describe('New member'),
})

/**
 * List invitations response schema
 */
export const listInvitationsResponseSchema = z.object({
  invitations: z.array(organizationInvitationSchema).describe('Pending invitations'),
})

/**
 * Cancel invitation response schema
 */
export const cancelInvitationResponseSchema = z.object({
  success: z.literal(true).describe('Invitation cancelled'),
})

// ============================================================================
// TypeScript Types
// ============================================================================

export type User = z.infer<typeof userSchema>
export type UserWithRole = z.infer<typeof userWithRoleSchema>
export type Session = z.infer<typeof sessionSchema>
export type SessionWithUser = z.infer<typeof sessionWithUserSchema>
export type SignInResponse = z.infer<typeof signInResponseSchema>
export type SignUpResponse = z.infer<typeof signUpResponseSchema>
export type SignOutResponse = z.infer<typeof signOutResponseSchema>
export type GetSessionResponse = z.infer<typeof getSessionResponseSchema>
export type ListSessionsResponse = z.infer<typeof listSessionsResponseSchema>
export type Organization = z.infer<typeof organizationSchema>
export type OrganizationMember = z.infer<typeof organizationMemberSchema>
export type OrganizationInvitation = z.infer<typeof organizationInvitationSchema>
