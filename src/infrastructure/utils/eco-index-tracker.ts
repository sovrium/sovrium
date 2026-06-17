/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { type EcoIndexGrade } from '@/domain/models/env/eco/eco-index-header'

export interface EcoIndexTrackerSnapshot {
  readonly currentGrade: EcoIndexGrade
  readonly graded: number
  readonly since: string
}

let bootTimestamp: string = new Date().toISOString()
let gradedCount = 0
let currentGrade: EcoIndexGrade = 'A'

export const recordGradedResponse = (grade: EcoIndexGrade): void => {
  gradedCount += 1
  currentGrade = grade
}

export const readEcoIndexTrackerSnapshot = (): EcoIndexTrackerSnapshot => ({
  currentGrade,
  graded: gradedCount,
  since: bootTimestamp,
})

export const resetEcoIndexTrackerForTesting = (): void => {
  bootTimestamp = new Date().toISOString()
  gradedCount = 0
  currentGrade = 'A'
}
