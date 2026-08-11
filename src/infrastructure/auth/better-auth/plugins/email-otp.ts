/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { emailOTP } from 'better-auth/plugins'
import type { Auth } from '@/domain/models/app/auth'

/**
 * Build email OTP plugin if emailOtp email template is configured
 *
 * The email OTP plugin is enabled when `auth.emailTemplates.emailOtp` is present,
 * allowing users to receive one-time codes via email for verification flows.
 */
export const buildEmailOtpPlugin = (
  sendVerificationOTP: (data: {
    readonly email: string
    readonly otp: string
    readonly type: string
  }) => Promise<void>,
  authConfig?: Auth
) => {
  return authConfig?.emailTemplates?.emailOtp
    ? [
        emailOTP({
          sendVerificationOTP: async ({ email, otp, type }) =>
            sendVerificationOTP({ email, otp, type }),
        }),
      ]
    : []
}
