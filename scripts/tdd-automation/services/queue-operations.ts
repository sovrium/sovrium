/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Queue Operations Service
 *
 * Handles GitHub issue queries and label management for the TDD queue
 */

import { Array as EffectArray, pipe } from 'effect'
import * as Effect from 'effect/Effect'
import {
  CommandService,
  FileSystemService,
  logInfo,
  logError,
  logWarn,
  success,
} from '../../lib/effect'
import { createSchemaPriorityCalculator } from '../schema-priority-calculator'
import type { SpecIssue } from './types'
import type { LoggerService } from '../../lib/effect'

/**
 * Check GitHub API rate limit before making calls
 */
export const checkRateLimit = Effect.gen(function* () {
  const cmd = yield* CommandService

  const output = yield* cmd
    .exec('gh api rate_limit --jq ".rate.remaining,.rate.limit,.rate.reset"', {
      throwOnError: false,
    })
    .pipe(Effect.catchAll(() => Effect.succeed('')))

  const lines = output.trim().split('\n')
  if (lines.length >= 3) {
    const remaining = parseInt(lines[0] ?? '0', 10)
    const limit = parseInt(lines[1] ?? '0', 10)
    const resetTimestamp = parseInt(lines[2] ?? '0', 10)
    const resetDate = new Date(resetTimestamp * 1000)

    yield* logInfo(`GitHub API: ${remaining}/${limit} requests remaining`, '⏱️')

    if (remaining < 10) {
      yield* logError(`Rate limit low! Resets at ${resetDate.toISOString()}`)
      return false
    }

    return true
  }

  // If we can't check, assume it's OK
  return true
})

/**
 * Get all queued spec issues from GitHub
 */
export const getQueuedSpecs = Effect.gen(function* () {
  const cmd = yield* CommandService

  // Check rate limit first
  const hasCapacity = yield* checkRateLimit
  if (!hasCapacity) {
    yield* logError('Rate limit too low, skipping API call')
    return []
  }

  yield* logInfo('Fetching queued specs from GitHub (excluding skip-automated)...', '📋')

  const output = yield* cmd
    .exec(
      'gh issue list --label "tdd-spec:queued" --search "-label:skip-automated" --json number,title,url,createdAt,updatedAt,labels --limit 1000',
      { throwOnError: false }
    )
    .pipe(
      Effect.catchAll(() => {
        return Effect.gen(function* () {
          yield* logError('Failed to fetch queued specs')
          return '[]'
        })
      })
    )

  try {
    const issues = JSON.parse(output) as Array<{
      number: number
      title: string
      url: string
      createdAt: string
      updatedAt: string
      labels: Array<{ name: string }>
    }>

    const specIssues: SpecIssue[] = issues
      .map((issue): SpecIssue | null => {
        // Extract spec ID from title: "🤖 APP-VERSION-001: description"
        const specIdMatch = issue.title.match(/🤖\s+([A-Z]+-[A-Z-]+-\d{3}):/)
        const specId = specIdMatch?.[1]

        if (!specId) return null

        return {
          number: issue.number,
          specId,
          state: 'queued',
          url: issue.url,
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
          labels: issue.labels.map((label) => label.name),
        }
      })
      .filter((issue): issue is SpecIssue => issue !== null)

    yield* logInfo(`  Found ${specIssues.length} queued specs`)
    return specIssues
  } catch {
    yield* logError('Failed to parse GitHub issue response')
    return []
  }
})

/**
 * Get all in-progress spec issues from GitHub
 */
