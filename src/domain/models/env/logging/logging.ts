/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


type EnvRecord = Readonly<Record<string, string | undefined>>

export type LogLevelName = 'debug' | 'info' | 'warn' | 'error'

export interface LoggingConfig {
  readonly level: LogLevelName
}

const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? undefined : trimmed
}

export const parseLoggingConfig = (env: EnvRecord = process.env): LoggingConfig => {
  const raw = clean(env['LOG_LEVEL'])
  if (raw === 'debug' || clean(env['NODE_ENV']) === 'development') {
    return { level: 'debug' }
  }
  if (raw === 'info' || raw === 'warn' || raw === 'error') {
    return { level: raw }
  }
  return { level: 'info' }
}

export const isDebugLevel = (config: LoggingConfig = parseLoggingConfig()): boolean =>
  config.level === 'debug'
