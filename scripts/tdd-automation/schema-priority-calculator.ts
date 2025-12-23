/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Spec ID Priority Calculator
 *
 * Calculates priority for TDD automation queue based purely on spec IDs.
 * No JSON schema files required - priority is derived from the spec ID format.
 *
 * Domain priority order (lower = higher priority):
 * - APP specs: 0-999,999 (highest priority, runs first)
 * - MIG specs: 1,000,000-1,999,999 (runs after APP)
 * - STATIC specs: 2,000,000-2,999,999 (runs after MIG)
 * - API specs: 3,000,000-3,999,999 (runs after STATIC)
 * - ADMIN specs: 4,000,000-4,999,999 (lowest priority, runs last)
 *
 * Within each domain:
 * - Features are grouped alphabetically (default)
 * - API domain uses custom ordering: health → auth → tables → activity
 * - Individual tests: base + test number (001 → 1, 002 → 2, etc.)
 * - Regression tests: base + 900 (ensures they run last in their group)
 *
 * Example spec IDs and their feature paths:
 * - APP-VERSION-001 → app/version
 * - APP-THEME-COLORS-001 → app/theme/colors
 * - MIG-ERROR-001 → mig/error
 * - API-HEALTH-001 → api/health (runs first in API)
 * - API-AUTH-SIGN-UP-POST-001 → api/auth/sign/up/post (runs after health)
 * - API-TABLES-001 → api/tables (runs after auth)
 * - API-ACTIVITY-001 → api/activity (runs after tables)
 * - ADMIN-TABLES-001 → admin/tables
 */

/**
 * Spec domain type
 */
type SpecDomain = 'app' | 'migrations' | 'static' | 'api' | 'admin'

/**
 * Domain base priorities (in millions to separate domains completely)
 */
const DOMAIN_BASE_PRIORITIES: Record<SpecDomain, number> = {
  app: 0, // Runs first (0-999,999)
  migrations: 1_000_000, // Runs after APP specs (1,000,000-1,999,999)
  static: 2_000_000, // Runs after MIG specs (2,000,000-2,999,999)
  api: 3_000_000, // Runs after STATIC specs (3,000,000-3,999,999)
  admin: 4_000_000, // Runs after API specs (4,000,000-4,999,999)
}

/**
 * Custom priority mapping for API domain features (overrides alphabetical ordering)
 *
 * API features should run in this specific order:
 * 1. health (api/health/*) - Health checks run first
 * 2. auth (api/auth/*) - Authentication before all other features
 * 3. tables (api/tables) - Core data operations
 * 4. activity (api/activity) - Activity tracking last
 *
 * Priority spacing accounts for maximum sub-path contribution (~56,000):
 * - Level 2-5 max: 25*1000 + 25*100 + 25*1100 + 25*40 = 56,000
 * - Each feature base must be > previous max (base + 56,000)
 */
const API_FEATURE_PRIORITIES: Record<string, number> = {
  health: 0, // api/health/* (max: 56,000)
  auth: 60_000, // api/auth/* (max: 116,000)
  tables: 120_000, // api/tables (max: 176,000)
  activity: 180_000, // api/activity (max: 236,000)
}

/**
 * Detect spec domain from spec ID prefix
 *
 * @param specId Full spec ID (e.g., "APP-VERSION-001", "MIGRATION-ERROR-001")
 * @returns Domain type
 */
function getSpecDomain(specId: string): SpecDomain {
  const prefix = specId.split('-')[0]?.toUpperCase()
  if (prefix === 'APP') return 'app'
  if (prefix === 'MIG' || prefix === 'MIGRATION') return 'migrations'
  if (prefix === 'STATIC') return 'static'
  if (prefix === 'API') return 'api'
  if (prefix === 'ADMIN') return 'admin'
  return 'app' // Default fallback for unknown prefixes
}

/**
 * Get feature path from spec ID
 *
 * Examples:
 * - APP-VERSION-001 → app/version
 * - APP-VERSION-REGRESSION → app/version
 * - APP-VERSION-REGRESSION-001 → app/version
 * - APP-THEME-COLORS-001 → app/theme/colors
 * - MIG-ERROR-001 → mig/error
 * - API-PATHS-HEALTH-001 → api/paths/health
 */
export function getFeaturePathFromSpecId(specId: string): string {
  const parts = specId.split('-')
  const lastPart = parts[parts.length - 1] || ''

  // Check if last part is "REGRESSION" (case-insensitive)
  const isRegressionOnly = lastPart.toUpperCase() === 'REGRESSION'

  // Check if second-to-last part is "REGRESSION" with numeric suffix
  const secondToLastPart = parts.length >= 2 ? parts[parts.length - 2] : undefined
  const isRegressionWithNumber =
    secondToLastPart !== undefined &&
    secondToLastPart.toUpperCase() === 'REGRESSION' &&
    /^\d+$/.test(lastPart)

  // Remove suffix based on pattern
  let pathParts: string[]
  if (isRegressionWithNumber) {
    // Pattern: APP-THEME-ANIMATIONS-REGRESSION-001 → app/theme/animations
    pathParts = parts.slice(0, -2)
  } else if (isRegressionOnly) {
    // Pattern: APP-THEME-ANIMATIONS-REGRESSION → app/theme/animations
    pathParts = parts.slice(0, -1)
  } else if (/^\d+$/.test(lastPart)) {
    // Pattern: APP-THEME-ANIMATIONS-001 → app/theme/animations
    pathParts = parts.slice(0, -1)
  } else {
    // No recognized suffix
    pathParts = parts
  }

  return pathParts.join('/').toLowerCase()
}

