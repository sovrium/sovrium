/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * TDD Automation V2 - Type Definitions
 *
 * Core types for the simplified TDD workflow that processes spec files
 * continuously with file-level locking and intelligent retry logic.
 */

/**
 * Main state file structure
 *
 * This represents the entire queue state stored in `.github/tdd-state.json`
 */
export interface TDDState {
  version: '2.0.0'
  lastUpdated: string // ISO 8601 timestamp

  queue: {
    pending: SpecFileItem[] // Not yet started
    active: SpecFileItem[] // PR currently in progress
    completed: SpecFileItem[] // Successfully merged (last 100)
    failed: SpecFileItem[] // Needs manual intervention (3+ failures)
  }

  // File-level locking to prevent concurrent work on same file
  activeFiles: string[] // List of file paths currently being processed

  config: {
    maxConcurrentPRs: number // Default: 3
    maxRetries: number // Default: 3 (after 3rd failure → manual intervention)
    retryDelayMinutes: number // Default: 5
    autoMergeEnabled: boolean // Default: true
  }

  metrics: {
    totalProcessed: number
    successRate: number // 0-1
    averageProcessingTime: number // minutes
    claudeInvocations: number
    costSavingsFromSkips: number // USD
    manualInterventionCount: number // Specs moved to failed status
  }
}

/**
 * Represents a single spec file in the queue
 *
 * Work granularity is file-level: all tests in a file are processed atomically
 */
export interface SpecFileItem {
  id: string // File path (e.g., "specs/api/tables/create.spec.ts")
  filePath: string // Same as id (for clarity)
  priority: number // 0-100 (higher = more important)
  status: 'pending' | 'active' | 'completed' | 'failed'

  testCount: number // Total tests in file (from .fixme() count)

  // Active/Failed status only
  prNumber?: number
  prUrl?: string
  branch?: string

  // Retry tracking (3 strikes rule)
  attempts: number // 0-3 (after 3 → move to failed)
  lastAttempt?: string // ISO 8601 timestamp
  errors: SpecError[] // Historical failures (max 3)

  // Timestamps
  queuedAt: string // ISO 8601 timestamp
  startedAt?: string
  completedAt?: string

  // Manual intervention (failed status only)
  failureReason?: string // Human-readable explanation
  requiresAction?: string // What needs to be done manually
}

/**
 * Error details for a failed attempt
 */
export interface SpecError {
  timestamp: string // ISO 8601 timestamp
  type: 'spec-failure' | 'regression' | 'infrastructure' | 'unknown'
  message: string // Short summary
  details?: string // Full error log
  affectedSpecs?: string[] // For regressions: which other tests failed
}

/**
 * Status type for spec files
 */
export type SpecStatus = 'pending' | 'active' | 'completed' | 'failed'

/**
 * Error type classification
 */
export type ErrorType = 'spec-failure' | 'regression' | 'infrastructure' | 'unknown'

/**
 * Worker dispatch input
 */
export interface WorkerInput {
  spec_file: string
  priority: number
  retry_count: number
  previous_errors: string // JSON stringified SpecError[]
  test_count: number
}

/**
 * Orchestrator result
 */
export interface OrchestrationResult {
  dispatched: number
  reason?: 'no-credits' | 'max-concurrency' | 'empty-queue'
  files?: string[]
}

/**
 * Pre-validation result
 */
export interface PreValidationResult {
  result: 'passed' | 'failed'
  passed: number // Tests that passed
  failed: number // Tests that failed
  output: string // Raw test output
}

/**
 * Manual intervention issue data
 */
export interface ManualInterventionIssue {
  filePath: string
  attempts: number
  lastError: SpecError
  actionGuide: string
}

/**
 * Re-queue options
 */
export interface RequeueOptions {
  resetRetries: boolean
  clearErrors: boolean
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  maxConcurrentPRs: 3,
  maxRetries: 3,
  retryDelayMinutes: 5,
  autoMergeEnabled: true,
} as const

/**
 * Initial empty state
 */
export const INITIAL_STATE: TDDState = {
  version: '2.0.0',
  lastUpdated: new Date().toISOString(),
  queue: {
    pending: [],
    active: [],
    completed: [],
    failed: [],
  },
  activeFiles: [],
  config: DEFAULT_CONFIG,
  metrics: {
    totalProcessed: 0,
    successRate: 0,
    averageProcessingTime: 0,
    claudeInvocations: 0,
    costSavingsFromSkips: 0,
    manualInterventionCount: 0,
  },
}
