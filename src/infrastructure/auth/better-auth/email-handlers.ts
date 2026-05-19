/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sendEmail } from '../../email/email-service'
import { passwordResetEmail, emailVerificationEmail } from '../../email/templates'
import { logError } from '../../logging'
import type { Auth, AuthEmailTemplate } from '@/domain/models/app/auth'

const substituteVariables = (
  template: string,
  context: Readonly<{
    name?: string
    url?: string
    email: string
    otp?: string
    codes?: string
    organizationName?: string
    inviterName?: string
  }>
): string => {
  return template
    .replace(/\$name/g, context.name ?? 'there')
    .replace(/\$url/g, context.url ?? '')
    .replace(/\$email/g, context.email)
    .replace(/\$otp/g, context.otp ?? '')
    .replace(/\$codes/g, context.codes ?? '')
    .replace(/\$organizationName/g, context.organizationName ?? 'the organization')
    .replace(/\$inviterName/g, context.inviterName ?? 'Someone')
}

type EmailHandlerConfig = Readonly<{
  emailType: string
  buildUrl: (url: string, token: string) => string
  getDefaultTemplate: (params: Readonly<{ userName?: string; actionUrl: string }>) => Readonly<{
    subject: string
    html: string
    text: string
  }>
}>

const createEmailHandler = (config: EmailHandlerConfig, customTemplate?: AuthEmailTemplate) => {
  return async ({
    user,
    url,
    token,
  }: Readonly<{
    user: Readonly<{ email: string; name?: string }>
    url: string
    token: string
  }>) => {
    const actionUrl = config.buildUrl(url, token)
    const context = { name: user.name, url: actionUrl, email: user.email }

    try {
      if (customTemplate?.subject) {
        await sendEmail({
          to: user.email,
          subject: substituteVariables(customTemplate.subject, context),
          html: customTemplate.html ? substituteVariables(customTemplate.html, context) : undefined,
          text: customTemplate.text ? substituteVariables(customTemplate.text, context) : undefined,
        })
      } else {
        const defaultTemplate = config.getDefaultTemplate({
          userName: user.name,
          actionUrl,
        })

        await sendEmail({
          to: user.email,
          subject: defaultTemplate.subject,
          html: defaultTemplate.html,
          text: defaultTemplate.text,
        })
      }
    } catch (error) {
      logError(`[EMAIL] Failed to send ${config.emailType} email to ${user.email}`, error)
    }
  }
}

const createPasswordResetEmailHandler = (customTemplate?: AuthEmailTemplate) =>
  createEmailHandler(
    {
      emailType: 'password reset',
      buildUrl: (url, token) => `${url}?token=${token}`,
      getDefaultTemplate: ({ userName, actionUrl }) =>
        passwordResetEmail({ userName, resetUrl: actionUrl, expiresIn: '1 hour' }),
    },
    customTemplate
  )

const createVerificationEmailHandler = (customTemplate?: AuthEmailTemplate) =>
  createEmailHandler(
    {
      emailType: 'verification',
      buildUrl: (url, token) => (url.includes('token=') ? url : `${url}?token=${token}`),
      getDefaultTemplate: ({ userName, actionUrl }) =>
        emailVerificationEmail({ userName, verifyUrl: actionUrl, expiresIn: '24 hours' }),
    },
    customTemplate
  )

const createMagicLinkEmailHandler = (customTemplate?: AuthEmailTemplate) =>
  createEmailHandler(
    {
      emailType: 'magic link',
      buildUrl: (url, token) => `${url}?token=${token}`,
      getDefaultTemplate: ({ userName, actionUrl }) => ({
        subject: 'Sign in to your account',
        html: `<p>Hi ${userName ?? 'there'},</p><p>Click here to sign in: <a href="${actionUrl}">Sign In</a></p><p>This link will expire in 10 minutes.</p>`,
        text: `Hi ${userName ?? 'there'},\n\nClick here to sign in: ${actionUrl}\n\nThis link will expire in 10 minutes.`,
      }),
    },
    customTemplate
  )

const createWelcomeEmailHandler = (customTemplate?: AuthEmailTemplate) => {
  return async (user: Readonly<{ email: string; name: string }>) => {
    const context = { name: user.name, email: user.email }

    try {
      if (customTemplate?.subject) {
        await sendEmail({
          to: user.email,
          subject: substituteVariables(customTemplate.subject, context),
          html: customTemplate.html ? substituteVariables(customTemplate.html, context) : undefined,
          text: customTemplate.text ? substituteVariables(customTemplate.text, context) : undefined,
        })
      }
    } catch (error) {
      logError(`[EMAIL] Failed to send welcome email to ${user.email}`, error)
    }
  }
}

