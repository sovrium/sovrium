/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isLoopbackHost, isSmtpPlaintextAllowed } from '@/infrastructure/process/security-posture'
import type { EmailConfig } from './nodemailer'

/**
 * Result of email configuration resolution.
 *
 * - `configured: true` with a populated `config` when `SMTP_HOST` is set.
 * - `configured: false` with `config: undefined` when `SMTP_HOST` is unset —
 *   outgoing email is disabled (logged, not sent). There is no localhost
 *   fallback transport in the runtime.
 */
export interface EmailConfigResult {
  readonly configured: boolean
  readonly config: EmailConfig | undefined
}

/**
 * SMTP Configuration using type-safe environment variable access
 *
 * This module provides email configuration with:
 * 1. Type-safe environment variable access
 * 2. Email disabled (no transport) when SMTP is unconfigured
 *
 * Environment Variables:
 * - SMTP_HOST: SMTP server hostname (required to enable email)
 * - SMTP_PORT: SMTP server port (default: 587)
 * - SMTP_SECURE: Use SSL/TLS (default: false for port 587, true for port 465)
 * - SMTP_USER: SMTP authentication username
 * - SMTP_PASS: SMTP authentication password
 * - SMTP_ALLOW_PLAINTEXT: `1`/`true` lets a remote server without STARTTLS
 *   receive the account and the message in clear text
 *
 * The sender (`SMTP_FROM` / `SMTP_FROM_NAME`) is NOT part of this config: it is
 * resolved per message by `getDefaultFrom`, which also knows the sending app's
 * name. A second default here would be a second answer to the same question.
 */

/**
 * Read optional string from environment
 */
const getEnvString = (key: string, defaultValue: string): string => process.env[key] ?? defaultValue

/**
 * Read optional number from environment
 */
const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key]
  return value ? parseInt(value, 10) : defaultValue
}

/**
 * Read optional boolean from environment
 */
const getEnvBoolean = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key]
  return value ? value === 'true' : defaultValue
}

/**
 * Whether a connection must upgrade with STARTTLS before the account or the
 * message is sent.
 *
 * Without it, nodemailer upgrades only when the server's greeting OFFERS
 * STARTTLS — so anyone on the path who strips that one line from the greeting
 * receives `AUTH` and the message in clear text. Required unless the
 * connection is TLS from the first byte, the SMTP host is loopback (a mail
 * catcher on the same machine; `0.0.0.0` is not loopback), or the operator set
 * `SMTP_ALLOW_PLAINTEXT` for a relay on a network they control.
 */
const requiresStartTls = (host: string, secure: boolean): boolean =>
  !secure && !isLoopbackHost(host) && !isSmtpPlaintextAllowed(process.env)

/**
 * Get email configuration from environment variables.
 *
 * When `SMTP_HOST` is set, returns the resolved SMTP config with
 * `configured: true`. When unset, returns `{ configured: false, config: undefined }`
 * — outgoing email is disabled, silently. Who gets told about that, and how
 * much they are told, is decided at the SEND site
 * (`reportUndeliverableMessage`) and at boot (the startup SMTP phase), never
 * here — see the comment on the disabled branch below.
 */
export const getEmailConfigFromEffect = (): EmailConfigResult => {
  const host = process.env.SMTP_HOST

  // Use real SMTP when host is configured
  if (host) {
    const port = getEnvNumber('SMTP_PORT', 587)
    const secure = getEnvBoolean('SMTP_SECURE', false) || port === 465
    return {
      configured: true,
      config: {
        host,
        port,
        secure,
        requireTLS: requiresStartTls(host, secure),
        auth: {
          user: getEnvString('SMTP_USER', ''),
          pass: getEnvString('SMTP_PASS', ''),
        },
      },
    }
  }

  // Email is disabled — no transport, no localhost fallback.
  //
  // NOTHING IS LOGGED HERE: a `logError('[EMAIL] SMTP_HOST not configured in
  // production mode')` on this line would be unreachable rather than merely
  // redundant. The only runtime route into this
  // function is `getTransporter()`, and its only live caller — `deliver()` —
  // reaches it exclusively on the branch where `isEmailConfigured()` already
  // answered TRUE, i.e. where `SMTP_HOST` is set and this branch cannot be
  // taken. (`verifyConnection` would reach it, and has no caller outside its
  // own unit tests.)
  //
  // The two places that DO tell an operator are both live and both better
  // positioned: the `⚠ Email sending disabled — SMTP not configured` startup
  // phase, which fires once at boot and only when email is load-bearing for
  // the config, and `reportUndeliverableMessage`, which fires per dropped
  // message and names the recipient.
  return { configured: false, config: undefined }
}
