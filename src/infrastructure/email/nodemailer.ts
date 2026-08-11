/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import nodemailer from 'nodemailer'
import { getEmailConfigFromEffect } from './email-config'
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
 * Get email configuration from environment variables.
 *
 * Returns `undefined` when `SMTP_HOST` is unset — outgoing email is disabled
 * and no transport should be created. When set, returns the resolved SMTP
 * configuration.
 *
 * Environment Variables:
 * - SMTP_HOST: SMTP server hostname (required to enable email)
 * - SMTP_PORT: SMTP server port (default: 587)
 * - SMTP_SECURE: Use SSL/TLS (default: false for port 587, true for port 465)
 * - SMTP_USER: SMTP authentication username
 * - SMTP_PASS: SMTP authentication password
 * - SMTP_FROM: Default "from" email address (default: noreply@sovrium.com)
 * - SMTP_FROM_NAME: Default "from" display name (default: 'Sovrium')
 *
 * @see ./email-config.ts for the underlying configuration resolution
 */
export function getEmailConfig(): EmailConfig | undefined {
  return getEmailConfigFromEffect().config
}

/**
 * Default per-phase SMTP timeout (milliseconds). Nodemailer's own defaults are
 * generous (~2min to connect, ~30s greeting), which lets a slow or half-open
 * SMTP server stall a synchronous `sendMail` for minutes — e.g. a comment
 * automation email action awaited inside the comment-create POST. Bounding each
 * phase keeps a degraded transport from holding the request open.
 */
const DEFAULT_SMTP_TIMEOUT_MS = 10_000

/**
 * Resolve an SMTP phase timeout (milliseconds) from an env var, falling back to
 * {@link DEFAULT_SMTP_TIMEOUT_MS}. Read directly from `process.env` — matching
 * how `getDefaultFrom` reads `SMTP_FROM` — so operators can tune transport
 * timeouts without touching `EmailConfig`. Non-numeric / non-positive values
 * fall back to the default.
 */
function resolveSmtpTimeout(envVar: string): number {
  const raw = process.env[envVar]
  if (raw === undefined) return DEFAULT_SMTP_TIMEOUT_MS
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SMTP_TIMEOUT_MS
}

/**
 * Create a nodemailer transporter from configuration.
 *
 * The transport is bounded on every phase (TCP connect, SMTP greeting, socket
 * inactivity) so a slow/half-open SMTP server fails fast instead of stalling a
 * synchronous send. Each bound is env-overridable (`SMTP_CONNECTION_TIMEOUT`,
 * `SMTP_GREETING_TIMEOUT`, `SMTP_SOCKET_TIMEOUT`, all in ms) with a 10s default.
 */
/* eslint-disable functional/prefer-immutable-types -- nodemailer transporter is inherently mutable */
export function createTransporter(
  config: Readonly<EmailConfig>
): nodemailer.Transporter<SMTPTransport.SentMessageInfo> {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    connectionTimeout: resolveSmtpTimeout('SMTP_CONNECTION_TIMEOUT'),
    greetingTimeout: resolveSmtpTimeout('SMTP_GREETING_TIMEOUT'),
    socketTimeout: resolveSmtpTimeout('SMTP_SOCKET_TIMEOUT'),
  })
}
/* eslint-enable functional/prefer-immutable-types */

/**
 * Pre-configured transporter using environment variables
 *
 * @example
 * ```typescript
 * import { getTransporter, getDefaultFrom } from '@/infrastructure/email/nodemailer'
 *
 * const transporter = getTransporter()
 * if (transporter) {
 *   await transporter.sendMail({
 *     from: getDefaultFrom(),
 *     to: 'user@example.com',
 *     subject: 'Hello',
 *     text: 'Hello World',
 *   })
 * }
 * ```
 */
// eslint-disable-next-line functional/no-let -- lazy singleton cache for email config
let _config: EmailConfig | undefined
// eslint-disable-next-line functional/no-let, functional/prefer-immutable-types -- lazy singleton cache for transporter
let _transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | undefined

function getLazyConfig(): EmailConfig | undefined {
  if (!_config) {
    // eslint-disable-next-line functional/no-expression-statements -- lazy initialization
    _config = getEmailConfig()
  }
  return _config
}

/**
 * Returns the SMTP transporter, or `undefined` when email is unconfigured
 * (`SMTP_HOST` unset). Callers MUST handle the `undefined` case — when email is
 * disabled no transport is created and no connection is attempted.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- nodemailer Transporter is mutable by library design
export function getTransporter():
  nodemailer.Transporter<SMTPTransport.SentMessageInfo> | undefined {
  const config = getLazyConfig()
  if (!config) return undefined
  if (!_transporter) {
    // eslint-disable-next-line functional/no-expression-statements -- lazy initialization
    _transporter = createTransporter(config)
  }
  return _transporter
}

/**
 * Get the default "from" address formatted for email headers.
 *
 * Reads `SMTP_FROM` / `SMTP_FROM_NAME` directly so it remains usable even when
 * no transport exists (email disabled). Falls back to the platform defaults.
 */
export function getDefaultFrom(): string {
  const email = process.env.SMTP_FROM ?? 'noreply@sovrium.com'
  const name = process.env.SMTP_FROM_NAME ?? 'Sovrium'
  return `"${name}" <${email}>`
}

/**
 * Send email options type (re-exported for convenience)
 */
export type SendMailOptions = Mail.Options

/**
 * Verify SMTP connection
 *
 * Useful for health checks and startup validation. Returns `false` when email
 * is unconfigured (no transport to verify).
 *
 * @returns Promise that resolves to true if the connection is valid, false when
 *   email is disabled
 * @public
 */
export async function verifyConnection(): Promise<boolean> {
  const transporter = getTransporter()
  if (!transporter) return false
  return transporter.verify()
}
