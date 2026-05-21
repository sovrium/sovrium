/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const TDD_LABELS = {
  AUTOMATION: 'tdd-automation',
  MANUAL_INTERVENTION: 'tdd-automation:manual-intervention',
  CLAUDE_RUNNING: 'tdd-automation:claude-running',
} as const

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key]
  if (value === undefined) return defaultValue
  const parsed = Number(value)
  return Number.isNaN(parsed) ? defaultValue : parsed
}

export const TDD_CONFIG = {
  get MAX_ATTEMPTS(): number {
    return getEnvNumber('TDD_MAX_ATTEMPTS', 3)
  },

  get REPOSITORY(): string {
    return process.env['FORGEJO_REPOSITORY'] ?? 'sovrium/sovrium'
  },

  get FORGE_URL(): string {
    return process.env['FORGEJO_URL'] ?? 'https://git.sovrium.com'
  },

  get CLAUDE_CODE_WORKFLOW(): string {
    return process.env['TDD_CLAUDE_CODE_WORKFLOW'] ?? 'tdd-claude-code.yml'
  },

  get BASE_BRANCH(): string {
    return process.env['TDD_BASE_BRANCH'] ?? 'main'
  },
} as const

export function getTDDBranchName(specId: string): string {
  return `tdd/${specId.toLowerCase()}`
}

export function formatTDDPRTitle(
  specId: string,
  attempt: number,
  maxAttempts: number = TDD_CONFIG.MAX_ATTEMPTS
): string {
  return `[TDD] Implement ${specId} | Attempt ${attempt}/${maxAttempts}`
}


export const TDD_V4_LABELS = {
  AUTOMATION: 'tdd-v4',
  CLAUDE_RUNNING: 'tdd-v4:claude-running',
  MANUAL_INTERVENTION: 'tdd-v4:manual-intervention',
  PARTIAL_MERGE: 'tdd-v4:partial-merge',
} as const

export const TDD_V4_CONFIG = {
  get MAX_PARTIAL_MERGE_CYCLES(): number {
    return getEnvNumber('TDD_V4_MAX_PARTIAL_MERGE_CYCLES', 3)
  },
  get MAX_CONCURRENT(): number {
    return getEnvNumber('TDD_V4_MAX_CONCURRENT', 1)
  },
  get MAX_TIERS(): number {
    return getEnvNumber('TDD_V4_MAX_TIERS', 2)
  },
} as const

export function getTDDV4BranchName(slug: string): string {
  return `tdd-v4/${slug.toLowerCase()}`
}

export function formatTDDV4PRTitle(
  slug: string,
  attempt: number,
  maxAttempts: number = TDD_V4_CONFIG.MAX_TIERS
): string {
  return `[TDD-V4] Implement ${slug} | Attempt ${attempt}/${maxAttempts}`
}
