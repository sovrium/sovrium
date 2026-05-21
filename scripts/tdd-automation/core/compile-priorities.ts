/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as prettier from 'prettier'
import { computePriorities, DependencyCycleError } from './dependency-graph'
import { parseFeaturesMd, updateFeaturesMd } from './features-parser'

const FEATURES_MD_PATH = 'docs/user-stories/FEATURES.md'

const GENERATED_CONFIG_PATH = 'scripts/tdd-automation/core/feature-priorities.generated.ts'

export type SpecPrefixMap = ReadonlyMap<string, string>

export interface CompilationResult {
  readonly featureCount: number
  readonly dependencyCount: number
  readonly priorities: ReadonlyMap<string, number>
  readonly featuresUpdated: boolean
  readonly configUpdated: boolean
}

function generateConfigContent(
  priorities: ReadonlyMap<string, number>,
  entryPhases: ReadonlyMap<string, number>,
  specPrefixMap: SpecPrefixMap
): string {
  const sortedEntries = [...priorities.entries()].sort((a, b) => a[1] - b[1])

  const priorityLines = sortedEntries
    .map(([usId, priority]) => `  '${usId}': ${priority},`)
    .join('\n')

  const phaseLines = sortedEntries
    .map(([usId]) => {
      const phase = entryPhases.get(usId) ?? 0
      return `  '${usId}': ${phase},`
    })
    .join('\n')

  const specPrefixLines = [...specPrefixMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([prefix, usId]) => `  '${prefix}': '${usId}',`)
    .join('\n')

  return `/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AUTO-GENERATED — do not edit manually.
 * Source: docs/user-stories/FEATURES.md + user story AC tables
 * Generated: ${new Date().toISOString()}
 *
 * Regenerate with: bun run progress --update-stories
 */

/**
 * Feature priorities derived from FEATURES.md dependency graph.
 * Lower numbers = higher priority (processed first by TDD automation).
 *
 * Priority scheme:
 * - Phase 0 (Foundation): 0-999
 * - Phase 1 (Core): 1000-1999
 * - Phase 2 (Growth): 2000-2999
 * - Phase 3 (Platform): 3000-3999
 */
export const FEATURE_PRIORITIES: Record<string, number> = {
${priorityLines}
}

/**
 * Phase number for each feature (0-3).
 */
export const FEATURE_PHASES: Record<string, number> = {
${phaseLines}
}

/**
 * Maps spec ID prefixes to FEATURES.md US-IDs.
 * Built automatically from user story acceptance criteria tables.
 *
 * Example: 'APP-AUTH-STRATEGIES' → 'US-AUTH-AUTH-STRATEGIES'
 *
 * Usage: strip the test number from a spec ID (e.g., "APP-AUTH-STRATEGIES-001" → "APP-AUTH-STRATEGIES"),
 * then look up the US-ID to find its priority in FEATURE_PRIORITIES.
 */
export const SPEC_PREFIX_TO_US_ID: Record<string, string> = {
${specPrefixLines}
}
`
}

export async function compilePrioritiesFromFile(
  projectRoot: string,
  specPrefixMap: SpecPrefixMap = new Map(),
  updateFeatures = true
): Promise<CompilationResult> {
  const featuresPath = join(projectRoot, FEATURES_MD_PATH)
  const configPath = join(projectRoot, GENERATED_CONFIG_PATH)

  const content = await readFile(featuresPath, 'utf-8')
  const parsed = parseFeaturesMd(content)

  if (parsed.entries.length === 0) {
    return {
      featureCount: 0,
      dependencyCount: 0,
      priorities: new Map(),
      featuresUpdated: false,
      configUpdated: false,
    }
  }

  const priorities = computePriorities(parsed)

  const dependencyCount = parsed.dependencies.reduce((sum, dep) => sum + dep.dependsOn.length, 0)

  const entryPhases = new Map(parsed.entries.map((e) => [e.usId, e.phase]))

  const configContent = generateConfigContent(priorities, entryPhases, specPrefixMap)

  let configUpdated = true
  try {
    const existing = await readFile(configPath, 'utf-8')
    const stripTimestamp = (s: string) => s.replace(/\* Generated:.*\n/, '')
    if (stripTimestamp(existing) === stripTimestamp(configContent)) {
      configUpdated = false
    }
  } catch {
  }

  if (configUpdated) {
    await writeFile(configPath, configContent, 'utf-8')
  }

  let featuresUpdated = false
  if (updateFeatures) {
    const updates = new Map<string, { priority: number }>(
      [...priorities.entries()].map(([usId, priority]) => [usId, { priority }])
    )

    const updatedContent = updateFeaturesMd(content, updates)
    if (updatedContent !== content) {
      const prettierConfig = await prettier.resolveConfig(featuresPath)
      const formattedContent = await prettier.format(updatedContent, {
        ...prettierConfig,
        parser: 'markdown',
      })
      await writeFile(featuresPath, formattedContent, 'utf-8')
      featuresUpdated = true
    }
  }

  return {
    featureCount: parsed.entries.length,
    dependencyCount,
    priorities,
    featuresUpdated,
    configUpdated,
  }
}

export async function compilePrioritiesSafe(
  projectRoot: string,
  specPrefixMap: SpecPrefixMap = new Map(),
  updateFeatures = true
): Promise<CompilationResult | null> {
  try {
    return await compilePrioritiesFromFile(projectRoot, specPrefixMap, updateFeatures)
  } catch (error) {
    if (error instanceof DependencyCycleError) {
      console.error(`[priority-compiler] ERROR: ${error.message}`)
      console.error(`[priority-compiler] Cycle involves: ${error.cycle.join(', ')}`)
      console.error(`[priority-compiler] Fix the dependencies in FEATURES.md and re-run.`)
    } else {
      console.error(`[priority-compiler] ERROR: ${error}`)
    }
    return null
  }
}
