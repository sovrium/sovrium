/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

const env = process.env as Record<string, string | undefined>

export const getNodeEnv = (): string | undefined => env['NODE_ENV']
export const isProduction = (): boolean => getNodeEnv() === 'production'
export const isDevelopment = (): boolean => getNodeEnv() === 'development'

export const warnIfInsecureEnv = (): void => {
  const nodeEnv = getNodeEnv()
  if (nodeEnv === undefined || nodeEnv === '') {
    console.warn(
      '⚠️  NODE_ENV is not set — CSRF protection and secure cookies are ' +
        'DISABLED (development defaults). Set NODE_ENV=production for any ' +
        'internet-facing deployment.'
    )
  }
}