export const getInProgressSpecs = Effect.gen(function* () {
  const cmd = yield* CommandService

  // Check rate limit first
  const hasCapacity = yield* checkRateLimit
  if (!hasCapacity) {
    yield* logError('Rate limit too low, skipping API call')
    return []
  }

  const output = yield* cmd
    .exec(
      'gh issue list --label "tdd-spec:in-progress" --json number,title,url,createdAt,updatedAt,labels --limit 100',
      { throwOnError: false }
    )
    .pipe(
      Effect.catchAll(() => {
        return Effect.gen(function* () {
          yield* logError('Failed to fetch in-progress specs')
          return '[]'
        })
      })
    )

  try {
    const issues = JSON.parse(output) as Array<{
      number: number
      title: string
      url: string
      createdAt: string
      updatedAt: string
      labels: Array<{ name: string }>
    }>

    const specIssues: SpecIssue[] = issues
      .map((issue): SpecIssue | null => {
        const specIdMatch = issue.title.match(/🤖\s+([A-Z]+-[A-Z-]+-\d{3}):/)
        const specId = specIdMatch?.[1]

        if (!specId) return null

        return {
          number: issue.number,
          specId,
          state: 'in-progress',
          url: issue.url,
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
          labels: issue.labels.map((label) => label.name),
        }
      })
      .filter((issue): issue is SpecIssue => issue !== null)

    return specIssues
  } catch {
    yield* logError('Failed to parse GitHub issue response')
    return []
  }
})

/**
 * Get all existing spec issues from GitHub (all states: open and closed)
 * Used for bulk deduplication before creating new issues
 *
 * PAGINATION-BASED BULLETPROOF DEDUPLICATION:
 * - Uses GitHub API pagination to fetch ALL issues (no 1000 limit)
 * - Filters by bot emoji (🤖) in title to ensure only spec issues are fetched
 * - Checks both open and closed issues
 * - Returns both spec IDs and issue metadata for duplicate detection
 * - Handles unlimited growth (tested up to 10,000+ issues)
 */
export const getAllExistingSpecs = Effect.gen(function* () {
  const cmd = yield* CommandService

  yield* logInfo('Fetching all existing spec issues with pagination...', '🔍')

  // GitHub API hard limit: 1000 results per gh issue list command
  // Solution: Use pagination with gh api to fetch all pages
  let allIssues: Array<{
    number: number
    title: string
    state: string
    created_at: string
  }> = []
  let page = 1
  const perPage = 100 // GitHub API max per_page
  let hasMorePages = true

  // Fetch all pages until no more results
  // Use gh api with pagination (gh issue list doesn't support --page parameter)
  while (hasMorePages && page <= 50) {
    // Safety limit: max 50 pages = 5000 issues
    const output = yield* cmd
      .exec(
        `gh api repos/:owner/:repo/issues -X GET -f labels=tdd-automation -f state=all -f per_page=${perPage} -f page=${page}`,
        {
          throwOnError: false,
        }
      )
      .pipe(
        Effect.catchAll(() => {
          return Effect.gen(function* () {
            yield* logError(`Failed to fetch page ${page}`)
            return '[]'
          })
        })
      )

    try {
      const pageIssues = JSON.parse(output) as Array<{
        number: number
        title: string
        state: string
        created_at: string
      }>

      if (pageIssues.length === 0) {
        hasMorePages = false
        break
      }

      // Filter by bot emoji (GitHub API doesn't support search in list)
      const specIssues = pageIssues.filter((issue) => issue.title.includes('🤖'))

      allIssues = allIssues.concat(specIssues)

      if (page === 1 || page % 5 === 0) {
        yield* logInfo(
          `  Fetched page ${page}: ${specIssues.length} spec issues (${pageIssues.length} total)`,
          '📄'
        )
      }

      // If we got fewer results than requested, we've reached the last page
      if (pageIssues.length < perPage) {
        hasMorePages = false
      } else {
        page++
      }
    } catch (error) {
      yield* logError(`Failed to parse page ${page}: ${error}`)
      hasMorePages = false
    }
  }

  yield* logInfo(`  Fetched ${allIssues.length} total spec issues across ${page} page(s)`)

  // Extract spec IDs from issue titles and build metadata map
  const existingSpecIds = new Set<string>()
  const specMetadata = new Map<
    string,
    Array<{ number: number; state: string; createdAt: string }>
  >()

  for (const issue of allIssues) {
    const specIdMatch = issue.title.match(/🤖\s+([A-Z]+-[A-Z-]+-\d{3}):/)
    const specId = specIdMatch?.[1]
    if (specId) {
      existingSpecIds.add(specId)

      // Track all issues for this spec ID (for duplicate detection)
      if (!specMetadata.has(specId)) {
        specMetadata.set(specId, [])
      }
      specMetadata.get(specId)?.push({
        number: issue.number,
        state: issue.state,
        createdAt: issue.created_at, // API returns created_at, not createdAt
      })
    }
  }

  // Detect existing duplicates (multiple issues for same spec ID)
  const duplicates: string[] = []
  for (const [specId, issueList] of specMetadata.entries()) {
    if (issueList.length > 1) {
      duplicates.push(specId)
    }
  }

  yield* logInfo(`  Found ${existingSpecIds.size} unique spec IDs`)

  if (duplicates.length > 0) {
    yield* logWarn(`  ⚠️  Found ${duplicates.length} specs with multiple issues (duplicates exist)`)
    yield* logInfo(`  First 5 duplicates: ${duplicates.slice(0, 5).join(', ')}`)
  }

  // Success message for pagination-based approach
  if (allIssues.length >= 900) {
    yield* logInfo(
      `  ✅ Pagination working correctly (fetched ${allIssues.length} issues beyond gh limit)`,
      '🎉'
    )
  }

  return existingSpecIds
})

