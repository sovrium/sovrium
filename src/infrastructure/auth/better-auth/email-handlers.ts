/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeHtmlAttribute } from '@/domain/kernel/sanitize/html-escaping'
import { magicLinkExpirationMinutes } from '@/domain/models/app/auth/magic-link-lifetime-service'
import {
  buildInvitationDefaultEmail,
  buildMagicLinkDefaultEmail,
  withTokenOnce,
} from '../../email/auth-link-emails'
import { sendEmail } from '../../email/email-service'
import { recipientEmailWords, type EmailWords } from '../../email/email-words'
import { substituteHtmlVariables, substituteVariables } from '../../email/template-variables'
import {
  accountDeletionEmail,
  passwordResetEmail,
  emailVerificationEmail,
  resolveBrand,
} from '../../email/templates'
import { logMailFailure } from './mail-failure-log'
import { createTwoFactorLockoutHandler } from './two-factor-lockout-email-handler'
import type { Auth, AuthEmailTemplate } from '@/domain/models/app/auth'
import type { Languages } from '@/domain/models/app/languages'

/**
 * The transport every handler hands its message to. Defaults to the
 * process-wide {@link sendEmail}; a caller (a unit test) injects its own to
 * observe the message a handler builds without sending it.
 */
export type SendAuthEmail = typeof sendEmail

/** The words an email to a reader is written in, from the language the account stored. */
type WordsFor = (stored?: string | null) => EmailWords

const ENGLISH: WordsFor = () => recipientEmailWords(undefined)

