/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeHtml } from '@/domain/kernel/markdown/markdown-renderer'
import { sendEmail } from '../../email/email-service'
import {
  accountDeletionEmail,
  passwordResetEmail,
  emailVerificationEmail,
  resolveBrand,
} from '../../email/templates'
import { logError } from '../../logging'
import type { Auth, AuthEmailTemplate } from '@/domain/models/app/auth'

/** Every value a custom template can name. */
type SubstitutionContext = Readonly<{
  name?: string
  url?: string
  email: string
  otp?: string
  codes?: string
  organizationName?: string
  inviterName?: string
  appName?: string
}>

type VariableName = keyof SubstitutionContext

/** What a variable reads as when the email type supplies no value for it. */
const VARIABLE_FALLBACKS: Readonly<Record<VariableName, string>> = {
  name: 'there',
  url: '',
  email: '',
  otp: '',
  codes: '',
  organizationName: 'the organization',
  inviterName: 'Someone',
  appName: resolveBrand(undefined),
}

const VARIABLE_PATTERN = /\$(name|url|email|otp|codes|organizationName|inviterName|appName)\b/g

/**
 * Substitute `$variable` references in a template string.
 *
 * ONE pass with a replacer function, for two reasons a chain of
 * `.replace(re, value)` calls gets wrong: a replacement STRING interprets
 * `$&`, `` $` `` and `$'` (so a user named `$&` duplicated template text), and a
 * later step re-scanned what an earlier one inserted (so a name containing
 * `$url` became the link). Here each value is inserted exactly as it is and is
 * never read again.
 *
 * Supported variables: $name, $url, $email, $otp, $codes, $organizationName,
 * $inviterName, $appName.
 */
export const substituteVariables = (template: string, context: SubstitutionContext): string =>
  template.replace(
    VARIABLE_PATTERN,
    (_match, variable: VariableName) => context[variable] ?? VARIABLE_FALLBACKS[variable]
  )

/**
 * Substitute variables into the HTML part of a template.
 *
 * Every value is HTML-escaped (quotes included, so `$url` is safe inside an
 * `href="…"` attribute): a user's name, an inviter's name or an organisation
 * name are user-controlled text and must never become markup in someone's
 * mailbox. The subject and the text part keep the raw values. Same single
 * pass as {@link substituteVariables}, so an escaped value is never re-read.
 */