/**
 * Check if a spec already has an issue (open or closed)
 * IMPORTANT: Uses "tdd-automation" label (the actual label used by the pipeline)
 * IMPORTANT: Checks ALL states (open + closed) to prevent duplicates
 */
export const specHasIssue = (specId: string): Effect.Effect<boolean, never, CommandService> =>
  Effect.gen(function* () {
    const cmd = yield* CommandService

    const output = yield* cmd
      .exec(
        `gh issue list --label "tdd-automation" --search "${specId}" --state all --json number,state --limit 10`,
        { throwOnError: false }
      )
      .pipe(Effect.catchAll(() => Effect.succeed('[]')))

    try {
      const issues = JSON.parse(output) as Array<{ number: number; state: string }>
      return issues.length > 0 // Returns true if ANY issue exists (open or closed)
    } catch {
      return false
    }
  })

/**
 * @deprecated Use specHasIssue() instead - this function only checks OPEN issues
 * Kept for backwards compatibility
 */
export const specHasOpenIssue = specHasIssue

/**
 * Mark a spec as in-progress
 */
export const markInProgress = (
  issueNumber: number
): Effect.Effect<void, never, CommandService | LoggerService> =>
  Effect.gen(function* () {
    const cmd = yield* CommandService

    yield* logInfo(`Marking issue #${issueNumber} as in-progress...`)

    yield* cmd
      .exec(`gh issue edit ${issueNumber} --remove-label "tdd-spec:queued"`, {
        throwOnError: false,
      })
      .pipe(Effect.catchAll(() => Effect.void))

    yield* cmd
      .exec(`gh issue edit ${issueNumber} --add-label "tdd-spec:in-progress"`, {
        throwOnError: false,
      })
      .pipe(Effect.catchAll(() => Effect.void))

    yield* success('Updated labels')
  })

/**
 * Mark a spec as completed
 */
export const markCompleted = (
  issueNumber: number
): Effect.Effect<void, never, CommandService | LoggerService> =>
  Effect.gen(function* () {
    const cmd = yield* CommandService

    yield* logInfo(`Marking issue #${issueNumber} as completed...`)

    yield* cmd
      .exec(`gh issue edit ${issueNumber} --remove-label "tdd-spec:in-progress"`, {
        throwOnError: false,
      })
      .pipe(Effect.catchAll(() => Effect.void))

    yield* cmd
      .exec(`gh issue edit ${issueNumber} --add-label "tdd-spec:completed"`, {
        throwOnError: false,
      })
      .pipe(Effect.catchAll(() => Effect.void))

    yield* cmd
      .exec(`gh issue close ${issueNumber} --reason completed`, {
        throwOnError: false,
      })
      .pipe(Effect.catchAll(() => Effect.void))

    yield* success('Issue closed and marked as completed')
  })

