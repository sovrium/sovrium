/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { openAPI, admin, organization, apiKey, twoFactor } from 'better-auth/plugins'
import { db } from '../../database/drizzle/db'
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
 * Create organization invitation email handler with optional custom templates
 *
 * Better Auth organization plugin provides inviter and organization context
 */
const createOrganizationInvitationEmailHandler = (customTemplate?: AuthEmailTemplate) => {
  return async ({
    email,
    url,
    inviter,
    organization,
  }: Readonly<{
    email: string
    url: string
    inviter: Readonly<{ name?: string }>
    organization: Readonly<{ name: string }>
  }>) => {
    const context = {
      name: undefined,
      url,
      email,
      organizationName: organization.name,
      inviterName: inviter.name,
    }

    try {
      // Custom template takes precedence
      if (customTemplate?.subject) {
        // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
        await sendEmail({
          to: email,
          subject: substituteVariables(customTemplate.subject, context),
          html: customTemplate.html ? substituteVariables(customTemplate.html, context) : undefined,
          text: customTemplate.text ? substituteVariables(customTemplate.text, context) : undefined,
        })
      } else {
        // Use default template
        const inviterText = inviter.name ?? 'Someone'
        const defaultTemplate = {
          subject: `You have been invited to join ${organization.name}`,
          html: `<p>Hi,</p><p>${inviterText} has invited you to join ${organization.name}.</p><p><a href="${url}">Click here to accept the invitation</a></p>`,
          text: `Hi,\n\n${inviterText} has invited you to join ${organization.name}.\n\nClick here to accept: ${url}`,
        }

        // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
        await sendEmail({
          to: email,
          subject: defaultTemplate.subject,
          html: defaultTemplate.html,
          text: defaultTemplate.text,
        })
      }
    } catch (error) {
      // Don't throw - silent failure prevents user enumeration attacks
      logError(`[EMAIL] Failed to send organization invitation email to ${email}`, error)
    }
  }
}

/**
 * Create email handlers from auth configuration
 */
const createEmailHandlers = (authConfig?: Auth) => {
  return {
    passwordReset: createPasswordResetEmailHandler(authConfig?.emailTemplates?.resetPassword),
    verification: createVerificationEmailHandler(authConfig?.emailTemplates?.verification),
    organizationInvitation: createOrganizationInvitationEmailHandler(
      authConfig?.emailTemplates?.organizationInvitation
    ),
  }
}

/**
 * Build socialProviders configuration from auth config
 *
 * Maps enabled OAuth providers to Better Auth socialProviders configuration.
 * Credentials are loaded from environment variables using the pattern:
 * - {PROVIDER}_CLIENT_ID (e.g., GOOGLE_CLIENT_ID)
 * - {PROVIDER}_CLIENT_SECRET (e.g., GOOGLE_CLIENT_SECRET)
 */
const buildSocialProviders = (authConfig?: Auth) => {
  if (!authConfig?.oauth?.providers) return {}

  return authConfig.oauth.providers.reduce(
    (providers, provider) => {
      const envVarPrefix = provider.toUpperCase()
      return {
        ...providers,
        [provider]: {
          clientId: process.env[`${envVarPrefix}_CLIENT_ID`] || '',
          clientSecret: process.env[`${envVarPrefix}_CLIENT_SECRET`] || '',
        },
      }
    },
    {} as Record<string, { clientId: string; clientSecret: string }>
  )
}

/**
 * Custom table names with _sovrium_auth_ prefix for namespace isolation
 * This prevents conflicts when users create their own tables (e.g., "users" for CRM contacts)
 */
const AUTH_TABLE_NAMES = {
  user: '_sovrium_auth_users',
  session: '_sovrium_auth_sessions',
  account: '_sovrium_auth_accounts',
  verification: '_sovrium_auth_verifications',
  organization: '_sovrium_auth_organizations',
  member: '_sovrium_auth_members',
  invitation: '_sovrium_auth_invitations',
  apiKey: '_sovrium_auth_api_keys',
  twoFactor: '_sovrium_auth_two_factors',
} as const

/**
 * Build Better Auth plugins array with custom table names
 */
const buildAuthPlugins = (handlers: Readonly<ReturnType<typeof createEmailHandlers>>) => [
  openAPI({ disableDefaultReference: true }),
  admin(),
  organization({
    sendInvitationEmail: handlers.organizationInvitation,
    schema: {
      organization: { modelName: AUTH_TABLE_NAMES.organization },
      member: { modelName: AUTH_TABLE_NAMES.member },
      invitation: { modelName: AUTH_TABLE_NAMES.invitation },
    },
  }),
  apiKey({ schema: { apikey: { modelName: AUTH_TABLE_NAMES.apiKey } } }),
  twoFactor({ schema: { twoFactor: { modelName: AUTH_TABLE_NAMES.twoFactor } } }),
]

/**
 * Create Better Auth instance with dynamic configuration
 */
export function createAuthInstance(authConfig?: Auth) {
  const emailAndPasswordConfig =
    authConfig?.emailAndPassword && typeof authConfig.emailAndPassword === 'object'
      ? authConfig.emailAndPassword
      : {}
  const requireEmailVerification = emailAndPasswordConfig.requireEmailVerification ?? false
  const handlers = createEmailHandlers(authConfig)

  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_BASE_URL,
    database: drizzleAdapter(db, { provider: 'pg', usePlural: true }),
    session: { modelName: AUTH_TABLE_NAMES.session },
    account: { modelName: AUTH_TABLE_NAMES.account },
    verification: { modelName: AUTH_TABLE_NAMES.verification },
    trustedOrigins: ['*'],
    advanced: {
      useSecureCookies: process.env.NODE_ENV === 'production',
      disableCSRFCheck: process.env.NODE_ENV !== 'production',
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification,
      sendResetPassword: handlers.passwordReset,
    },
    emailVerification: {
      sendOnSignUp: requireEmailVerification,
      autoSignInAfterVerification: true,
      sendVerificationEmail: handlers.verification,
    },
    user: {
      modelName: AUTH_TABLE_NAMES.user,
      changeEmail: { enabled: true, sendChangeEmailVerification: handlers.verification },
    },
    socialProviders: buildSocialProviders(authConfig),
    plugins: buildAuthPlugins(handlers),
  })
}

/**
 * Lazy-initialized Better Auth instance for OpenAPI schema generation
 * Uses default configuration (requireEmailVerification: false)
 *
 * Lazy initialization prevents module-level instance from being created
 * before dynamic instances, which could interfere with Better Auth's
 * internal state.
 */
// eslint-disable-next-line functional/no-let, unicorn/no-null, functional/prefer-immutable-types -- Lazy initialization pattern
let _defaultAuthInstance: ReturnType<typeof createAuthInstance> | null = null

// eslint-disable-next-line functional/prefer-immutable-types -- Return type from betterAuth is mutable
export function getDefaultAuthInstance(): ReturnType<typeof createAuthInstance> {
  if (_defaultAuthInstance === null) {
    // eslint-disable-next-line functional/no-expression-statements -- Lazy initialization pattern
    _defaultAuthInstance = createAuthInstance()
  }
  return _defaultAuthInstance
}

// Keep for backward compatibility but mark as lazy
export const auth = {
  get api() {
    return getDefaultAuthInstance().api
  },
  get handler() {
    return getDefaultAuthInstance().handler
  },
}
