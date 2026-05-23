/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import {
  authUsersTable,
  authVerificationsTable,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { sendEmail } from '@/infrastructure/email/email-service'
import { logError } from '@/infrastructure/logging/logger'
import type { Auth } from '@/domain/models/app/auth'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { Context } from 'hono'

const parseDurationToMs = (expiry: string | number | undefined): number => {
  if (expiry === undefined) return 72 * 60 * 60 * 1000
  if (typeof expiry === 'number') return expiry
  const match = /^([1-9]\d*)([smhd])$/.exec(expiry)
  if (!match) return 72 * 60 * 60 * 1000
  const value = parseInt(match[1] ?? '0', 10)
  const multipliers: Readonly<Record<string, number>> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  }
  return value * (multipliers[match[2] ?? ''] ?? 1000)
}

const generateToken = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('')

const substituteVariables = (
  template: string,
  context: Readonly<{ name: string; url: string; email: string; inviterName: string }>
): string =>
  template
    .replace(/\$name/g, context.name)
    .replace(/\$url/g, context.url)
    .replace(/\$email/g, context.email)
    .replace(/\$inviterName/g, context.inviterName)

const createPlaceholderUser = async (
  email: string,
  name: string,
  role: string
): Promise<string> => {
  const users = authUsersTable()
  const userId = crypto.randomUUID()
  const now = new Date()
  await db
    .insert(users)
    .values({ id: userId, email, name, role, emailVerified: false, createdAt: now, updatedAt: now })
  return userId
}

const storeInvitationToken = async (userId: string, expiryMs: number): Promise<string> => {
  const verifications = authVerificationsTable()
  const token = generateToken()
  const now = new Date()
  await db.insert(verifications).values({
    id: crypto.randomUUID(),
    identifier: `invitation:${userId}`,
    value: token,
    expiresAt: new Date(Date.now() + expiryMs),
    createdAt: now,
    updatedAt: now,
  })
  return token
}

type EmailContext = Readonly<{ name: string; url: string; email: string; inviterName: string }>

const buildTemplatedEmailOptions = (
  email: string,
  context: EmailContext,
  tmpl: Readonly<{ subject: string; html?: string; text?: string }>
) => ({
  to: email,
  subject: substituteVariables(tmpl.subject, context),
  html: tmpl.html ? substituteVariables(tmpl.html, context) : undefined,
  text: tmpl.text ? substituteVariables(tmpl.text, context) : undefined,
})

const buildDefaultEmailOptions = (
  email: string,
  context: EmailContext,
  expiry: string | number
) => ({
  to: email,
  subject: 'You have been invited',
  html: `<p>Hi ${context.name},</p><p>${context.inviterName} has invited you to join. <a href="${context.url}">Accept invitation</a></p><p>This link expires in ${expiry}.</p>`,
  text: `Hi ${context.name},\n\n${context.inviterName} has invited you to join.\n\nAccept invitation: ${context.url}\n\nThis link expires in ${expiry}.`,
})

const sendInvitationEmail = async (
  opts: Readonly<{
    email: string
    name: string
    token: string
    inviterName: string
    authConfig: Auth | undefined
  }>
): Promise<void> => {
  const { email, name, token, inviterName, authConfig } = opts
  const baseUrl = process.env['BASE_URL'] || `http://localhost:${process.env['PORT'] || 3000}`
  const invitationUrl = `${baseUrl}/accept-invitation?token=${token}`
  const context: EmailContext = { name, url: invitationUrl, email, inviterName }
  const tmpl = authConfig?.emailTemplates?.invitation
  const emailOptions = tmpl?.subject
    ? buildTemplatedEmailOptions(email, context, {
        subject: tmpl.subject,
        html: tmpl.html,
        text: tmpl.text,
      })
    : buildDefaultEmailOptions(email, context, authConfig?.invitationTokenExpiry ?? '72h')
  try {
    await sendEmail(emailOptions)
  } catch (error) {
    logError('[INVITE] Failed to send invitation email', error)
  }
}

export const handleInviteUser = async (
  c: Context,
  authInstance: Readonly<ReturnType<typeof createAuthInstance>>,
  authConfig: Auth | undefined
): Promise<Response> => {
  const session = await authInstance.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }
  const userRole = (session.user as Record<string, unknown>)['role']
  if (userRole !== 'admin') {
    return c.json({ success: false, message: 'Admin role required', code: 'FORBIDDEN' }, 403)
  }

  const body = await c.req.json<{ email?: string; name?: string; role?: string }>()
  const { email, name, role = 'member' } = body
  if (!email || !name) {
    return c.json(
      { success: false, message: 'email and name are required', code: 'VALIDATION_ERROR' },
      400
    )
  }

  const users = authUsersTable()
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
  if (existing.length > 0) {
    return c.json(
      { success: false, message: 'A user with this email already exists', code: 'EMAIL_EXISTS' },
      422
    )
  }

  const userId = await createPlaceholderUser(email, name, role)
  const token = await storeInvitationToken(
    userId,
    parseDurationToMs(authConfig?.invitationTokenExpiry)
  )
  const inviterName = session.user.name ?? 'Admin'
  await sendInvitationEmail({ email, name, token, inviterName, authConfig })

  return c.json({ user: { id: userId, email, name, role }, invitationSent: true })
}
