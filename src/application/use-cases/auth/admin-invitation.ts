/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolvePasswordPolicy } from '@/domain/utils/auth/password-policy'
import { isValidEmail } from '@/domain/utils/email-validation'
import { parseDuration } from '@/domain/utils/parse-duration'
import {
  deleteCredentialAccountForUser,
  deletePendingInvitationsForUser,
  deleteInvitationToken,
  findInvitationToken,
  findUserByEmail,
  findUserById,
  insertCredentialAccount,
  insertInvitationToken,
  markUserEmailVerified,
  userHasCredentialPassword,
} from '@/infrastructure/auth/better-auth/invitation-queries'
import { logError } from '@/infrastructure/logging/logger'
import type { Auth } from '@/domain/models/app/auth'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { createEmailHandlers } from '@/infrastructure/auth/better-auth/email-handlers'

const DEFAULT_EXPIRY_MS = 72 * 60 * 60 * 1000

export const resolveInvitationExpiryMs = (authConfig?: Auth): number => {
  const raw = authConfig?.invitationTokenExpiry
  if (raw === undefined) return DEFAULT_EXPIRY_MS
  if (typeof raw === 'number') return raw
  const parsed = parseDuration(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_EXPIRY_MS
}

const generateInvitationToken = (): string => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const base64 = Buffer.from(bytes).toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const buildAcceptInvitationUrl = (baseURL: string, token: string): string => {
  const trimmed = baseURL.replace(/\/$/, '')
  return `${trimmed}/accept-invitation?token=${token}`
}

export interface InviteUserSuccess {
  readonly status: 'invited'
  readonly user: {
    readonly id: string
    readonly email: string
    readonly name: string
  }
  readonly token: string
}

export interface InviteUserFailure {
  readonly status: 'already-onboarded' | 'invalid-input' | 'internal-error'
  readonly message: string
}

export type InviteUserResult = InviteUserSuccess | InviteUserFailure

const validateInviteInput = (body: {
  readonly email?: unknown
  readonly name?: unknown
  readonly role?: unknown
  readonly password?: unknown
}):
  { readonly email: string; readonly name: string; readonly role: string } | InviteUserFailure => {
  if (typeof body.email !== 'string' || body.email.trim().length === 0) {
    return { status: 'invalid-input', message: 'email is required' }
  }
  const email = body.email.trim().toLowerCase()
  if (!isValidEmail(email)) {
    return { status: 'invalid-input', message: 'email must be a valid email address' }
  }
  if (typeof body.name !== 'string' || body.name.trim().length === 0) {
    return { status: 'invalid-input', message: 'name is required' }
  }
  if (typeof body.role !== 'string' || body.role.trim().length === 0) {
    return { status: 'invalid-input', message: 'role is required' }
  }
  if (body.password !== undefined) {
    return {
      status: 'invalid-input',
      message: 'password is not accepted for invitations; the customer sets their own',
    }
  }
  return { email, name: body.name.trim(), role: body.role.trim() }
}

type AuthInstance = Readonly<ReturnType<typeof createAuthInstance>>
type EmailHandlers = Readonly<ReturnType<typeof createEmailHandlers>>

const findOrCreateInvitedUser = async (
  authInstance: AuthInstance,
  input: { readonly email: string; readonly name: string; readonly role: string }
): Promise<
  | {
      readonly outcome: 'ready'
      readonly user: { readonly id: string; readonly email: string; readonly name: string }
    }
  | InviteUserFailure
> => {
  const existing = await findUserByEmail(input.email)

  if (existing) {
    if (await userHasCredentialPassword(existing.id)) {
      return {
        status: 'already-onboarded',
        message:
          'A user with this email already exists and has completed onboarding. Use the password reset flow instead.',
      }
    }
    await deletePendingInvitationsForUser(existing.id)
    return { outcome: 'ready', user: existing }
  }

  const throwaway = `${crypto.randomUUID()}${crypto.randomUUID()}`.slice(0, 100)
  const createdUserId = await createPlaceholderUser(authInstance, input, throwaway)
  if (!createdUserId) {
    return { status: 'internal-error', message: 'Failed to create invited user record' }
  }

  await deleteCredentialAccountForUser(createdUserId)

  return {
    outcome: 'ready',
    user: { id: createdUserId, email: input.email, name: input.name },
  }
}

const createPlaceholderUser = async (
  authInstance: AuthInstance,
  input: { readonly email: string; readonly name: string; readonly role: string },
  throwawayPassword: string
): Promise<string | undefined> => {
  try {
    const createResult = await authInstance.api.createUser({
      body: {
        email: input.email,
        name: input.name,
        role: input.role as 'user' | 'admin',
        password: throwawayPassword,
      },
    })
    if ('user' in createResult && createResult.user?.id) {
      return createResult.user.id
    }
    return undefined
  } catch (error) {
    logError('[admin-invitation] Better Auth createUser failed', error)
    return undefined
  }
}

export const inviteUser = async (params: {
  readonly authInstance: AuthInstance
  readonly authConfig: Auth | undefined
  readonly emailHandlers: EmailHandlers
  readonly baseURL: string
  readonly inviterName: string
  readonly body: {
    readonly email?: unknown
    readonly name?: unknown
    readonly role?: unknown
    readonly password?: unknown
  }
}): Promise<InviteUserResult> => {
  const validation = validateInviteInput(params.body)
  if ('status' in validation) {
    return validation
  }

  const findOrCreate = await findOrCreateInvitedUser(params.authInstance, validation)
  if ('status' in findOrCreate) {
    return findOrCreate
  }
  const { user } = findOrCreate

  const token = generateInvitationToken()
  const expiryMs = resolveInvitationExpiryMs(params.authConfig)
  const expiresAt = new Date(Date.now() + expiryMs)

  const persistOk = await insertInvitationToken({
    id: crypto.randomUUID(),
    token,
    userId: user.id,
    expiresAt,
  }).then(
    () => true,
    (error: unknown) => {
      logError('[admin-invitation] Failed to persist invitation token', error)
      return false
    }
  )
  if (!persistOk) {
    return { status: 'internal-error', message: 'Failed to persist invitation token' }
  }

  const acceptUrl = buildAcceptInvitationUrl(params.baseURL, token)

  await params.emailHandlers.invitation({
    email: user.email,
    name: user.name,
    url: acceptUrl,
    inviterName: params.inviterName,
  })

  return { status: 'invited', user, token }
}

export interface AcceptInvitationSuccess {
  readonly status: 'accepted'
  readonly user: { readonly id: string; readonly email: string; readonly name: string }
}

export interface AcceptInvitationFailure {
  readonly status: 'invalid-token' | 'expired-token' | 'invalid-input' | 'internal-error'
  readonly message: string
}

export type AcceptInvitationResult = AcceptInvitationSuccess | AcceptInvitationFailure

const isPasswordWithinPolicy = (password: string, authConfig?: Auth): string | undefined => {
  const { minLength, maxLength } = resolvePasswordPolicy(authConfig)
  if (password.length < minLength) return `Password must be at least ${minLength} characters`
  if (password.length > maxLength) return `Password must not exceed ${maxLength} characters`
  return undefined
}

const validateAcceptInput = (
  body: { readonly token?: unknown; readonly password?: unknown },
  authConfig: Auth | undefined
): { readonly token: string; readonly password: string } | AcceptInvitationFailure => {
  const { token, password } = body
  if (typeof token !== 'string' || token.length === 0) {
    return { status: 'invalid-input', message: 'token is required' }
  }
  if (typeof password !== 'string' || password.length === 0) {
    return { status: 'invalid-input', message: 'password is required' }
  }
  const policyError = isPasswordWithinPolicy(password, authConfig)
  if (policyError) {
    return { status: 'invalid-input', message: policyError }
  }
  return { token, password }
}

const resolveTokenUser = async (
  rowUserId: string,
  rowId: string
): Promise<
  { readonly id: string; readonly email: string; readonly name: string } | AcceptInvitationFailure
> => {
  const user = await findUserById(rowUserId)
  if (!user) {
    await deleteInvitationToken(rowId).catch(() => undefined)
    return { status: 'invalid-token', message: 'Invitation token is invalid or already used' }
  }
  return user
}

const hashWithAuthContext = async (
  authInstance: AuthInstance,
  password: string
): Promise<string | undefined> => {
  try {
    const ctx = await authInstance.$context
    return await ctx.password.hash(password)
  } catch (error) {
    logError('[admin-invitation] Failed to hash password', error)
    return undefined
  }
}

const linkPassword = async (
  authInstance: AuthInstance,
  userId: string,
  password: string
): Promise<AcceptInvitationFailure | undefined> => {
  const hashed = await hashWithAuthContext(authInstance, password)
  if (!hashed) {
    return { status: 'internal-error', message: 'Failed to set password' }
  }

  const linkResult = await insertCredentialAccount({
    id: crypto.randomUUID(),
    userId,
    hashedPassword: hashed,
  }).then(
    () => 'ok' as const,
    (error: unknown) => {
      logError('[admin-invitation] Failed to link credential account', error)
      return 'failed' as const
    }
  )
  if (linkResult === 'failed') {
    return { status: 'internal-error', message: 'Failed to set password' }
  }
  return undefined
}

const finalizeAcceptedInvitation = async (
  userId: string,
  invitationRowId: string
): Promise<void> => {
  await markUserEmailVerified(userId).catch(() => undefined)
  await deleteInvitationToken(invitationRowId).catch(() => undefined)
}

export const acceptInvitation = async (params: {
  readonly authInstance: AuthInstance
  readonly authConfig: Auth | undefined
  readonly body: { readonly token?: unknown; readonly password?: unknown }
}): Promise<AcceptInvitationResult> => {
  const validated = validateAcceptInput(params.body, params.authConfig)
  if ('status' in validated) {
    return validated
  }

  const row = await findInvitationToken(validated.token)
  if (!row) {
    return { status: 'invalid-token', message: 'Invitation token is invalid or already used' }
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    await deleteInvitationToken(row.id).catch(() => undefined)
    return { status: 'expired-token', message: 'Invitation token has expired' }
  }

  const userOrFailure = await resolveTokenUser(row.userId, row.id)
  if ('status' in userOrFailure) {
    return userOrFailure
  }
  const user = userOrFailure

  if (await userHasCredentialPassword(user.id)) {
    await deleteInvitationToken(row.id).catch(() => undefined)
    return { status: 'invalid-token', message: 'Invitation token is invalid or already used' }
  }

  const linkFailure = await linkPassword(params.authInstance, user.id, validated.password)
  if (linkFailure) return linkFailure

  await finalizeAcceptedInvitation(user.id, row.id)
  return { status: 'accepted', user }
}