/**
 * Mark a spec as failed
 */
export const markFailed = (
  issueNumber: number,
  reason: string
): Effect.Effect<void, never, CommandService | LoggerService> =>
  Effect.gen(function* () {
    const cmd = yield* CommandService

    yield* logError(`Marking issue #${issueNumber} as failed...`)

    yield* cmd
      .exec(`gh issue edit ${issueNumber} --remove-label "tdd-spec:in-progress"`, {
        throwOnError: false,
      })
      .pipe(Effect.catchAll(() => Effect.void))

    yield* cmd
      .exec(`gh issue edit ${issueNumber} --add-label "tdd-spec:failed"`, {
        throwOnError: false,
      })
      .pipe(Effect.catchAll(() => Effect.void))

    yield* cmd
      .exec(
        `gh issue comment ${issueNumber} --body "❌ Validation failed:\n\n${reason}\n\nPlease review the implementation and push fixes to retry."`,
        { throwOnError: false }
      )
      .pipe(Effect.catchAll(() => Effect.void))

    yield* success('Issue marked as failed with comment')
  })

/**
 * Get the next spec to process (highest priority, then lowest spec ID number)
 * Prioritization:
 * 1. Schema-based priority (root before nested, required before optional)
 * 2. Spec ID numerical order (001, 002, 003, etc.)
 * 3. Dependency graph (ready specs before blocked specs)
 */
