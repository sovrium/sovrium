/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
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
    url: string
    email: string
    organizationName?: string
    inviterName?: string
  }>
): string => {
  return template
    .replace(/\$name/g, context.name ?? 'there')
    .replace(/\$url/g, context.url)
    .replace(/\$email/g, context.email)
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
 * Create email handlers from auth configuration
 */
export const createEmailHandlers = (authConfig?: Auth) => {
  return {
    passwordReset: createPasswordResetEmailHandler(authConfig?.emailTemplates?.resetPassword),
    verification: createVerificationEmailHandler(authConfig?.emailTemplates?.verification),
    magicLink: createMagicLinkEmailHandler(authConfig?.emailTemplates?.magicLink),
  }
}
