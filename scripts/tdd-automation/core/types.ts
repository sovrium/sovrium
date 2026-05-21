/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export { TDD_CONFIG, TDD_LABELS, getTDDBranchName, formatTDDPRTitle } from './config'

export interface TDDPRTitle {
  readonly specId: string
  readonly attempt: number
  readonly maxAttempts: number
}

export interface TDDPullRequest {
  readonly number: number
  readonly title: string
  readonly branch: string
  readonly specId: string
  readonly attempt: number
  readonly maxAttempts: number
  readonly labels: readonly string[]
  readonly hasManualInterventionLabel: boolean
}

export interface ReadySpec {
  readonly specId: string
  readonly file: string
  readonly line: number
  readonly description: string
  readonly priority: number
}

export interface SpecItem {
  readonly specId: string
  readonly file: string
  readonly line: number
  readonly description: string
  readonly feature: string
  readonly priority: number
}

export interface QueueScanResult {
  readonly timestamp: string
  readonly totalSpecs: number
  readonly specs: readonly SpecItem[]
}
