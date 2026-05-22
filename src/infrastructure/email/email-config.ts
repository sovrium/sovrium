/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isProduction as isProductionEnv } from '@/infrastructure/utils/env'
import { logError } from '../logging'
import type { EmailConfig } from './nodemailer'

export interface EmailConfigResult {
  readonly configured: boolean
  readonly config: EmailConfig | undefined
}


export const isEmailConfigured = (): boolean => Boolean(process.env.SMTP_HOST)

const getEnvString = (key: string, defaultValue: string): string => process.env[key] ?? defaultValue

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key]
  return value ? parseInt(value, 10) : defaultValue
}

const getEnvBoolean = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key]
  return value ? value === 'true' : defaultValue
}

export const getEmailConfigFromEffect = (): EmailConfigResult => {
  const host = process.env.SMTP_HOST

  if (host) {
    const port = getEnvNumber('SMTP_PORT', 587)
    return {
      configured: true,
      config: {
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
      },
    }
  }

  if (isProductionEnv()) {
    logError('[EMAIL] SMTP_HOST not configured in production mode')
  }

  return { configured: false, config: undefined }
}
