#!/usr/bin/env bun

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * State Synchronization with PR Status
 *
 * This script synchronizes the TDD state file with actual GitHub PR status.
 * It runs before spec selection in the orchestrator to ensure the state
 * accurately reflects the current PR state.
 *
 * Key responsibilities:
 * 1. Check actual PR status (open, merged, closed) for all active specs
 * 2. Transition completed/closed specs to appropriate queue
 * 3. Release file and spec locks for finished PRs
 * 4. Handle abandoned PRs (open but stale) with configurable timeout
 *
 * This prevents the orchestrator from being blocked by stale state entries
 * that no longer correspond to actual open PRs.
 */

import { Effect, Layer, Logger, LogLevel } from 'effect'
import { isCI } from './github-operations'
import { StateManager, StateManagerLive } from './state-manager'

/**
 * Configuration
 */
const STALE_PR_THRESHOLD_MINUTES = 60 // Consider PR stale if active for > 60 minutes without progress
const ORPHAN_ACTIVATION_THRESHOLD_MINUTES = 15 // Re-queue specs without PRs after 15 minutes
const GITHUB_API_BASE = 'https://api.github.com'

/**
 * GitHub PR status response
 */
interface GitHubPRStatus {
  number: number
  state: 'open' | 'closed' | 'merged'
  merged: boolean
  merged_at: string | null
  closed_at: string | null
  updated_at: string
  head: {
    ref: string
  }
}

/**
 * Sync result for reporting
 */
interface SyncResult {
  specsChecked: number
  specsMoved: {
    toCompleted: string[]
    toPending: string[]
    toFailed: string[]
  }
  filesUnlocked: string[]
  specsUnlocked: string[]
  errors: string[]
}

/**
 * Get PR status from GitHub API
 */
const getPRStatus = (prNumber: number, repo: string): Effect.Effect<GitHubPRStatus | null, Error> =>
  Effect.tryPromise({
    try: async () => {
      const token = process.env['GH_TOKEN'] || process.env['GITHUB_TOKEN']
      if (!token) {
        console.error('Warning: No GitHub token found, skipping PR status check')
        return null
      }

      const response = await fetch(`${GITHUB_API_BASE}/repos/${repo}/pulls/${prNumber}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      })

      if (response.status === 404) {
        // PR doesn't exist or was deleted
        return null
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as GitHubPRStatus
      return {
        number: data.number,
        state: data.merged ? 'merged' : data.state,
        merged: data.merged,
        merged_at: data.merged_at,
        closed_at: data.closed_at,
        updated_at: data.updated_at,
        head: { ref: data.head.ref },
      }
    },
    catch: (error) => new Error(`Failed to get PR status: ${error}`),
  })

/**
 * Search for a PR matching a spec by branch name pattern
 * Used when the spec has no prNumber recorded (state update failed)
 */
const findPRBySpecId = (
  specId: string,
  repo: string
): Effect.Effect<GitHubPRStatus | null, Error> =>
  Effect.tryPromise({
    try: async () => {
      const token = process.env['GH_TOKEN'] || process.env['GITHUB_TOKEN']
      if (!token) {
        console.error('Warning: No GitHub token found, skipping PR search')
        return null
      }

      // Search for PRs with branches matching the pattern tdd/{specId}-*
      // The GitHub API doesn't support wildcard search, so we list recent PRs and filter
      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${repo}/pulls?state=all&per_page=50&sort=created&direction=desc`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
      }

      const prs = (await response.json()) as Array<{
        number: number
        state: 'open' | 'closed'
        merged_at: string | null
        closed_at: string | null
        updated_at: string
        head: { ref: string }
      }>

      // Find the most recent PR with a matching branch name
      const branchPrefix = `tdd/${specId}-`
      const matchingPR = prs.find((pr) => pr.head.ref.startsWith(branchPrefix))

      if (!matchingPR) {
        return null
      }

      return {
        number: matchingPR.number,
        state: matchingPR.merged_at ? 'merged' : matchingPR.state,
        merged: !!matchingPR.merged_at,
        merged_at: matchingPR.merged_at,
        closed_at: matchingPR.closed_at,
        updated_at: matchingPR.updated_at,
        head: { ref: matchingPR.head.ref },
      }
    },
    catch: (error) => new Error(`Failed to search for PR: ${error}`),
  })

/**
 * Get repository name from environment or git remote
 */
const getRepoName = (): Effect.Effect<string, Error> =>
  Effect.tryPromise({
    try: async () => {
      // First try environment variable (set by GitHub Actions)
      const repoEnv = process.env['GITHUB_REPOSITORY']
      if (repoEnv) {
        return repoEnv
      }

      // Fallback to git remote origin (for local development)
      const proc = Bun.spawn(['git', 'remote', 'get-url', 'origin'])
      const output = await new Response(proc.stdout).text()
      const match = output.match(/github\.com[:/](.+?)(?:\.git)?$/)
      if (match?.[1]) {
        return match[1].trim()
      }

      throw new Error('Could not determine repository name')
    },
    catch: (error) => new Error(`Failed to get repository name: ${error}`),
  })

