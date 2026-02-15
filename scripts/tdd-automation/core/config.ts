/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * TDD Automation Configuration
 *
 * Environment-based configuration with sensible defaults.
 * All values can be overridden via environment variables.
 */

/**
 * TDD Automation Labels used for PR state management
 */
export const TDD_LABELS = {
  /** Main TDD automation label - identifies TDD PRs */
  AUTOMATION: 'tdd-automation',
  /** Manual intervention required (on any error) */
  MANUAL_INTERVENTION: 'tdd-automation:manual-intervention',
} as const

/**
 * Get configuration from environment with defaults
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key]
  if (value === undefined) return defaultValue
  const parsed = Number(value)
  return Number.isNaN(parsed) ? defaultValue : parsed
}

/**
 * TDD Automation Configuration
 *
 * Configurable via environment variables:
 * - TDD_MAX_ATTEMPTS: Maximum attempts before manual intervention (default: 5)
 * - TDD_DAILY_LIMIT: Daily credit limit in dollars (default: 200)
 * - TDD_WEEKLY_LIMIT: Weekly credit limit in dollars (default: 1000)
 * - TDD_WARNING_THRESHOLD: Warning threshold percentage (default: 0.8)
 * - TDD_FALLBACK_COST: Fallback cost per run when parsing fails (default: 15)
 */
export const TDD_CONFIG = {
  /** Maximum attempts before manual intervention */
  get MAX_ATTEMPTS(): number {
    return getEnvNumber('TDD_MAX_ATTEMPTS', 5)
  },

  /** Daily credit limit in dollars */
  get DAILY_LIMIT(): number {
    return getEnvNumber('TDD_DAILY_LIMIT', 200)
  },

  /** Weekly credit limit in dollars */
  get WEEKLY_LIMIT(): number {
    return getEnvNumber('TDD_WEEKLY_LIMIT', 1000)
  },

  /** Warning threshold percentage (0.8 = 80%) */
  get WARNING_THRESHOLD(): number {
    return getEnvNumber('TDD_WARNING_THRESHOLD', 0.8)
  },

  /** Fallback cost per run when parsing fails */
  get FALLBACK_COST_PER_RUN(): number {
    return getEnvNumber('TDD_FALLBACK_COST', 15)
  },

  /** GitHub repository in owner/repo format */
  get GITHUB_REPOSITORY(): string {
    return process.env['GITHUB_REPOSITORY'] ?? 'anthropics/sovrium'
  },

  /** Claude Code workflow filename */
  get CLAUDE_CODE_WORKFLOW(): string {
    return process.env['TDD_CLAUDE_CODE_WORKFLOW'] ?? 'tdd-claude-code.yml'
  },

  /** Base branch for TDD PRs */
  get BASE_BRANCH(): string {
    return process.env['TDD_BASE_BRANCH'] ?? 'main'
  },
} as const

/**
 * Branch naming pattern: tdd/<spec-id>
 */
export function getTDDBranchName(specId: string): string {
  return `tdd/${specId.toLowerCase()}`
}

/**
 * PR title format: [TDD] Implement <spec-id> | Attempt X/5
 */
export function formatTDDPRTitle(
  specId: string,
  attempt: number,
  maxAttempts: number = TDD_CONFIG.MAX_ATTEMPTS
): string {
  return `[TDD] Implement ${specId} | Attempt ${attempt}/${maxAttempts}`
}
