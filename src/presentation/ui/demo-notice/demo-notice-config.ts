/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  hasDemoCredentials,
  isDemoNoticeEnabled,
  parseDemoNoticeEnvConfig,
  resolveDemoName,
  type DemoNoticeEnvConfig,
} from '@/domain/models/env/demo-notice'

export interface DemoNoticeDisplayConfig {
  readonly name?: string
  readonly credentials?: { readonly email: string; readonly password: string }
  readonly url?: string
}

const presence = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? undefined : trimmed
}

export const resolveDemoNoticeDisplayConfig = (
  config: DemoNoticeEnvConfig
): DemoNoticeDisplayConfig | undefined => {
  if (!isDemoNoticeEnabled(config)) return undefined
  const name = resolveDemoName(config)
  const url = presence(config.url)
  const credentials = hasDemoCredentials(config)
    ? { email: presence(config.email) ?? '', password: presence(config.password) ?? '' }
    : undefined
  return {
    ...(name ? { name } : {}),
    ...(credentials ? { credentials } : {}),
    ...(url ? { url } : {}),
  }
}

const RESOLVED_DEMO_NOTICE = resolveDemoNoticeDisplayConfig(parseDemoNoticeEnvConfig())

export const getDemoNoticeDisplayConfig = (): DemoNoticeDisplayConfig | undefined =>
  RESOLVED_DEMO_NOTICE
