/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export type EcoLowDataDefault = 'on' | 'off' | 'respect-client'

const ECO_LOW_DATA_DEFAULTS: ReadonlySet<EcoLowDataDefault> = new Set([
  'on',
  'off',
  'respect-client',
])

export const DEFAULT_ECO_LOW_DATA_DEFAULT: EcoLowDataDefault = 'off'

export const parseEcoLowDataDefault = (
  processEnv: Readonly<Record<string, string | undefined>>
): EcoLowDataDefault => {
  const raw = processEnv['ECO_LOW_DATA_DEFAULT']?.trim().toLowerCase()
  return raw !== undefined && ECO_LOW_DATA_DEFAULTS.has(raw as EcoLowDataDefault)
    ? (raw as EcoLowDataDefault)
    : DEFAULT_ECO_LOW_DATA_DEFAULT
}

export interface LowDataSignals {
  readonly saveData: string | undefined
  readonly clientHint: string | undefined
  readonly cookie: 'on' | 'off' | undefined
}

export const resolveLowDataMode = (env: EcoLowDataDefault, signals: LowDataSignals): boolean => {
  if (signals.cookie === 'off') return false
  if (signals.cookie === 'on') return true
  if (env === 'on') return true
  if (env === 'off') return false
  return signals.saveData?.toLowerCase() === 'on' || signals.clientHint?.toLowerCase() === 'reduce'
}
