/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export type EcoMode = 'strict' | 'balanced' | 'lenient'

export const DEFAULT_ECO_MODE: EcoMode = 'balanced'

export const parseEcoMode = (processEnv: Readonly<Record<string, string | undefined>>): EcoMode => {
  const raw = processEnv['ECO_MODE']?.trim().toLowerCase()
  if (raw === 'strict') return 'strict'
  if (raw === 'lenient' || raw === 'off') return 'lenient'
  return DEFAULT_ECO_MODE
}

export type EcoSubKnob =
  | 'ECO_LOW_DATA_DEFAULT'
  | 'ECO_AI_MAX_CARBON_CLASS'
  | 'ECO_RETENTION_PURGE_DAYS'

export const resolveActivatedSubKnobs = (mode: EcoMode): readonly EcoSubKnob[] => {
  if (mode === 'strict') {
    return ['ECO_LOW_DATA_DEFAULT', 'ECO_AI_MAX_CARBON_CLASS', 'ECO_RETENTION_PURGE_DAYS']
  }
  return []
}
