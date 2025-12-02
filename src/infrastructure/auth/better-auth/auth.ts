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
import type { Auth, AuthEmailTemplate } from '@/domain/models/app/auth'

/**
 * Substitute variables in a template string
 *
 * Replaces $variable patterns with actual values from the context.
 * Supported variables: $name, $url, $email
 */
const substituteVariables = (
  template: string,
  context: Readonly<{ name?: string; url: string; email: string }>
): string => {
  return template
    .replace(/\$name/g, context.name ?? 'there')
    .replace(/\$url/g, context.url)
    .replace(/\$email/g, context.email)
}

/**
 * Create password reset email handler with optional custom templates
 */
const createPasswordResetEmailHandler = (customTemplate?: AuthEmailTemplate) => {
  return async ({
    user,
    url,
    token,
  }: Readonly<{
    user: Readonly<{ email: string; name?: string }>
    url: string
    token: string
  }>) => {
    const resetUrl = `${url}?token=${token}`
    const context = { name: user.name, url: resetUrl, email: user.email }

    // Send email (uses Mailpit in development, real SMTP in production)
    try {
      // If custom template provided, use it entirely (don't mix with defaults)
      // This ensures consistent behavior - either all custom or all default
      if (customTemplate?.subject) {
        const subject = substituteVariables(customTemplate.subject, context)
        const text = customTemplate.text
          ? substituteVariables(customTemplate.text, context)
          : undefined
        const html = customTemplate.html
          ? substituteVariables(customTemplate.html, context)
          : undefined

        // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
        await sendEmail({
          to: user.email,
          subject,
          html,
          text,
        })
      } else {
        // Use default template
        const defaultTemplate = passwordResetEmail({
          userName: user.name,
          resetUrl,
          expiresIn: '1 hour',
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
      console.error(`[EMAIL] Failed to send password reset email to ${user.email}:`, error)
      // Don't throw - let the user know the email was "sent" to prevent user enumeration
    }
  }
}

/**
 * Create email verification handler with optional custom templates
 */
const createVerificationEmailHandler = (customTemplate?: AuthEmailTemplate) => {
  return async ({
    user,
    url,
    token,
  }: Readonly<{
    user: Readonly<{ email: string; name?: string }>
    url: string
    token: string
  }>) => {
    // URL already contains token parameter in Better Auth
    const verifyUrl = url.includes('token=') ? url : `${url}?token=${token}`
    const context = { name: user.name, url: verifyUrl, email: user.email }

    // Send email (uses Mailpit in development, real SMTP in production)
    try {
      // If custom template provided, use it entirely (don't mix with defaults)
      // This ensures consistent behavior - either all custom or all default
      if (customTemplate?.subject) {
        const subject = substituteVariables(customTemplate.subject, context)
        const text = customTemplate.text
          ? substituteVariables(customTemplate.text, context)
          : undefined
        const html = customTemplate.html
          ? substituteVariables(customTemplate.html, context)
          : undefined

        // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
        await sendEmail({
          to: user.email,
          subject,
          html,
          text,
        })
      } else {
        // Use default template
        const defaultTemplate = emailVerificationEmail({
          userName: user.name,
          verifyUrl,
          expiresIn: '24 hours',
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
      console.error(`[EMAIL] Failed to send verification email to ${user.email}:`, error)
      // Don't throw - let the user know the email was "sent" to prevent user enumeration
    }
  }
}

/**
 * Create Better Auth instance with dynamic configuration
 *
 * @param authConfig - Optional auth configuration from app schema (flat structure)
 * @returns Better Auth instance configured based on app settings
 */
export function createAuthInstance(authConfig?: Auth) {
  // Determine if email verification is required based on auth config
  // With flat structure, emailAndPassword is directly on authConfig
  const emailAndPasswordConfig =
    authConfig?.emailAndPassword && typeof authConfig.emailAndPassword === 'object'
      ? authConfig.emailAndPassword
      : {}
  const requireEmailVerification = emailAndPasswordConfig.requireEmailVerification ?? false

  // Create email handlers with custom templates if provided
  const passwordResetHandler = createPasswordResetEmailHandler(
    authConfig?.emailTemplates?.resetPassword
  )
  const verificationEmailHandler = createVerificationEmailHandler(
    authConfig?.emailTemplates?.verification
  )

  return betterAuth({
    // Infrastructure config from environment variables
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_BASE_URL,

    database: drizzleAdapter(db, {
      provider: 'pg',
      usePlural: true,
    }),
    // Allow any redirect URL for testing (should be restricted in production)
    trustedOrigins: ['*'],
    // Disable CSRF protection for testing (should be enabled in production)
    advanced: {
      useSecureCookies: process.env.NODE_ENV === 'production',
      disableCSRFCheck: process.env.NODE_ENV !== 'production',
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification, // Dynamic based on app config
      sendResetPassword: passwordResetHandler,
    },
    // Email verification configuration - REQUIRED for send-verification-email endpoint
    emailVerification: {
      sendOnSignUp: requireEmailVerification, // Only send on sign-up if required
      autoSignInAfterVerification: true, // Auto sign-in user after they verify their email
      sendVerificationEmail: verificationEmailHandler,
    },
    plugins: [
      openAPI({
        disableDefaultReference: true, // Use unified Scalar UI instead
      }),
      admin(),
      organization(),
      apiKey(),
      twoFactor(),
    ],
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