/**
 * Main synchronization program
 */
const syncStateWithPRs = Effect.gen(function* () {
  console.error('🔄 Synchronizing TDD state with PR status...')

  const stateManager = yield* StateManager
  const state = yield* stateManager.load()

  const result: SyncResult = {
    specsChecked: 0,
    specsMoved: {
      toCompleted: [],
      toPending: [],
      toFailed: [],
    },
    filesUnlocked: [],
    specsUnlocked: [],
    errors: [],
  }

  // Skip if no active specs
  if (state.queue.active.length === 0) {
    console.error('✅ No active specs to sync')
    return result
  }

  console.error(`📋 Checking ${state.queue.active.length} active spec(s)...`)

  // Get repository name
  const repo = yield* getRepoName()
  console.error(`📦 Repository: ${repo}`)

  // Track specs to transition (batch updates)
  const specsToComplete: string[] = []
  const specsToRequeue: string[] = []
  const specsToFail: string[] = []
  const filesToUnlock: string[] = []
  const specsToUnlock: string[] = []

  // Check each active spec
  for (const spec of state.queue.active) {
    result.specsChecked++

    // Handle specs without PR number (state update may have failed)
    if (!spec.prNumber) {
      console.error(`  🔍 ${spec.specId}: No PR number in state, searching for matching PR...`)

      // Try to find a matching PR by branch name
      const foundPR = yield* findPRBySpecId(spec.specId, repo).pipe(
        Effect.catchAll((error) => {
          console.error(`    ⚠️  Error searching for PR: ${error.message}`)
          return Effect.succeed(null)
        })
      )

      if (foundPR) {
        console.error(`    ✅ Found PR #${foundPR.number} (${foundPR.state})`)

        // Process this PR like we normally would
        switch (foundPR.state) {
          case 'merged': {
            console.error(`    ✅ Merged - transitioning to completed`)
            specsToComplete.push(spec.specId)
            filesToUnlock.push(spec.filePath)
            specsToUnlock.push(spec.specId)
            result.specsMoved.toCompleted.push(spec.specId)
            break
          }

          case 'closed': {
            console.error(`    🔄 Closed without merge - re-queuing for retry`)
            specsToRequeue.push(spec.specId)
            filesToUnlock.push(spec.filePath)
            specsToUnlock.push(spec.specId)
            result.specsMoved.toPending.push(spec.specId)
            break
          }

          case 'open': {
            // PR is open but we didn't have the number - this is fine, the PR exists
            console.error(`    ⏳ PR is open and in progress`)
            break
          }
        }
        continue
      }

      // No matching PR found - check if activation is orphaned
      if (spec.startedAt) {
        const startedAt = new Date(spec.startedAt).getTime()
        const ageMinutes = (Date.now() - startedAt) / (1000 * 60)

        // Use shorter threshold for specs without PRs
        if (ageMinutes > ORPHAN_ACTIVATION_THRESHOLD_MINUTES) {
          console.error(`    ⚠️  Activated ${ageMinutes.toFixed(0)}m ago without PR - re-queuing`)
          specsToRequeue.push(spec.specId)
          filesToUnlock.push(spec.filePath)
          specsToUnlock.push(spec.specId)
          result.specsMoved.toPending.push(spec.specId)
        } else {
          console.error(`    ⏳ Recently activated (${ageMinutes.toFixed(0)}m ago), waiting...`)
        }
      }
      continue
    }

    // Get PR status from GitHub
    const prStatus = yield* getPRStatus(spec.prNumber, repo).pipe(
      Effect.catchAll((error) => {
        result.errors.push(`${spec.specId}: ${error.message}`)
        return Effect.succeed(null)
      })
    )

    if (!prStatus) {
      console.error(`  ❓ ${spec.specId}: PR #${spec.prNumber} not found or API error`)
      // If PR doesn't exist, re-queue the spec
      specsToRequeue.push(spec.specId)
      filesToUnlock.push(spec.filePath)
      specsToUnlock.push(spec.specId)
      continue
    }

    console.error(`  🔍 ${spec.specId}: PR #${spec.prNumber} is ${prStatus.state}`)

    switch (prStatus.state) {
      case 'merged': {
        // PR was merged - move to completed
        console.error(`    ✅ Merged - transitioning to completed`)
        specsToComplete.push(spec.specId)
        filesToUnlock.push(spec.filePath)
        specsToUnlock.push(spec.specId)
        result.specsMoved.toCompleted.push(spec.specId)
        break
      }

      case 'closed': {
        // PR was closed without merge - re-queue for another attempt
        console.error(`    🔄 Closed without merge - re-queuing for retry`)
        specsToRequeue.push(spec.specId)
        filesToUnlock.push(spec.filePath)
        specsToUnlock.push(spec.specId)
        result.specsMoved.toPending.push(spec.specId)
        break
      }

      case 'open': {
        // PR is still open - check if it's stale
        const lastUpdate = new Date(prStatus.updated_at).getTime()
        const ageMinutes = (Date.now() - lastUpdate) / (1000 * 60)

        if (ageMinutes > STALE_PR_THRESHOLD_MINUTES) {
          console.error(
            `    ⚠️  Open but stale (last update ${ageMinutes.toFixed(0)}m ago) - keeping active`
          )
          // Keep in active queue for now, cleanup workflow will handle truly stale PRs
        } else {
          console.error(`    ⏳ Still in progress (last update ${ageMinutes.toFixed(0)}m ago)`)
        }
        break
      }
    }
  }

  // Apply state transitions atomically
  if (
    specsToComplete.length > 0 ||
    specsToRequeue.length > 0 ||
    specsToFail.length > 0 ||
    filesToUnlock.length > 0
  ) {
    console.error('')
    console.error('📝 Applying state transitions...')

    // Reload state to ensure we have latest version
    const currentState = yield* stateManager.load()

    // Build the new state
    let newState = { ...currentState }

    // Process completions
    for (const specId of specsToComplete) {
      const spec = newState.queue.active.find((s) => s.specId === specId)
      if (spec) {
        newState = {
          ...newState,
          queue: {
            ...newState.queue,
            active: newState.queue.active.filter((s) => s.specId !== specId),
            completed: [
              ...newState.queue.completed,
              {
                ...spec,
                status: 'completed' as const,
                completedAt: new Date().toISOString(),
              },
            ].slice(-100), // Keep only last 100 completed
          },
        }
      }
    }

    // Process re-queues (closed PRs or orphaned activations)
    for (const specId of specsToRequeue) {
      const spec = newState.queue.active.find((s) => s.specId === specId)
      if (spec) {
        // Check if at max retries
        if (spec.attempts >= newState.config.maxRetries) {
          // Move to failed
          newState = {
            ...newState,
            queue: {
              ...newState.queue,
              active: newState.queue.active.filter((s) => s.specId !== specId),
              failed: [
                ...newState.queue.failed,
                {
                  ...spec,
                  status: 'failed' as const,
                  failureReason: 'Max retries exceeded after PR closures',
                  requiresAction: 'Review implementation approach and manually re-queue',
                },
              ],
            },
            metrics: {
              ...newState.metrics,
              manualInterventionCount: newState.metrics.manualInterventionCount + 1,
            },
          }
          result.specsMoved.toFailed.push(specId)
          // Remove from toPending since we're moving to failed
          const pendingIdx = result.specsMoved.toPending.indexOf(specId)
          if (pendingIdx > -1) {
            result.specsMoved.toPending.splice(pendingIdx, 1)
          }
        } else {
          // Re-queue with incremented attempt
          newState = {
            ...newState,
            queue: {
              ...newState.queue,
              active: newState.queue.active.filter((s) => s.specId !== specId),
              pending: [
                ...newState.queue.pending,
                {
                  ...spec,
                  status: 'pending' as const,
                  attempts: spec.attempts + 1,
                  lastAttempt: new Date().toISOString(),
                  prNumber: undefined,
                  prUrl: undefined,
                  branch: undefined,
                  startedAt: undefined,
                },
              ],
            },
          }
        }
      }
    }

    // Unlock files
    const uniqueFilesToUnlock = [...new Set(filesToUnlock)]
    newState = {
      ...newState,
      activeFiles: newState.activeFiles.filter((f) => !uniqueFilesToUnlock.includes(f)),
    }
    result.filesUnlocked = uniqueFilesToUnlock

    // Unlock specs
    const uniqueSpecsToUnlock = [...new Set(specsToUnlock)]
    newState = {
      ...newState,
      activeSpecs: newState.activeSpecs.filter((s) => !uniqueSpecsToUnlock.includes(s)),
    }
    result.specsUnlocked = uniqueSpecsToUnlock

    // Save updated state
    yield* stateManager.save(newState)
    console.error('✅ State transitions applied')
  }

  return result
})

