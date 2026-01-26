#!/usr/bin/env bun
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * TDD Dispatch CLI
 *
 * Provides queue processing and validation operations for the TDD automation pipeline:
 * - check-paused: Check if queue is paused (credit exhaustion)
 * - validate-issue: Validate issue state before processing
 * - check-superseded: Check if spec is already implemented
 * - check-cooldown: Check if issue is in cooldown period
 */

import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import {
  CommandService,
  CommandServiceLive,
  FileSystemService,
  FileSystemServiceLive,
  LoggerServicePretty,
  logInfo,
  logError,
  success,
} from '../../lib/effect'
import { GitHubAPIClient, GitHubAPIClientLive } from '../services/github-api-client'
import { LabelStateMachine, LabelStateMachineLive } from '../services/label-state-machine'
import { PRManager, PRManagerLive } from '../services/pr-manager'
import { RetryManagerLive, COOLDOWN_PERIODS } from '../services/retry-manager'
import { TimeUtils, TimeUtilsLive } from '../services/time-utils'

// =============================================================================
// Types
// =============================================================================

interface ValidationResult {
  readonly isValid: boolean
  readonly reason: string
  readonly shouldProcess: boolean
}

// =============================================================================
// Commands
// =============================================================================

/**
 * Check Paused Command
 *
 * Checks if the TDD queue is paused due to credit exhaustion.
 * Outputs result to GITHUB_OUTPUT if running in GitHub Actions.
 */
const commandCheckPaused = Effect.gen(function* () {
  const ghClient = yield* GitHubAPIClient
  const fs = yield* FileSystemService

  yield* logInfo('🔍 Checking if TDD queue is paused...')

  // Look for open issues with tdd-queue:paused label
  const pausedIssues = yield* ghClient.listIssues({
    labels: ['tdd-queue-status', 'tdd-queue:paused'],
    state: 'open',
  })

  const isPaused = pausedIssues.length > 0

  if (isPaused) {
    const pauseIssue = pausedIssues[0]!
    yield* logInfo('')
    yield* logInfo('╔══════════════════════════════════════════════════════════════════════╗')
    yield* logInfo('║  ⏸️  TDD QUEUE IS PAUSED                                               ║')
    yield* logInfo('╠══════════════════════════════════════════════════════════════════════╣')
    yield* logInfo(`║  Status Issue: #${pauseIssue.number}`)
    yield* logInfo(`║  Title: ${pauseIssue.title}`)
    yield* logInfo(`║  Paused Since: ${pauseIssue.updatedAt}`)
    yield* logInfo('║                                                                      ║')
    yield* logInfo('║  Queue will not process new specs until resumed.                    ║')
    yield* logInfo('║  Auto-resume: ~2 hours via tdd-monitor.yml                          ║')
    yield* logInfo('╚══════════════════════════════════════════════════════════════════════╝')
    yield* logInfo('')
  } else {
    yield* success('Queue is active (not paused)')
  }

  // Output for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const pauseIssue = pausedIssues[0]
    const output = `paused=${isPaused}
pause_issue=${pauseIssue?.number ?? ''}
`
    yield* fs.writeFile(process.env.GITHUB_OUTPUT, output).pipe(Effect.catchAll(() => Effect.void))
  }

  return { isPaused, pauseIssue: pausedIssues[0] }
})

/**
 * Validate Issue Command
 *
 * Validates an issue before processing:
 * - Checks if issue is still open
 * - Checks for existing open PRs (duplicate prevention)
 */