/**
 * Calculate alphabetical index for a feature name (0-25 based on first letter)
 */
function getAlphabeticalIndex(name: string): number {
  const normalized = name.toLowerCase()
  const charCode = normalized.charCodeAt(0)
  // Return 0-25 for a-z, 0 for non-letters
  if (charCode >= 97 && charCode <= 122) {
    return charCode - 97
  }
  return 0
}

/**
 * Calculate priority for a feature path
 *
 * Features are grouped by their path segments with alphabetical ordering.
 * Priority values stay under 1 million to fit within domain ranges:
 * - Level 1 (first feature part): 0-25 * 30000 = 0-750,000
 * - Level 2 (second part): 0-25 * 1000 = 0-25,000
 * - Level 3 (third part): 0-25 * 100 = 0-2,500
 * - Level 4 (fourth part): 0-25 * 1100 = 0-27,500
 * - Level 5 (fifth part - for compound names like UPDATED-BY): 0-25 * 40 = 0-1,000
 * - Test offset: 1-999
 * Max total: ~806,999 (well under 1,000,000)
 *
 * IMPORTANT:
 * - Level 4 multiplier (1100) > Level 5 max (1000) prevents priority collisions
 *   between different L4/L5 combinations (e.g., UPDATED-BY vs LONG-TEXT)
 * - Level 5 multiplier (40) > test offset max (999/26) ensures all tests within
 *   a feature complete before the next feature starts
 *
 * Special handling for API domain:
 * - API features use custom priority mapping (health → auth → tables → activity)
 * - Overrides alphabetical ordering for consistent API test execution order
 *
 * Example: UPDATED-AT-006 runs before UPDATED-BY-001
 */
function calculateFeaturePriority(featurePath: string): number {
  const pathParts = featurePath.split('/')
  let priority = 0

  // Check if this is an API domain path with custom priority
  const isApiDomain = pathParts[0] === 'api'
  const apiFeature = pathParts[1]

  if (isApiDomain && apiFeature && apiFeature in API_FEATURE_PRIORITIES) {
    // Use custom priority for API features (paths, auth, tables, activity)
    priority = API_FEATURE_PRIORITIES[apiFeature]!

    // Add remaining path segments (level 2+) with standard multipliers
    const multipliers: number[] = [1000, 100, 1100, 40]
    for (let i = 2; i < pathParts.length && i <= 5; i++) {
      const part = pathParts[i] || ''
      const partValue = getAlphabeticalIndex(part)
      const multiplier = multipliers[i - 2] ?? 1
      priority += partValue * multiplier
    }

    return priority
  }

  // Standard alphabetical ordering for non-API or unmapped API features
  const multipliers = [30_000, 1000, 100, 1100, 40]

  // Skip domain prefix (first part)
  for (let i = 1; i < pathParts.length && i <= 5; i++) {
    const part = pathParts[i] || ''
    const partValue = getAlphabeticalIndex(part)
    const multiplier = multipliers[i - 1] || 1
    priority += partValue * multiplier
  }

  return priority
}

/**
 * Calculate priority for a spec ID
 *
 * @param specId Full spec ID (e.g., "APP-VERSION-001", "MIG-ERROR-REGRESSION")
 * @returns Priority number (lower = higher priority)
 */
export function calculateSpecPriority(specId: string): number {
  // Get domain base priority
  const domain = getSpecDomain(specId)
  const domainBasePriority = DOMAIN_BASE_PRIORITIES[domain]

  // Get feature path and calculate feature priority
  const featurePath = getFeaturePathFromSpecId(specId)
  const featurePriority = calculateFeaturePriority(featurePath)

  // Extract test identifier (last part of spec ID)
  const parts = specId.split('-')
  const lastPart = parts[parts.length - 1] || ''

  // Check if this is a regression test
  const isRegressionOnly = lastPart.toUpperCase() === 'REGRESSION'
  const secondToLastPart = parts.length >= 2 ? parts[parts.length - 2] : undefined
  const isRegressionWithNumber =
    secondToLastPart !== undefined &&
    secondToLastPart.toUpperCase() === 'REGRESSION' &&
    /^\d+$/.test(lastPart)
  const isRegression = isRegressionOnly || isRegressionWithNumber

  // Calculate test offset within the feature group
  let testOffset: number
  if (isRegression) {
    // Regression tests always run last in their group
    testOffset = 900
  } else if (/^\d+$/.test(lastPart)) {
    // Individual test number (001 → 1, 002 → 2, etc.)
    testOffset = parseInt(lastPart, 10)
  } else {
    // Unknown format - use default
    testOffset = 1
  }

  return domainBasePriority + featurePriority + testOffset
}

/**
 * Create a priority calculator function
 *
 * This is the main export for TDD automation queue ordering.
 * No JSON schema files required - priority is based purely on spec ID format.
 *
 * @returns Function that calculates priority for spec IDs
 */
export function createSchemaPriorityCalculator(): (specId: string) => number {
  return calculateSpecPriority
}