export const substituteHtmlVariables = (template: string, context: SubstitutionContext): string =>
  template.replace(VARIABLE_PATTERN, (_match, variable: VariableName) =>
    escapeHtml(context[variable] ?? VARIABLE_FALLBACKS[variable])
  )

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
const createEmailHandler = (
  config: EmailHandlerConfig,
  customTemplate?: AuthEmailTemplate,
  appName?: string
) => {
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
    const context = { name: user.name, url: actionUrl, email: user.email, appName }

    try {
      // Custom template takes precedence - use it entirely (don't mix with defaults)
      if (customTemplate?.subject) {
        // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
        await sendEmail({
          to: user.email,
          fromName: appName,
          subject: substituteVariables(customTemplate.subject, context),
          html: customTemplate.html
            ? substituteHtmlVariables(customTemplate.html, context)
            : undefined,
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
          fromName: appName,
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
const createPasswordResetEmailHandler = (customTemplate?: AuthEmailTemplate, appName?: string) =>
  createEmailHandler(
    {
      emailType: 'password reset',
      buildUrl: (url, token) => `${url}?token=${token}`,
      getDefaultTemplate: ({ userName, actionUrl }) =>
        passwordResetEmail({ appName, userName, resetUrl: actionUrl, expiresIn: '1 hour' }),
    },
    customTemplate,
    appName
  )

/**
 * Create email verification handler with optional custom templates
 */
const createVerificationEmailHandler = (customTemplate?: AuthEmailTemplate, appName?: string) =>
  createEmailHandler(
    {
      emailType: 'verification',
      // Better Auth sometimes includes token in URL already
      buildUrl: (url, token) => (url.includes('token=') ? url : `${url}?token=${token}`),
      getDefaultTemplate: ({ userName, actionUrl }) =>
        emailVerificationEmail({ appName, userName, verifyUrl: actionUrl, expiresIn: '24 hours' }),
    },
    customTemplate,
    appName
  )

/**
 * The default magic-link email. The user's name and the link are escaped in
 * the HTML part and left raw in the text part.
 */
export const buildMagicLinkDefaultEmail = ({
  userName,
  actionUrl,
  appName,
}: Readonly<{ userName?: string; actionUrl: string; appName?: string }>): Readonly<{
  subject: string
  html: string
  text: string
}> => {
  const brand = resolveBrand(appName)
  return {
    subject: `Sign in to ${brand}`,
    html: `<p>Hi ${escapeHtml(userName ?? 'there')},</p><p>Click here to sign in to ${escapeHtml(brand)}: <a href="${escapeHtml(actionUrl)}">Sign In</a></p><p>This link will expire in 10 minutes.</p>`,
    text: `Hi ${userName ?? 'there'},\n\nClick here to sign in to ${brand}: ${actionUrl}\n\nThis link will expire in 10 minutes.`,
  }
}

/**
 * Create magic link email handler with optional custom templates
 */
const createMagicLinkEmailHandler = (customTemplate?: AuthEmailTemplate, appName?: string) =>
  createEmailHandler(
    {
      emailType: 'magic link',
      buildUrl: (url, token) => `${url}?token=${token}`,
      getDefaultTemplate: ({ userName, actionUrl }) =>
        buildMagicLinkDefaultEmail({ userName, actionUrl, appName }),
    },
    customTemplate,
    appName
  )

/**
 * Create welcome email handler with optional custom template
 *
 * Sends a welcome email after user creation via databaseHooks.
 * Unlike other handlers, this doesn't require a URL/token — it fires
 * after the user record is created in the database.
 */
const createWelcomeEmailHandler = (customTemplate?: AuthEmailTemplate, appName?: string) => {
  return async (user: Readonly<{ email: string; name: string }>) => {
    const context = { name: user.name, email: user.email, appName }

    try {
      if (customTemplate?.subject) {
        // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
        await sendEmail({
          to: user.email,
          fromName: appName,
          subject: substituteVariables(customTemplate.subject, context),
          html: customTemplate.html
            ? substituteHtmlVariables(customTemplate.html, context)
            : undefined,
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
const createEmailOtpHandler = (customTemplate?: AuthEmailTemplate, appName?: string) => {
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
        const context = { email, otp, appName }
        // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
        await sendEmail({
          to: email,
          fromName: appName,
          subject: substituteVariables(customTemplate.subject, context),
          html: customTemplate.html
            ? substituteHtmlVariables(customTemplate.html, context)
            : undefined,
          text: customTemplate.text ? substituteVariables(customTemplate.text, context) : undefined,
        })
        return
      }
      // Default OTP email
      // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
      await sendEmail({
        to: email,
        fromName: appName,
        subject: `Your ${resolveBrand(appName)} verification code`,
        html: `<p>Your ${escapeHtml(resolveBrand(appName))} verification code is: <strong>${escapeHtml(otp)}</strong></p><p>This code will expire in 5 minutes.</p>`,
        text: `Your ${resolveBrand(appName)} verification code is: ${otp}\n\nThis code will expire in 5 minutes.`,
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
const createTwoFactorBackupCodesHandler = (
  customTemplate?: AuthEmailTemplate,
  appName?: string
) => {
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
        const context = { email, name, codes: formattedCodes, appName }
        // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
        await sendEmail({
          to: email,
          fromName: appName,
          subject: substituteVariables(customTemplate.subject, context),
          html: customTemplate.html
            ? substituteHtmlVariables(customTemplate.html, context)
            : undefined,
          text: customTemplate.text ? substituteVariables(customTemplate.text, context) : undefined,
        })
        return
      }
      // Default backup codes email
      // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
      await sendEmail({
        to: email,
        fromName: appName,
        subject: `Your ${resolveBrand(appName)} backup codes`,
        html: `<p>Your ${escapeHtml(resolveBrand(appName))} two-factor authentication backup codes:</p><p><strong>${escapeHtml(formattedCodes)}</strong></p><p>Save these codes in a safe place. Each code can only be used once.</p>`,
        text: `Your ${resolveBrand(appName)} two-factor authentication backup codes:\n\n${formattedCodes}\n\nSave these codes in a safe place. Each code can only be used once.`,
      })
    } catch (error) {
      logError(`[EMAIL] Failed to send two-factor backup codes email to ${email}`, error)
    }
  }
}

/**
 * Create the account deletion email handler with optional custom template.
 *
 * Sends the confirmation link for an immediate account deletion: Better Auth's
 * `sendDeleteAccountVerification` hands over the account and the absolute
 * `/delete-user/callback?token=…` link, which is `$url` in a custom template.
 * With no custom template the default confirmation email is sent. Nothing is
 * mailed once the account is erased: the address is the personal data the
 * erasure removes, and the redirect already confirms it.
 */
const createAccountDeletionHandler = (customTemplate?: AuthEmailTemplate, appName?: string) => {
  const send = createEmailHandler(
    {
      emailType: 'account deletion',
      // Better Auth builds the whole link, token and callback URL included.
      buildUrl: (url) => url,
      getDefaultTemplate: ({ userName, actionUrl }) =>
        accountDeletionEmail({ appName, userName, confirmUrl: actionUrl, expiresIn: '24 hours' }),
    },
    customTemplate,
    appName
  )
  return ({ email, name, url }: Readonly<{ email: string; name?: string; url: string }>) =>
    send({ user: { email, name }, url, token: '' })
}

/**
 * The default invitation email. The invitee's and the inviter's names and the
 * link are escaped in the HTML part and left raw in the text part.
 */
export const buildInvitationDefaultEmail = ({
  name,
  url,
  inviterName,
  appName,
}: Readonly<{ name: string; url: string; inviterName: string; appName?: string }>): Readonly<{
  subject: string
  html: string
  text: string
}> => {
  const brand = resolveBrand(appName)
  return {
    subject: `You are invited to join ${brand}`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>${escapeHtml(inviterName)} invited you to join ${escapeHtml(brand)}. Click <a href="${escapeHtml(url)}">here</a> to set your password and accept the invitation.</p><p>This link is single-use.</p>`,
    text: `Hi ${name},\n\n${inviterName} invited you to join ${brand}. Click the link below to set your password and accept the invitation:\n\n${url}\n\nThis link is single-use.`,
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
 * issued the invitation), $appName (the app's name).
 *
 * Errors are swallowed and logged: failing to deliver an invitation email
 * must NOT leak through the API response (preserves admin UX) and must NOT
 * roll back the verification token row (the admin can still surface the
 * link manually if SMTP is misconfigured).
 */
const createInvitationEmailHandler = (customTemplate?: AuthEmailTemplate, appName?: string) => {
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
    const context = { name, email, url, inviterName, appName }

    try {
      if (customTemplate?.subject) {
        // eslint-disable-next-line functional/no-expression-statements -- email send is a side effect
        await sendEmail({
          to: email,
          fromName: appName,
          subject: substituteVariables(customTemplate.subject, context),
          html: customTemplate.html
            ? substituteHtmlVariables(customTemplate.html, context)
            : undefined,
          text: customTemplate.text ? substituteVariables(customTemplate.text, context) : undefined,
        })
        return
      }

      // Default invitation template
      // eslint-disable-next-line functional/no-expression-statements -- email send is a side effect
      await sendEmail({
        to: email,
        fromName: appName,
        ...buildInvitationDefaultEmail({ name, url, inviterName, appName }),
      })
    } catch (error) {
      logError(`[EMAIL] Failed to send invitation email to ${email}`, error)
    }
  }
}

/**
 * Create email handlers from auth configuration
 */
export const createEmailHandlers = (authConfig?: Auth, appName?: string) => {
  const templates = authConfig?.emailTemplates

  return {
    passwordReset: createPasswordResetEmailHandler(templates?.resetPassword, appName),
    verification: createVerificationEmailHandler(templates?.verification, appName),
    magicLink: createMagicLinkEmailHandler(templates?.magicLink, appName),
    welcome: createWelcomeEmailHandler(templates?.welcome, appName),
    emailOtp: createEmailOtpHandler(templates?.emailOtp, appName),
    twoFactorBackupCodes: createTwoFactorBackupCodesHandler(
      templates?.twoFactorBackupCodes,
      appName
    ),
    accountDeletion: createAccountDeletionHandler(templates?.accountDeletion, appName),
    invitation: createInvitationEmailHandler(templates?.invitation, appName),
  }
}