const createEmailOtpHandler = (customTemplate?: AuthEmailTemplate) => {
  return async ({
    email,
    otp,
  }: Readonly<{
    email: string
    otp: string
    type: string
  }>) => {
    try {
      if (customTemplate?.subject) {
        const context = { email, otp }
        await sendEmail({
          to: email,
          subject: substituteVariables(customTemplate.subject, context),
          html: customTemplate.html ? substituteVariables(customTemplate.html, context) : undefined,
          text: customTemplate.text ? substituteVariables(customTemplate.text, context) : undefined,
        })
        return
      }
      await sendEmail({
        to: email,
        subject: 'Your verification code',
        html: `<p>Your verification code is: <strong>${otp}</strong></p><p>This code will expire in 5 minutes.</p>`,
        text: `Your verification code is: ${otp}\n\nThis code will expire in 5 minutes.`,
      })
    } catch (error) {
      logError(`[EMAIL] Failed to send OTP email to ${email}`, error)
    }
  }
}

const createTwoFactorBackupCodesHandler = (customTemplate?: AuthEmailTemplate) => {
  return async ({
    email,
    name,
    codes,
  }: Readonly<{
    email: string
    name?: string
    codes: readonly string[]
  }>) => {
    try {
      const formattedCodes = codes.join(', ')

      if (customTemplate?.subject) {
        const context = { email, name, codes: formattedCodes }
        await sendEmail({
          to: email,
          subject: substituteVariables(customTemplate.subject, context),
          html: customTemplate.html ? substituteVariables(customTemplate.html, context) : undefined,
          text: customTemplate.text ? substituteVariables(customTemplate.text, context) : undefined,
        })
        return
      }
      await sendEmail({
        to: email,
        subject: 'Your backup codes',
        html: `<p>Your two-factor authentication backup codes:</p><p><strong>${formattedCodes}</strong></p><p>Save these codes in a safe place. Each code can only be used once.</p>`,
        text: `Your two-factor authentication backup codes:\n\n${formattedCodes}\n\nSave these codes in a safe place. Each code can only be used once.`,
      })
    } catch (error) {
      logError(`[EMAIL] Failed to send two-factor backup codes email to ${email}`, error)
    }
  }
}

const createAccountDeletionHandler = (customTemplate?: AuthEmailTemplate) => {
  return async (user: Readonly<{ email: string; name?: string }>) => {
    const context = { name: user.name, email: user.email }

    try {
      if (customTemplate?.subject) {
        await sendEmail({
          to: user.email,
          subject: substituteVariables(customTemplate.subject, context),
          html: customTemplate.html ? substituteVariables(customTemplate.html, context) : undefined,
          text: customTemplate.text ? substituteVariables(customTemplate.text, context) : undefined,
        })
      }
    } catch (error) {
      logError(`[EMAIL] Failed to send account deletion email to ${user.email}`, error)
    }
  }
}

const createInvitationEmailHandler = (customTemplate?: AuthEmailTemplate) => {
  return async ({
    email,
    name,
    url,
    inviterName,
  }: Readonly<{
    email: string
    name: string
    url: string
    inviterName: string
  }>) => {
    const context = { name, email, url, inviterName }

    try {
      if (customTemplate?.subject) {
        await sendEmail({
          to: email,
          subject: substituteVariables(customTemplate.subject, context),
          html: customTemplate.html ? substituteVariables(customTemplate.html, context) : undefined,
          text: customTemplate.text ? substituteVariables(customTemplate.text, context) : undefined,
        })
        return
      }

      const subject = 'You are invited to join'
      const text = `Hi ${name},\n\n${inviterName} invited you to join. Click the link below to set your password and accept the invitation:\n\n${url}\n\nThis link is single-use.`
      const html = `<p>Hi ${name},</p><p>${inviterName} invited you to join. Click <a href="${url}">here</a> to set your password and accept the invitation.</p><p>This link is single-use.</p>`

      await sendEmail({ to: email, subject, html, text })
    } catch (error) {
      logError(`[EMAIL] Failed to send invitation email to ${email}`, error)
    }
  }
}

export const createEmailHandlers = (authConfig?: Auth) => {
  const templates = authConfig?.emailTemplates

  return {
    passwordReset: createPasswordResetEmailHandler(templates?.resetPassword),
    verification: createVerificationEmailHandler(templates?.verification),
    magicLink: createMagicLinkEmailHandler(templates?.magicLink),
    welcome: createWelcomeEmailHandler(templates?.welcome),
    emailOtp: createEmailOtpHandler(templates?.emailOtp),
    twoFactorBackupCodes: createTwoFactorBackupCodesHandler(templates?.twoFactorBackupCodes),
    accountDeletion: createAccountDeletionHandler(templates?.accountDeletion),
    invitation: createInvitationEmailHandler(templates?.invitation),
  }
}
