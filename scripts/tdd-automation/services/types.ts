/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * TDD Automation Service Types
 *
 * Minimal types needed for spec scanning and queue operations.
 */

/**
 * Individual spec item from scanning
 */
export interface SpecItem {
  readonly specId: string
  readonly file: string
  readonly line: number
  readonly description: string
  readonly feature: string
  readonly priority: number
}

/**
 * Result of scanning for .fixme() specs
 */
export interface QueueScanResult {
  readonly timestamp: string
  readonly totalSpecs: number
  readonly specs: readonly SpecItem[]
}
