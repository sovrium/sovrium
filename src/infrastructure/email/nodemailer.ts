/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import nodemailer from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'

/**
 * Email configuration from environment variables
 *
 * Required environment variables:
 * - SMTP_HOST: SMTP server hostname (e.g., smtp.gmail.com)
 * - SMTP_PORT: SMTP server port (e.g., 587 for TLS, 465 for SSL)
 * - SMTP_USER: SMTP authentication username
 * - SMTP_PASS: SMTP authentication password
 *
 * Optional environment variables:
 * - SMTP_SECURE: Use SSL (true for port 465, false for other ports)
 * - SMTP_FROM: Default "from" email address
 * - SMTP_FROM_NAME: Default "from" display name
 */
export interface EmailConfig {
  readonly host: string
  readonly port: number
  readonly secure: boolean
  readonly auth: {
    readonly user: string
    readonly pass: string
  }
  readonly from: {
    readonly email: string
    readonly name: string
  }
}

/**
 * Get email configuration from environment variables
 *
 * In production, SMTP_HOST is required. In development, falls back to
 * localhost:1025 (Mailpit) for local email testing.
 *
 * Environment Variables:
 * - SMTP_HOST: SMTP server hostname (required in production)
 * - SMTP_PORT: SMTP server port (default: 587)
 * - SMTP_SECURE: Use SSL/TLS (default: false for port 587, true for port 465)
 * - SMTP_USER: SMTP authentication username
 * - SMTP_PASS: SMTP authentication password
 * - SMTP_FROM: Default "from" email address (default: noreply@sovrium.com)
 * - SMTP_FROM_NAME: Default "from" display name (default: 'Sovrium')
 *
 * @see https://mailpit.axllent.org/ for local development email testing
 */
export function getEmailConfig(): EmailConfig {
  const host = process.env.SMTP_HOST
  const isProduction = process.env.NODE_ENV === 'production'

  // Use real SMTP in production or when explicitly configured
  if (host) {
    const port = parseInt(process.env.SMTP_PORT ?? '587', 10)
    return {
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: {
        user: process.env.SMTP_USER ?? '',
        pass: process.env.SMTP_PASS ?? '',
      },
      from: {
        email: process.env.SMTP_FROM ?? 'noreply@sovrium.com',
        name: process.env.SMTP_FROM_NAME ?? 'Sovrium',
      },
    }
  }

  // No SMTP configured - throw error in production, use defaults in dev
  if (isProduction) {
    throw new Error('[EMAIL] SMTP_HOST is required in production mode')
  }

  // Development fallback - requires Mailpit or similar local SMTP
  // E2E tests configure Mailpit via fixtures.ts
  console.warn('[EMAIL] SMTP_HOST not configured, using localhost:1025 (Mailpit)')
  return {
    host: 'localhost',
    port: 1025,
    secure: false,
    auth: {
      user: '',
      pass: '',
    },
    from: {
      email: process.env.SMTP_FROM ?? 'noreply@sovrium.local',
      name: process.env.SMTP_FROM_NAME ?? 'Sovrium (Dev)',
    },
  }
}

/**
 * Create a nodemailer transporter from configuration
 */
export function createTransporter(
  config: Readonly<EmailConfig>
): nodemailer.Transporter<SMTPTransport.SentMessageInfo> {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  })
}

/**
 * Pre-configured transporter using environment variables
 *
 * @example
 * ```typescript
 * import { transporter, getDefaultFrom } from '@/infrastructure/email/nodemailer'
 *
 * await transporter.sendMail({
 *   from: getDefaultFrom(),
 *   to: 'user@example.com',
 *   subject: 'Hello',
 *   text: 'Hello World',
 * })
 * ```
 */
const config = getEmailConfig()
export const transporter = createTransporter(config)

/**
 * Get the default "from" address formatted for email headers
 */
export function getDefaultFrom(): string {
  const { email, name } = config.from
  return `"${name}" <${email}>`
}

/**
 * Send email options type (re-exported for convenience)
 */
export type SendMailOptions = Mail.Options

/**
 * Verify SMTP connection
 *
 * Useful for health checks and startup validation.
 *
 * @returns Promise that resolves if connection is valid
 * @throws Error if connection fails
 */
export async function verifyConnection(): Promise<boolean> {
  return transporter.verify()
}
