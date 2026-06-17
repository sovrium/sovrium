/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export type CarbonClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

const CARBON_CLASSES: readonly CarbonClass[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

export const DEFAULT_ECO_AI_MAX_CARBON_CLASS: CarbonClass = 'G'

export const parseEcoAiMaxCarbonClass = (
  processEnv: Readonly<Record<string, string | undefined>>
): CarbonClass => {
  const raw = processEnv['ECO_AI_MAX_CARBON_CLASS']?.trim().toUpperCase()
  return raw !== undefined && (CARBON_CLASSES as readonly string[]).includes(raw)
    ? (raw as CarbonClass)
    : DEFAULT_ECO_AI_MAX_CARBON_CLASS
}
