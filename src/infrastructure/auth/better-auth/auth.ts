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

export const auth = betterAuth({
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
    requireEmailVerification: false, // Allow sign-up without email verification for testing
    // Password reset configuration
    sendResetPassword: async ({
      user,
      url,
      token,
    }: Readonly<{
      user: Readonly<{ email: string }>
      url: string
      token: string
    }>) => {
      /**
       * TODO (Phase 2): Email Service Integration
       *
       * Current Implementation:
       * - Console logging for development and E2E test verification
       * - Allows tests to verify email functionality without SMTP
       *
       * Future Implementation (Phase 2):
       * - Integrate email service provider (Resend, SendGrid, or AWS SES)
       * - Add email templates for password reset
       * - Implement retry logic and error handling
       * - Add rate limiting for email sending
       *
       * Security Considerations:
       * - Token expires after configured period (Better Auth default)
       * - One-time use token (invalidated after use)
       * - HTTPS-only URLs in production
       */
      console.log(`[TEST] Password reset for ${user.email}: ${url}?token=${token}`)
    },
    // Email verification configuration
    sendVerificationEmail: async ({
      user,
      url,
      token,
    }: Readonly<{
      user: Readonly<{ email: string }>
      url: string
      token: string
    }>) => {
      /**
       * TODO (Phase 2): Email Service Integration
       *
       * Current Implementation:
       * - Console logging for development and E2E test verification
       * - Allows tests to verify email functionality without SMTP
       *
       * Future Implementation (Phase 2):
       * - Integrate email service provider (Resend, SendGrid, or AWS SES)
       * - Add email templates for email verification
       * - Implement retry logic and error handling
       * - Add rate limiting for email sending
       *
       * Security Considerations:
       * - Token expires after configured period (Better Auth default)
       * - One-time use token (invalidated after use)
       * - HTTPS-only URLs in production
       */
      console.log(`[TEST] Email verification for ${user.email}: ${url}?token=${token}`)
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