/**
 * Main entry point
 */
const program = syncStateWithPRs.pipe(
  Effect.provide(Layer.mergeAll(StateManagerLive)),
  Effect.tap((result) =>
    Effect.sync(() => {
      console.error('')
      console.error('📊 Sync Summary:')
      console.error(`  Specs checked: ${result.specsChecked}`)
      console.error(`  Moved to completed: ${result.specsMoved.toCompleted.length}`)
      console.error(`  Re-queued to pending: ${result.specsMoved.toPending.length}`)
      console.error(`  Moved to failed: ${result.specsMoved.toFailed.length}`)
      console.error(`  Files unlocked: ${result.filesUnlocked.length}`)
      console.error(`  Errors: ${result.errors.length}`)

      if (result.errors.length > 0) {
        console.error('')
        console.error('⚠️  Errors encountered:')
        for (const error of result.errors) {
          console.error(`    - ${error}`)
        }
      }

      // Output JSON result to stdout for workflow consumption
      console.log(JSON.stringify(result, null, 2))
    })
  )
)

// Run the program
if (!isCI()) {
  console.error('⚠️  Running in local development mode')
}

Effect.runPromise(program.pipe(Logger.withMinimumLogLevel(LogLevel.Warning))).catch((error) => {
  console.error('❌ State sync failed:', error)
  process.exit(1)
})