const commandValidateIssue = Effect.gen(function* () {
  const ghClient = yield* GitHubAPIClient
  const prManager = yield* PRManager
  const fs = yield* FileSystemService

  const issueNumber = parseInt(process.env.ISSUE_NUMBER ?? process.argv[3] ?? '0', 10)

  if (issueNumber === 0) {
    yield* logError('Usage: bun run cli/tdd-dispatch.ts validate-issue <issue_number>')
    yield* logError('       or set ISSUE_NUMBER environment variable')
    process.exit(1)
  }

  yield* logInfo(`🔍 Validating issue #${issueNumber} before processing...`)

  // Check if issue is still open
  const issue = yield* ghClient
    .getIssue(issueNumber)
    .pipe(Effect.catchAll(() => Effect.succeed(null)))

  if (!issue) {
    yield* logError(`   ❌ Issue #${issueNumber} not found`)
    const result: ValidationResult = {
      isValid: false,
      reason: 'issue_not_found',
      shouldProcess: false,
    }
    if (process.env.GITHUB_OUTPUT) {
      yield* fs
        .writeFile(process.env.GITHUB_OUTPUT, `should_process=false\nreason=issue_not_found\n`)
        .pipe(Effect.catchAll(() => Effect.void))
    }
    return result
  }

  if (issue.state === 'closed') {
    yield* logInfo(`   ⚠️  Issue #${issueNumber} is already CLOSED`)
    yield* logInfo('   Skipping processing (likely already completed by another PR)')
    const result: ValidationResult = {
      isValid: false,
      reason: 'issue_closed',
      shouldProcess: false,
    }
    if (process.env.GITHUB_OUTPUT) {
      yield* fs
        .writeFile(process.env.GITHUB_OUTPUT, `should_process=false\nreason=issue_closed\n`)
        .pipe(Effect.catchAll(() => Effect.void))
    }
    return result
  }

  // Check for existing open PRs for this issue
  const existingPRs = yield* prManager
    .findPRsForIssue(issueNumber)
    .pipe(Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<{ number: number }>)))

  if (existingPRs.length > 0) {
    yield* logInfo(
      `   ⚠️  Found existing open PR(s) for issue #${issueNumber}: ${existingPRs.map((pr) => pr.number).join(', ')}`
    )
    yield* logInfo('   Skipping processing to avoid duplicate PRs')
    const result: ValidationResult = {
      isValid: false,
      reason: 'duplicate_pr_exists',
      shouldProcess: false,
    }
    if (process.env.GITHUB_OUTPUT) {
      yield* fs
        .writeFile(
          process.env.GITHUB_OUTPUT,
          `should_process=false\nreason=duplicate_pr_exists\nduplicate_prs=${existingPRs.map((pr) => pr.number).join(',')}\n`
        )
        .pipe(Effect.catchAll(() => Effect.void))
    }
    return result
  }

  yield* success(`Issue #${issueNumber} is valid for processing`)
  const result: ValidationResult = {
    isValid: true,
    reason: 'valid',
    shouldProcess: true,
  }

  if (process.env.GITHUB_OUTPUT) {
    yield* fs
      .writeFile(process.env.GITHUB_OUTPUT, `should_process=true\nreason=valid\n`)
      .pipe(Effect.catchAll(() => Effect.void))
  }

  return result
})

/**
 * Check Superseded Command
 *
 * Checks if a spec is already implemented (no longer has .fixme()).
 */