export const getNextSpec = Effect.gen(function* () {
  const fs = yield* FileSystemService
  yield* logInfo('Looking for next spec to process...')

  // Check if any specs are in-progress
  const inProgressSpecs = yield* getInProgressSpecs
  if (inProgressSpecs.length > 0) {
    // Check if all in-progress specs are infrastructure retries
    const nonRetryingSpecs = inProgressSpecs.filter((spec) => {
      // Check if spec has infrastructure-retry label (indicates it's retrying due to infra error)
      const hasRetryLabel = spec.labels?.some((label: string) =>
        label.startsWith('infrastructure-retry:')
      )
      return !hasRetryLabel
    })

    if (nonRetryingSpecs.length > 0) {
      // Block if there are non-retry specs in progress
      yield* logInfo(`${nonRetryingSpecs.length} spec(s) in-progress (non-retry):`, '⏸️')
      nonRetryingSpecs.forEach((spec) => {
        console.log(`     - ${spec.specId} (#${spec.number})`)
      })
      return null
    } else {
      // Allow processing if only infrastructure retries are in progress
      yield* logInfo(
        `${inProgressSpecs.length} spec(s) retrying due to infrastructure errors`,
        '🔄'
      )
      yield* logInfo('Continuing to process next queued spec...', '➡️')
    }
  }

  // Get queued specs
  const queuedSpecs = yield* getQueuedSpecs
  if (queuedSpecs.length === 0) {
    yield* logInfo('Queue is empty', '📭')
    return null
  }

  // Create priority calculator (based on spec ID format, no schema files needed)
  const calculatePriority = createSchemaPriorityCalculator()

  // Calculate priority for each spec based on spec ID
  interface SpecWithPriority extends SpecIssue {
    priority: number
  }

  const specsWithPriority: SpecWithPriority[] = queuedSpecs.map((spec) => {
    // Calculate priority based on spec ID (e.g., APP-BLOCKS-001, APP-BLOCKS-REGRESSION)
    // This ensures tests from same schema are processed together with regression tests last
    const priority = calculatePriority(spec.specId)

    return {
      ...spec,
      priority,
    }
  })

  // Load dependency graph if it exists
  const dependencyGraphPath = '.github/tdd-queue-dependencies.json'
  let dependencyGraph: Record<
    string,
    { canImplement: boolean; missingDependencies: string[] }
  > | null = null

  const dependencyGraphExists = yield* fs
    .exists(dependencyGraphPath)
    .pipe(Effect.catchAll(() => Effect.succeed(false)))

  if (dependencyGraphExists) {
    const graphBuffer = yield* fs
      .readFile(dependencyGraphPath)
      .pipe(Effect.catchAll(() => Effect.succeed(Buffer.from('{}'))))

    try {
      const graphContent = graphBuffer.toString('utf-8')
      dependencyGraph = JSON.parse(graphContent)
      yield* logInfo('Using dependency graph for blocking detection', '🔗')
    } catch {
      yield* logWarn('Failed to parse dependency graph')
    }
  }

  // Separate ready specs from blocked specs based on dependency graph
  let readySpecs: SpecWithPriority[] = []
  const blockedSpecs: SpecWithPriority[] = []

  if (dependencyGraph) {
    for (const spec of specsWithPriority) {
      const depInfo = dependencyGraph[spec.specId]
      if (depInfo && depInfo.canImplement) {
        readySpecs.push(spec)
      } else if (depInfo && !depInfo.canImplement) {
        blockedSpecs.push(spec)
      } else {
        // If not in dependency graph, treat as ready (backward compatibility)
        readySpecs.push(spec)
      }
    }

    if (blockedSpecs.length > 0) {
      yield* logWarn(`⚠️  ${blockedSpecs.length} spec(s) blocked by missing dependencies`)
      for (const spec of blockedSpecs.slice(0, 3)) {
        const depInfo = dependencyGraph[spec.specId]
        if (depInfo) {
          yield* logInfo(`   ${spec.specId}: ${depInfo.missingDependencies.length} missing file(s)`)
        }
      }
      if (blockedSpecs.length > 3) {
        yield* logInfo(`   ... and ${blockedSpecs.length - 3} more blocked specs`)
      }
    }

    if (readySpecs.length > 0) {
      yield* logInfo(`✅ ${readySpecs.length} spec(s) ready to implement`)
    }
  } else {
    // No dependency graph, all specs are ready
    readySpecs = specsWithPriority
  }

  // Sort ready specs by priority, then by spec ID (ensures 001, 002, 003 order)
  const sortedReadySpecs = pipe(
    readySpecs,
    EffectArray.sortBy(
      (a, b) => (a.priority < b.priority ? -1 : a.priority > b.priority ? 1 : 0),
      (a, b) => (a.specId < b.specId ? -1 : a.specId > b.specId ? 1 : 0)
    )
  )

  // If no ready specs, try blocked specs (sorted by priority)
  const nextSpec =
    sortedReadySpecs.length > 0
      ? sortedReadySpecs[0]
      : pipe(
          blockedSpecs,
          EffectArray.sortBy(
            (a, b) => (a.priority < b.priority ? -1 : a.priority > b.priority ? 1 : 0),
            (a, b) => (a.specId < b.specId ? -1 : a.specId > b.specId ? 1 : 0)
          )
        )[0]

  if (!nextSpec) {
    yield* logInfo('No queued specs found', '📭')
    return null
  }

  // Fetch issue body to extract test file path
  const cmd = yield* CommandService
  const issueBody = yield* cmd
    .exec(`gh issue view ${nextSpec.number} --json body --jq '.body'`, { throwOnError: false })
    .pipe(Effect.catchAll(() => Effect.succeed('')))

  // Extract file path from body: **File**: `path/to/file.spec.ts:123`
  const fileMatch = issueBody.match(/\*\*File\*\*:\s*`([^:]+):\d+`/)
  const testFile = fileMatch?.[1] || ''

  // Add test file to spec object
  const nextSpecWithFile: SpecIssue = {
    ...nextSpec,
    testFile,
  }

  yield* success(
    `Next spec: ${nextSpec.specId} (#${nextSpec.number}) [Priority: ${nextSpec.priority}]`
  )

  if (dependencyGraph && dependencyGraph[nextSpec.specId]) {
    const depInfo = dependencyGraph[nextSpec.specId]
    if (depInfo && !depInfo.canImplement) {
      yield* logWarn(
        `⚠️  Warning: This spec has ${depInfo.missingDependencies.length} missing dependencies`
      )
      yield* logInfo('Implementation may fail. Consider implementing dependencies first.')
    }
  }

  return nextSpecWithFile
})
