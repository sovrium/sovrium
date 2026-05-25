/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export type EcoIndexHeaderMode = 'on' | 'off'

export const DEFAULT_ECO_INDEX_HEADER: EcoIndexHeaderMode = 'on'

export const parseEcoIndexHeader = (
  processEnv: Readonly<Record<string, string | undefined>>
): EcoIndexHeaderMode => {
  const raw = processEnv['ECO_INDEX_HEADER']?.trim().toLowerCase()
  return raw === 'off' ? 'off' : DEFAULT_ECO_INDEX_HEADER
}

export type EcoIndexGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

const ECO_INDEX_THRESHOLDS: readonly {
  readonly maxBytes: number
  readonly grade: EcoIndexGrade
}[] = [
  { maxBytes: 2 * 1024, grade: 'A' },
  { maxBytes: 4 * 1024, grade: 'B' },
  { maxBytes: 8 * 1024, grade: 'C' },
  { maxBytes: 30 * 1024, grade: 'D' },
  { maxBytes: 100 * 1024, grade: 'E' },
  { maxBytes: 300 * 1024, grade: 'F' },
]

export const gradeBytes = (bytes: number): EcoIndexGrade => {
  const matched = ECO_INDEX_THRESHOLDS.find((tier) => bytes <= tier.maxBytes)
  return matched?.grade ?? 'G'
}