/** Email handler configuration for the factory */
type EmailHandlerConfig = Readonly<{
  /** Email type for logging (e.g., 'password reset', 'verification') */
  emailType: string
  /** Function to build the action URL from base URL and token */
  buildUrl: (url: string, token: string) => string
  /** The words a reader's stored language picks; English when absent */
  wordsFor?: WordsFor
  /** The default template, in the reader's words, when no custom template is provided */
  getDefaultTemplate: (
    params: Readonly<{ userName?: string; actionUrl: string; words: EmailWords }>
  ) => Readonly<{
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
  appName?: string,
  send: SendAuthEmail = sendEmail
) => {
  const wordsFor = config.wordsFor ?? ENGLISH
  return async ({
    user,
    url,
    token,
  }: Readonly<{
    user: Readonly<{ email: string; name?: string; language?: string | null }>
    url: string
    token: string
  }>) => {
    const actionUrl = config.buildUrl(url, token)
    const context = { name: user.name, url: actionUrl, email: user.email, appName }

    try {
      // Custom template takes precedence - use it entirely (don't mix with defaults)
      if (customTemplate?.subject) {
        await send({
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
          words: wordsFor(user.language),
        })

        await send({
          to: user.email,
          fromName: appName,
          subject: defaultTemplate.subject,
          html: defaultTemplate.html,
          text: defaultTemplate.text,
        })
      }
    } catch (error) {
      // Don't throw - silent failure prevents user enumeration attacks
      logMailFailure(`${config.emailType} email`, user.email, error)
    }
  }
}

/**
 * Create password reset email handler with optional custom templates
 */
const createPasswordResetEmailHandler = (
  customTemplate: AuthEmailTemplate | undefined,
  appName: string | undefined,
  send: SendAuthEmail,
  wordsFor: WordsFor
) =>
  createEmailHandler(
    {
      emailType: 'password reset',
      wordsFor,
      buildUrl: withTokenOnce,
      getDefaultTemplate: ({ userName, actionUrl, words }) =>
        passwordResetEmail({ appName, userName, resetUrl: actionUrl, expiresIn: '1 hour', words }),
    },
    customTemplate,
    appName,
    send
  )

/**
 * Create email verification handler with optional custom templates
 */
const createVerificationEmailHandler = (
  customTemplate: AuthEmailTemplate | undefined,
  appName: string | undefined,
  send: SendAuthEmail,
  wordsFor: WordsFor
) =>
  createEmailHandler(
    {
      emailType: 'verification',
      wordsFor,
      buildUrl: withTokenOnce,
      getDefaultTemplate: ({ userName, actionUrl, words }) =>
        emailVerificationEmail({
          appName,
          userName,
          verifyUrl: actionUrl,
          expiresIn: '24 hours',
          words,
        }),
    },
    customTemplate,
    appName,
    send
  )

/**
 * Create magic link email handler with optional custom templates
 */
const createMagicLinkEmailHandler = (
  customTemplate: AuthEmailTemplate | undefined,
  appName: string | undefined,
  send: SendAuthEmail,
  reader: Readonly<{ wordsFor: WordsFor; expiresInMinutes: number }>
) =>
  createEmailHandler(
    {
      emailType: 'magic link',
      wordsFor: reader.wordsFor,
      buildUrl: withTokenOnce,
      getDefaultTemplate: ({ userName, actionUrl, words }) =>
        buildMagicLinkDefaultEmail({
          userName,
          actionUrl,
          appName,
          words,
          expiresInMinutes: reader.expiresInMinutes,
        }),
    },
    customTemplate,
    appName,
    send
  )

/**
 * Create welcome email handler with optional custom template
 *
 * Sends a welcome email after user creation via databaseHooks.
 * Unlike other handlers, this doesn't require a URL/token — it fires
 * after the user record is created in the database.
 */
const createWelcomeEmailHandler = (
  customTemplate?: AuthEmailTemplate,
  appName?: string,
  send: SendAuthEmail = sendEmail
) => {
  return async (user: Readonly<{ email: string; name: string }>) => {
    const context = { name: user.name, email: user.email, appName }

    try {
      if (customTemplate?.subject) {
        await send({
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
      logMailFailure('welcome email', user.email, error)
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
const createEmailOtpHandler = (
  customTemplate?: AuthEmailTemplate,
  appName?: string,
  send: SendAuthEmail = sendEmail
) => {
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
        await send({
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
      await send({
        to: email,
        fromName: appName,
        subject: `Your ${resolveBrand(appName)} verification code`,
        html: `<p>Your ${escapeHtmlAttribute(resolveBrand(appName))} verification code is: <strong>${escapeHtmlAttribute(otp)}</strong></p><p>This code will expire in 5 minutes.</p>`,
        text: `Your ${resolveBrand(appName)} verification code is: ${otp}\n\nThis code will expire in 5 minutes.`,
      })
    } catch (error) {
      logMailFailure('OTP email', email, error)
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
  appName?: string,
  send: SendAuthEmail = sendEmail
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
        await send({
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
      await send({
        to: email,
        fromName: appName,
        subject: `Your ${resolveBrand(appName)} backup codes`,
        html: `<p>Your ${escapeHtmlAttribute(resolveBrand(appName))} two-factor authentication backup codes:</p><p><strong>${escapeHtmlAttribute(formattedCodes)}</strong></p><p>Save these codes in a safe place. Each code can only be used once.</p>`,
        text: `Your ${resolveBrand(appName)} two-factor authentication backup codes:\n\n${formattedCodes}\n\nSave these codes in a safe place. Each code can only be used once.`,
      })
    } catch (error) {
      logMailFailure('two-factor backup codes email', email, error)
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
const createAccountDeletionHandler = (
  customTemplate?: AuthEmailTemplate,
  appName?: string,
  send: SendAuthEmail = sendEmail
) => {
  const sendDeletion = createEmailHandler(
    {
      emailType: 'account deletion',
      // Better Auth builds the whole link, token and callback URL included.
      buildUrl: (url) => url,
      getDefaultTemplate: ({ userName, actionUrl }) =>
        accountDeletionEmail({ appName, userName, confirmUrl: actionUrl, expiresIn: '24 hours' }),
    },
    customTemplate,
    appName,
    send
  )
  return ({ email, name, url }: Readonly<{ email: string; name?: string; url: string }>) =>
    sendDeletion({ user: { email, name }, url, token: '' })
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
const createInvitationEmailHandler = (
  customTemplate: AuthEmailTemplate | undefined,
  appName: string | undefined,
  send: SendAuthEmail,
  wordsFor: WordsFor
) => {
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
        await send({
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
      await send({
        to: email,
        fromName: appName,
        // An invitee has no stored language yet: the app's default decides.
        ...buildInvitationDefaultEmail({ name, url, inviterName, appName, words: wordsFor() }),
      })
    } catch (error) {
      logMailFailure('invitation email', email, error)
    }
  }
}

/**
 * Create email handlers from auth configuration
 */
export const createEmailHandlers = (
  authConfig?: Auth,
  appName?: string,
  send: SendAuthEmail = sendEmail,
  languages?: Languages
) => {
  const templates: NonNullable<Auth['emailTemplates']> = authConfig?.emailTemplates ?? {}
  // The reset, verification, magic-link and invitation defaults speak the reader's language.
  const wordsFor: WordsFor = (stored) => recipientEmailWords(languages, stored)
  const magicLinkReader = { wordsFor, expiresInMinutes: magicLinkExpirationMinutes(authConfig) }

  return {
    passwordReset: createPasswordResetEmailHandler(
      templates.resetPassword,
      appName,
      send,
      wordsFor
    ),
    verification: createVerificationEmailHandler(templates.verification, appName, send, wordsFor),
    magicLink: createMagicLinkEmailHandler(templates.magicLink, appName, send, magicLinkReader),
    welcome: createWelcomeEmailHandler(templates.welcome, appName, send),
    emailOtp: createEmailOtpHandler(templates.emailOtp, appName, send),
    twoFactorBackupCodes: createTwoFactorBackupCodesHandler(
      templates.twoFactorBackupCodes,
      appName,
      send
    ),
    accountDeletion: createAccountDeletionHandler(templates.accountDeletion, appName, send),
    invitation: createInvitationEmailHandler(templates.invitation, appName, send, wordsFor),
    twoFactorLockout: createTwoFactorLockoutHandler(appName, send, wordsFor),
  }
}
