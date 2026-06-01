/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isLocalDevDefault } from '@/domain/utils/dev-mode'
import type { StartupPhase } from '@/infrastructure/logging/logger'

const env = process.env as Record<string, string | undefined>

export const getNodeEnv = (): string | undefined => env['NODE_ENV']
export const isProduction = (): boolean => getNodeEnv() === 'production'
export const isDevelopment = (): boolean => getNodeEnv() === 'development'

export const isDevCacheDisabled = (): boolean =>
  env['SOVRIUM_DEV_NO_CACHE'] === '1' || isDevelopment()

export const isPageCacheDevBypassed = (): boolean => env['SOVRIUM_DEV_NO_CACHE'] === '1'

export const isLiveReloadEligible = (): boolean => isLocalDevDefault(getNodeEnv())

export const isFormAnalyticsEnabled = (): boolean => env['ECO_FORM_ANALYTICS'] !== 'off'

export const collectInsecureEnvWarning = (): StartupPhase | undefined => {
  const nodeEnv = getNodeEnv()
  if (nodeEnv === undefined || nodeEnv === '' || nodeEnv === 'development') {
    return undefined
  }
  return undefined
}
