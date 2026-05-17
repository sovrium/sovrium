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

/**
 * Substitute variables in a template string
 *
 * Replaces $variable patterns with actual values from the context.
 * Supported variables: $name, $url, $email, $organizationName, $inviterName
 */
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

/**
 * Email handler configuration for the factory
 */
type EmailHandlerConfig = Readonly<{
  /** Email type for logging (e.g., 'password reset', 'verification') */
  emailType: string
  /** Function to build the action URL from base URL and token */
  buildUrl: (url: string, token: string) => string
  /** Function to generate the default template when no custom template is provided */
  getDefaultTemplate: (params: Readonly<{ userName?: string; actionUrl: string }>) => Readonly<{
    subject: string
    html: string
    text: string
  }>
}>

/**
 * Generic email handler factory - eliminates duplication between email types
 *
 * Creates a Better Auth email callback that:
 * 1. Builds the action URL using the provided strategy
 * 2. Sends custom template if provided (with variable substitution)
 * 3. Falls back to default template otherwise
 * 4. Handles errors silently to prevent user enumeration
 */
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
      // Custom template takes precedence - use it entirely (don't mix with defaults)
      if (customTemplate?.subject) {
        // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
        await sendEmail({
          to: user.email,
          subject: substituteVariables(customTemplate.subject, context),
          html: customTemplate.html ? substituteVariables(customTemplate.html, context) : undefined,
          text: customTemplate.text ? substituteVariables(customTemplate.text, context) : undefined,
        })
      } else {
        // Use default template
        const defaultTemplate = config.getDefaultTemplate({
          userName: user.name,
          actionUrl,
        })

        // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
        await sendEmail({
          to: user.email,
          subject: defaultTemplate.subject,
          html: defaultTemplate.html,
          text: defaultTemplate.text,
        })
      }
    } catch (error) {
      // Don't throw - silent failure prevents user enumeration attacks
      logError(`[EMAIL] Failed to send ${config.emailType} email to ${user.email}`, error)
    }
  }
}

/**
 * Create password reset email handler with optional custom templates
 */
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

/**
 * Create email verification handler with optional custom templates
 */
const createVerificationEmailHandler = (customTemplate?: AuthEmailTemplate) =>
  createEmailHandler(
    {
      emailType: 'verification',
      // Better Auth sometimes includes token in URL already
      buildUrl: (url, token) => (url.includes('token=') ? url : `${url}?token=${token}`),
      getDefaultTemplate: ({ userName, actionUrl }) =>
        emailVerificationEmail({ userName, verifyUrl: actionUrl, expiresIn: '24 hours' }),
    },
    customTemplate
  )

/**
 * Create magic link email handler with optional custom templates
 */
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

/**
 * Create welcome email handler with optional custom template
 *
 * Sends a welcome email after user creation via databaseHooks.
 * Unlike other handlers, this doesn't require a URL/token — it fires
 * after the user record is created in the database.
 */
const createWelcomeEmailHandler = (customTemplate?: AuthEmailTemplate) => {
  return async (user: Readonly<{ email: string; name: string }>) => {
    const context = { name: user.name, email: user.email }

    try {
      if (customTemplate?.subject) {
        // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
        await sendEmail({
          to: user.email,
          subject: substituteVariables(customTemplate.subject, context),
          html: customTemplate.html ? substituteVariables(customTemplate.html, context) : undefined,
          text: customTemplate.text ? substituteVariables(customTemplate.text, context) : undefined,
        })
      }
      // No default welcome email — only sent when explicitly configured
    } catch (error) {
      logError(`[EMAIL] Failed to send welcome email to ${user.email}`, error)
    }
  }
}

/**
 * Create email OTP handler with optional custom template
 *
 * Unlike URL-based handlers, OTP handlers receive the OTP code directly
 * from Better Auth's emailOTP plugin. The handler substitutes $otp in
 * the custom template with the actual code.
 */
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
        // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
        await sendEmail({
          to: email,
          subject: substituteVariables(customTemplate.subject, context),
          html: customTemplate.html ? substituteVariables(customTemplate.html, context) : undefined,
          text: customTemplate.text ? substituteVariables(customTemplate.text, context) : undefined,
        })
        return
      }
      // Default OTP email
      // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
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

/**
 * Create two-factor backup codes email handler with optional custom template
 *
 * Sends backup codes to the user after enabling two-factor authentication.
 * The handler substitutes $codes in the custom template with the actual codes.
 * Called from the after hook when /two-factor/enable succeeds.
 */
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
        // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
        await sendEmail({
          to: email,
          subject: substituteVariables(customTemplate.subject, context),
          html: customTemplate.html ? substituteVariables(customTemplate.html, context) : undefined,
          text: customTemplate.text ? substituteVariables(customTemplate.text, context) : undefined,
        })
        return
      }
      // Default backup codes email
      // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
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

/**
 * Create account deletion email handler with optional custom template
 *
 * Sends a confirmation email after account deletion.
 * Unlike URL-based handlers, this fires after the user record is deleted
 * from the database, using session data captured before deletion.
 */
const createAccountDeletionHandler = (customTemplate?: AuthEmailTemplate) => {
  return async (user: Readonly<{ email: string; name?: string }>) => {
    const context = { name: user.name, email: user.email }

    try {
      if (customTemplate?.subject) {
        // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
        await sendEmail({
          to: user.email,
          subject: substituteVariables(customTemplate.subject, context),
          html: customTemplate.html ? substituteVariables(customTemplate.html, context) : undefined,
          text: customTemplate.text ? substituteVariables(customTemplate.text, context) : undefined,
        })
      }
      // No default account deletion email — only sent when explicitly configured
    } catch (error) {
      logError(`[EMAIL] Failed to send account deletion email to ${user.email}`, error)
    }
  }
}

/**
 * Create admin invitation email handler with optional custom template.
 *
 * Unlike the URL-based handlers above, the invitation handler is invoked
 * directly by the Sovrium engine from the
 * `POST /api/auth/admin/invite-user` use-case (it is NOT a Better Auth
 * plugin endpoint), so the signature is bespoke.
 *
 * Supported substitutions: $name (invitee), $email (invitee), $url (the
 * absolute /accept-invitation?token=... link), $inviterName (the admin who
 * issued the invitation).
 *
 * Errors are swallowed and logged: failing to deliver an invitation email
 * must NOT leak through the API response (preserves admin UX) and must NOT
 * roll back the verification token row (the admin can still surface the
 * link manually if SMTP is misconfigured).
 */
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
        // eslint-disable-next-line functional/no-expression-statements -- email send is a side effect
        await sendEmail({
          to: email,
          subject: substituteVariables(customTemplate.subject, context),
          html: customTemplate.html ? substituteVariables(customTemplate.html, context) : undefined,
          text: customTemplate.text ? substituteVariables(customTemplate.text, context) : undefined,
        })
        return
      }

      // Default invitation template
      const subject = 'You are invited to join'
      const text = `Hi ${name},\n\n${inviterName} invited you to join. Click the link below to set your password and accept the invitation:\n\n${url}\n\nThis link is single-use.`
      const html = `<p>Hi ${name},</p><p>${inviterName} invited you to join. Click <a href="${url}">here</a> to set your password and accept the invitation.</p><p>This link is single-use.</p>`

      // eslint-disable-next-line functional/no-expression-statements -- email send is a side effect
      await sendEmail({ to: email, subject, html, text })
    } catch (error) {
      logError(`[EMAIL] Failed to send invitation email to ${email}`, error)
    }
  }
}

/**
 * Create email handlers from auth configuration
 */
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