const commandCheckSuperseded = Effect.gen(function* () {
  const fs = yield* FileSystemService
  const cmd = yield* CommandService

  const specId = process.env.SPEC_ID ?? process.argv[3]
  const testFile = process.env.TEST_FILE ?? process.argv[4]

  if (!specId) {
    yield* logError('Usage: bun run cli/tdd-dispatch.ts check-superseded <spec_id> [test_file]')
    yield* logError('       or set SPEC_ID and TEST_FILE environment variables')
    process.exit(1)
  }

  yield* logInfo(`🔍 Checking if spec ${specId} is superseded...`)

  // If test file provided, check directly
  let actualTestFile = testFile

  if (actualTestFile) {
    const exists = yield* fs.exists(actualTestFile)
    if (!exists) {
      yield* logInfo(`   ⚠️  Test file ${actualTestFile} not found at expected path`)
      yield* logInfo(`   Searching for spec ${specId} in codebase...`)
      actualTestFile = undefined
    }
  }

  // Search for spec ID in codebase if needed
  if (!actualTestFile) {
    const grepResult = yield* cmd
      .spawn(['grep', '-rl', specId, 'specs/'])
      .pipe(
        Effect.catchAll(() => Effect.succeed({ stdout: '', stderr: '', exitCode: 1, duration: 0 }))
      )

    if (grepResult.exitCode === 0 && grepResult.stdout.trim()) {
      actualTestFile = grepResult.stdout.trim().split('\n')[0]
      yield* logInfo(`   Found spec at: ${actualTestFile}`)
    } else {
      yield* logInfo(`   ❌ Spec ${specId} not found anywhere in specs/ - treating as superseded`)
      if (process.env.GITHUB_OUTPUT) {
        yield* fs
          .writeFile(process.env.GITHUB_OUTPUT, `is_superseded=true\nreason=spec_not_found\n`)
          .pipe(Effect.catchAll(() => Effect.void))
      }
      return { isSuperseded: true, reason: 'spec_not_found' }
    }
  }

  // Read the test file and check for .fixme()
  const content = yield* fs
    .readFile(actualTestFile!)
    .pipe(Effect.catchAll(() => Effect.succeed('')))

  if (!content) {
    yield* logInfo(`   ❌ Could not read test file - treating as superseded`)
    if (process.env.GITHUB_OUTPUT) {
      yield* fs
        .writeFile(process.env.GITHUB_OUTPUT, `is_superseded=true\nreason=file_unreadable\n`)
        .pipe(Effect.catchAll(() => Effect.void))
    }
    return { isSuperseded: true, reason: 'file_unreadable' }
  }

  // Check if spec ID exists in the file
  if (!content.includes(specId)) {
    yield* logInfo(`   ❌ Spec ${specId} not found in ${actualTestFile} - treating as superseded`)
    if (process.env.GITHUB_OUTPUT) {
      yield* fs
        .writeFile(process.env.GITHUB_OUTPUT, `is_superseded=true\nreason=spec_removed\n`)
        .pipe(Effect.catchAll(() => Effect.void))
    }
    return { isSuperseded: true, reason: 'spec_removed' }
  }

  // Find the line with the spec ID and check surrounding context for .fixme(
  const lines = content.split('\n')
  const specLineIndex = lines.findIndex((line) => line.includes(specId))

  if (specLineIndex === -1) {
    yield* logInfo(`   ❌ Spec ${specId} line not found - treating as superseded`)
    if (process.env.GITHUB_OUTPUT) {
      yield* fs
        .writeFile(process.env.GITHUB_OUTPUT, `is_superseded=true\nreason=spec_line_not_found\n`)
        .pipe(Effect.catchAll(() => Effect.void))
    }
    return { isSuperseded: true, reason: 'spec_line_not_found' }
  }

  // Check the 5 lines before the spec ID for .fixme(
  const startLine = Math.max(0, specLineIndex - 5)
  const context = lines.slice(startLine, specLineIndex + 1).join('\n')
  const hasFixme = context.includes('.fixme(')

  if (hasFixme) {
    yield* success(`Spec ${specId} still has .fixme() - needs implementation`)
    if (process.env.GITHUB_OUTPUT) {
      yield* fs
        .writeFile(process.env.GITHUB_OUTPUT, `is_superseded=false\ntest_file=${actualTestFile}\n`)
        .pipe(Effect.catchAll(() => Effect.void))
    }
    return { isSuperseded: false, testFile: actualTestFile }
  } else {
    yield* logInfo(`   ⚠️  Spec ${specId} no longer has .fixme() - already implemented!`)
    if (process.env.GITHUB_OUTPUT) {
      yield* fs
        .writeFile(process.env.GITHUB_OUTPUT, `is_superseded=true\nreason=already_implemented\n`)
        .pipe(Effect.catchAll(() => Effect.void))
    }
    return { isSuperseded: true, reason: 'already_implemented' }
  }
})

/**
 * Check Cooldown Command
 *
 * Checks if an issue is in cooldown period (recently processed/failed).
 */
