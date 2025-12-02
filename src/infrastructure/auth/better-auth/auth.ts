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

/**
 * Better Auth Configuration
 *
 * Infrastructure configuration via environment variables:
 * - BETTER_AUTH_SECRET: Secret key for signing tokens (required in production)
 * - BETTER_AUTH_BASE_URL: Base URL for callbacks (optional, auto-detected)
 * - ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME: Default admin user (optional)
 *
 * Email configuration:
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS: SMTP configuration
 * - Falls back to Ethereal test SMTP in development
 */
export const auth = betterAuth({
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
    requireEmailVerification: true, // Enable email verification to allow send-verification-email endpoint
    autoSignIn: true, // Allow users to sign in even before verifying email
    // Password reset configuration
    sendResetPassword: async ({
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
    },
    // Email verification configuration
    sendVerificationEmail: async ({
      user,
      url,
      token,
    }: Readonly<{
      user: Readonly<{ email: string; name?: string }>
      url: string
      token: string
    }>) => {
      const verifyUrl = `${url}?token=${token}`

      // Always log for testing/debugging
      console.log(`[EMAIL] Email verification for ${user.email}: ${verifyUrl}`)

      // Send email (uses Ethereal in development, real SMTP in production)
      try {
        const template = emailVerificationEmail({
          userName: user.name,
          verifyUrl,
          expiresIn: '24 hours',
        })

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
    },
  },
  plugins: [
    openAPI({
      disableDefaultReference: true, // Use unified Scalar UI instead
    }),
    admin(),
    organization(),
  ],
})
