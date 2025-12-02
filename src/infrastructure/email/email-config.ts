/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { logError, logWarning } from '../logging'
import type { EmailConfig } from './nodemailer'

/**
 * SMTP Configuration using type-safe environment variable access
 *
 * This module provides email configuration with:
 * 1. Type-safe environment variable access
 * 2. Sensible defaults for development (Mailpit)
 * 3. Structured logging for missing configuration
 * 4. Clear separation of production vs development modes
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
 * Get email configuration from environment variables
 *
 * In production, SMTP_HOST is required. In development, falls back to
 * localhost:1025 (Mailpit) for local email testing.
 */
export const getEmailConfigFromEffect = (): EmailConfig => {
  const host = process.env.SMTP_HOST
  const isProduction = process.env.NODE_ENV === 'production'

  // Use real SMTP when host is configured
  if (host) {
    const port = getEnvNumber('SMTP_PORT', 587)
    return {
      host,
      port,
      secure: getEnvBoolean('SMTP_SECURE', false) || port === 465,
      auth: {
        user: getEnvString('SMTP_USER', ''),
        pass: getEnvString('SMTP_PASS', ''),
      },
      from: {
        email: getEnvString('SMTP_FROM', 'noreply@sovrium.com'),
        name: getEnvString('SMTP_FROM_NAME', 'Sovrium'),
      },
    }
  }

  // Log warnings for missing SMTP config
  if (isProduction) {
    logError('[EMAIL] SMTP_HOST not configured in production mode')
  } else {
    logWarning('[EMAIL] SMTP_HOST not configured, using 127.0.0.1:1025 (Mailpit)')
  }

  // Development fallback - Mailpit on localhost
  // Use explicit IPv4 address to avoid IPv6 resolution issues
  return {
    host: '127.0.0.1',
    port: 1025,
    secure: false,
    auth: {
      user: '',
      pass: '',
    },
    from: {
      email: getEnvString('SMTP_FROM', 'noreply@sovrium.local'),
      name: getEnvString('SMTP_FROM_NAME', 'Sovrium (Dev)'),
    },
  }
}