const commandCheckCooldown = Effect.gen(function* () {
  const sm = yield* LabelStateMachine
  const ghClient = yield* GitHubAPIClient
  const timeUtils = yield* TimeUtils
  const fs = yield* FileSystemService

  const issueNumber = parseInt(process.env.ISSUE_NUMBER ?? process.argv[3] ?? '0', 10)

  if (issueNumber === 0) {
    yield* logError('Usage: bun run cli/tdd-dispatch.ts check-cooldown <issue_number>')
    yield* logError('       or set ISSUE_NUMBER environment variable')
    process.exit(1)
  }

  yield* logInfo(`🔍 Checking cooldown status for issue #${issueNumber}...`)

  // Get the issue for updatedAt timestamp
  const issue = yield* ghClient
    .getIssue(issueNumber)
    .pipe(Effect.catchAll(() => Effect.succeed(null)))

  if (!issue) {
    yield* logError(`   ❌ Could not get issue #${issueNumber}`)
    if (process.env.GITHUB_OUTPUT) {
      yield* fs
        .writeFile(process.env.GITHUB_OUTPUT, `in_cooldown=false\nreason=issue_not_found\n`)
        .pipe(Effect.catchAll(() => Effect.void))
    }
    return { inCooldown: false, reason: 'issue_not_found' }
  }

  // Get current spec state from labels
  const state = yield* sm
    .getIssueState(issueNumber)
    .pipe(Effect.catchAll(() => Effect.succeed(null)))

  // Check if issue was recently updated
  const ageMinutes = yield* timeUtils
    .getAgeMinutes(issue.updatedAt)
    .pipe(Effect.catchAll(() => Effect.succeed(999_999)))

  // Determine cooldown period based on current state
  let cooldownMinutes: number = COOLDOWN_PERIODS.standard
  if (state?.failureType) {
    cooldownMinutes = COOLDOWN_PERIODS.failedPR
  } else if (state?.currentState === 'failed') {
    cooldownMinutes = COOLDOWN_PERIODS.failedPR
  }

  const inCooldown = ageMinutes < cooldownMinutes
  const remainingMinutes = Math.max(0, Math.ceil(cooldownMinutes - ageMinutes))

  if (inCooldown) {
    yield* logInfo(`   ⏳ Issue #${issueNumber} is in cooldown`)
    yield* logInfo(`   Remaining: ${remainingMinutes} minutes`)
    yield* logInfo(`   Last activity: ${Math.round(ageMinutes)} minutes ago`)
    if (process.env.GITHUB_OUTPUT) {
      yield* fs
        .writeFile(
          process.env.GITHUB_OUTPUT,
          `in_cooldown=true\nremaining_minutes=${remainingMinutes}\n`
        )
        .pipe(Effect.catchAll(() => Effect.void))
    }
  } else {
    yield* success(`Issue #${issueNumber} is not in cooldown (ready to process)`)
    if (process.env.GITHUB_OUTPUT) {
      yield* fs
        .writeFile(process.env.GITHUB_OUTPUT, `in_cooldown=false\nreason=cooldown_expired\n`)
        .pipe(Effect.catchAll(() => Effect.void))
    }
  }

  return { inCooldown, remainingMinutes, ageMinutes: Math.round(ageMinutes) }
})

// =============================================================================
// Main CLI Entry Point
// =============================================================================

const main = Effect.gen(function* () {
  const command = process.argv[2]

  if (!command) {
    yield* logError('Usage: bun run cli/tdd-dispatch.ts <command>')
    yield* logError('')
    yield* logError('Commands:')
    yield* logError('  check-paused     - Check if queue is paused (credit exhaustion)')
    yield* logError('  validate-issue   - Validate issue state before processing')
    yield* logError('  check-superseded - Check if spec is already implemented')
    yield* logError('  check-cooldown   - Check if issue is in cooldown period')
    yield* logError('')
    process.exit(1)
  }

  switch (command) {
    case 'check-paused':
      yield* commandCheckPaused
      break
    case 'validate-issue':
      yield* commandValidateIssue
      break
    case 'check-superseded':
      yield* commandCheckSuperseded
      break
    case 'check-cooldown':
      yield* commandCheckCooldown
      break
    default:
      yield* logError(`Unknown command: ${command}`)
      yield* logError('')
      yield* logError('Run without arguments to see available commands.')
      process.exit(1)
  }
})

// =============================================================================
// Run with Dependencies
// =============================================================================

const MainLayer = Layer.mergeAll(
  FileSystemServiceLive,
  CommandServiceLive,
  LoggerServicePretty(),
  TimeUtilsLive,
  GitHubAPIClientLive,
  LabelStateMachineLive,
  PRManagerLive,
  RetryManagerLive
)

Effect.runPromise(
  main.pipe(
    Effect.provide(MainLayer),
    Effect.catchAll((error) =>
      Effect.sync(() => {
        console.error('TDD Dispatch error:', error)
        process.exit(1)
      })
    )
  )
)
