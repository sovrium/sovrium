/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export {
  transporter,
  getDefaultFrom,
  getEmailConfig,
  createTransporter,
  verifyConnection,
  type EmailConfig,
  type SendMailOptions,
} from './nodemailer'

export {
  Email,
  EmailLive,
  EmailError,
  EmailConnectionError,
  sendEmail,
  sendEmailWithOptions,
  type EmailService,
} from './email-service'

export { getEmailConfigFromEffect, type EmailConfigResult } from './email-config'

export {
  passwordResetEmail,
  emailVerificationEmail,
  type PasswordResetEmailData,
  type EmailVerificationData,
} from './templates'
