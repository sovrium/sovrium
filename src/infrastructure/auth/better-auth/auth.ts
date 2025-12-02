/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { openAPI, admin, organization } from 'better-auth/plugins'
import { db } from '../../database/drizzle/db'
import { sendEmail } from '../../email/email-service'
import { passwordResetEmail, emailVerificationEmail } from '../../email/templates'
import type { Auth } from '@/domain/models/app/auth'

/**
 * Password reset email handler for Better Auth
 *
 * Side effects (logging, email sending) are required for Better Auth callbacks
 */
const sendPasswordResetEmail = async ({
  user,
  url,
  token,
}: Readonly<{
  user: Readonly<{ email: string; name?: string }>
  url: string
  token: string
}>) => {
  const resetUrl = `${url}?token=${token}`

  // Always log for testing/debugging
  console.log(`[EMAIL] Password reset for ${user.email}: ${resetUrl}`)

  // Send email (uses Ethereal in development, real SMTP in production)
  try {
    const template = passwordResetEmail({
      userName: user.name,
      resetUrl,
      expiresIn: '1 hour',
    })

    // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
    await sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })

    console.log(`[EMAIL] Password reset email sent to ${user.email}`)
  } catch (error) {
    console.error(`[EMAIL] Failed to send password reset email to ${user.email}:`, error)
    // Don't throw - let the user know the email was "sent" to prevent user enumeration
  }
}

/**
 * Email verification handler for Better Auth
 *
 * Side effects (logging, email sending) are required for Better Auth callbacks
 */
const sendVerificationEmailHandler = async ({
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

  // Always log for testing/debugging - use stderr for immediate output
  console.error(`[EMAIL] Email verification callback triggered for ${user.email}`)
  console.error(`[EMAIL] Verification URL: ${verifyUrl}`)

  // Send email (uses Ethereal in development, real SMTP in production)
  try {
    const template = emailVerificationEmail({
      userName: user.name,
      verifyUrl,
      expiresIn: '24 hours',
    })

    // eslint-disable-next-line functional/no-expression-statements -- Better Auth email callback requires side effect
    await sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })

    console.log(`[EMAIL] Verification email sent to ${user.email}`)
  } catch (error) {
    console.error(`[EMAIL] Failed to send verification email to ${user.email}:`, error)
    // Don't throw - let the user know the email was "sent" to prevent user enumeration
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

  // Debug logging for email verification configuration
  // Write to stderr since stdout may be buffered
  console.error('[AUTH] Creating auth instance with config:', JSON.stringify(authConfig, null, 2))
  console.error('[AUTH] emailAndPasswordConfig:', JSON.stringify(emailAndPasswordConfig, null, 2))
  console.error('[AUTH] requireEmailVerification:', requireEmailVerification)

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
      sendResetPassword: sendPasswordResetEmail,
    },
    // Email verification configuration - REQUIRED for send-verification-email endpoint
    emailVerification: {
      sendOnSignUp: requireEmailVerification, // Only send on sign-up if required
      autoSignInAfterVerification: true, // Auto sign-in user after they verify their email
      sendVerificationEmail: sendVerificationEmailHandler,
    },
    plugins: [
      openAPI({
        disableDefaultReference: true, // Use unified Scalar UI instead
      }),
      admin(),
      organization(),
    ],
  })
}

/**
 * Default Better Auth instance for backward compatibility
 * Uses default configuration (requireEmailVerification: false)
 */
export const auth = createAuthInstance()
