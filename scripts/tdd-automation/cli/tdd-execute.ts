#!/usr/bin/env bun
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * TDD Execute CLI
 *
 * Provides execution analysis and verification for the TDD automation pipeline:
 * - analyze-result: Classify Claude Code outcome (error type, retryability)
 * - detect-sdk-crash: Check if Claude succeeded but SDK crashed
 * - verify-branch: Check if expected branch was created
 * - extract-context: Extract spec ID and context from issue
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
  skip,
} from '../../lib/effect'
import {
  ErrorClassifier,
  ErrorClassifierLive,
  type ClassificationResult,
} from '../services/error-classifier'
import { GitHubAPIClient, GitHubAPIClientLive } from '../services/github-api-client'

// =============================================================================
// Types
// =============================================================================

interface AnalysisResult {
  readonly errorType: string
  readonly isInfrastructure: boolean
  readonly isRetryable: boolean
  readonly shouldPauseQueue: boolean
  readonly claudeWorkSucceeded: boolean
  readonly reason: string
}

interface BranchVerificationResult {
  readonly hasBranch: boolean
  readonly branchName: string | null
  readonly isPostProcessing404: boolean
}

interface ContextExtractionResult {
  readonly specId: string | null
  readonly issueNumber: number
  readonly issueTitle: string
  readonly issueBody: string
}

// =============================================================================
// Constants for Error Detection
// =============================================================================

const SDK_SUCCESS_PATTERNS = [
  '"subtype": "success"',
  '"subtype":"success"',
  '"type": "result", "subtype": "success"',
]

// Errors that require queue pause (not simple retry)
const QUEUE_PAUSE_ERROR_TYPES = new Set([
  'credit_exhausted',
  'rate_limit_exceeded',
  'api_overloaded',
  'auth_error',
])

// =============================================================================
// Commands
// =============================================================================

/**
 * Analyze Result Command
 *
 * Analyzes Claude Code execution outcome and classifies the error type.
 * Used to determine retry behavior and queue actions.
 */
const commandAnalyzeResult = Effect.gen(function* () {
  const errorClassifier = yield* ErrorClassifier
  const fs = yield* FileSystemService

  const outcome = process.env.CLAUDE_OUTCOME ?? process.argv[3] ?? 'unknown'
  const logFile = process.env.WORKFLOW_LOG_FILE ?? process.argv[4]

  yield* logInfo(`🔍 Analyzing Claude Code result (outcome: ${outcome})...`)

  // Read workflow logs if provided
  let workflowLog = ''
  if (logFile) {
    const exists = yield* fs.exists(logFile)
    if (exists) {
      workflowLog = yield* fs.readFile(logFile).pipe(Effect.catchAll(() => Effect.succeed('')))
      yield* logInfo(`   Read ${workflowLog.length} bytes from log file`)
    }
  }

  // Check for Claude success in logs (SDK may crash after)
  let claudeWorkSucceeded = false
  for (const pattern of SDK_SUCCESS_PATTERNS) {
    if (workflowLog.includes(pattern)) {
      claudeWorkSucceeded = true
      yield* logInfo('   Found Claude success output in logs')
      break
    }
  }

  // Classify the error using error-classifier service
  const classification: ClassificationResult = yield* errorClassifier.classify(workflowLog)

  // Determine if queue should pause
  const shouldPauseQueue = QUEUE_PAUSE_ERROR_TYPES.has(classification.errorType)

  // Build result
  const result: AnalysisResult = {
    errorType: classification.errorType,
    isInfrastructure: classification.isInfrastructure,
    isRetryable: classification.isRetryable,
    shouldPauseQueue,
    claudeWorkSucceeded,
    reason: classification.message ?? 'Unknown',
  }

  // Log analysis results
  yield* logInfo('')
  yield* logInfo('📊 Analysis Results:')
  yield* logInfo(`   Error Type: ${result.errorType}`)
  yield* logInfo(`   Infrastructure Error: ${result.isInfrastructure}`)
  yield* logInfo(`   Retryable: ${result.isRetryable}`)
  yield* logInfo(`   Should Pause Queue: ${result.shouldPauseQueue}`)
  yield* logInfo(`   Claude Work Succeeded: ${result.claudeWorkSucceeded}`)

  if (shouldPauseQueue) {
    yield* logError('   ⚠️  Queue should be PAUSED due to credit/rate limit issues')
  } else if (claudeWorkSucceeded && outcome === 'failure') {
    yield* logError('   ⚠️  SDK crash detected after Claude success')
  } else if (result.isRetryable) {
    yield* success('Error is retryable')
  } else {
    yield* skip('Error is NOT retryable')
  }

  // Output for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const output = `error_type=${result.errorType}
is_infrastructure=${result.isInfrastructure}
is_retryable=${result.isRetryable}
should_pause_queue=${result.shouldPauseQueue}
claude_work_succeeded=${result.claudeWorkSucceeded}
`
    yield* fs.writeFile(process.env.GITHUB_OUTPUT, output).pipe(Effect.catchAll(() => Effect.void))
  }

  return result
})

/**
 * Detect SDK Crash Command
 *
 * Checks if Claude succeeded but the SDK crashed before git push.
 * This is detected by finding success output in logs but action reported failure.
 */
const commandDetectSdkCrash = Effect.gen(function* () {
  const fs = yield* FileSystemService

  const outcome = process.env.CLAUDE_OUTCOME ?? process.argv[3] ?? 'unknown'
  const logFile = process.env.WORKFLOW_LOG_FILE ?? process.argv[4]

  yield* logInfo(`🔍 Checking for SDK crash after Claude success (outcome: ${outcome})...`)

  if (outcome !== 'failure') {
    yield* skip(`No SDK crash suspected (outcome: ${outcome})`)
    if (process.env.GITHUB_OUTPUT) {
      yield* fs
        .writeFile(process.env.GITHUB_OUTPUT, `sdk_crash=false\nreason=outcome_not_failure\n`)
        .pipe(Effect.catchAll(() => Effect.void))
    }
    return { sdkCrash: false, reason: 'outcome_not_failure' }
  }

  // Read workflow logs
  let workflowLog = ''
  if (logFile) {
    const exists = yield* fs.exists(logFile)
    if (exists) {
      workflowLog = yield* fs.readFile(logFile).pipe(Effect.catchAll(() => Effect.succeed('')))
    }
  }

  if (!workflowLog) {
    yield* logInfo('   No workflow log provided')
    if (process.env.GITHUB_OUTPUT) {
      yield* fs
        .writeFile(process.env.GITHUB_OUTPUT, `sdk_crash=false\nreason=no_log_file\n`)
        .pipe(Effect.catchAll(() => Effect.void))
    }
    return { sdkCrash: false, reason: 'no_log_file' }
  }

  // Check for Claude success patterns in logs
  let foundSuccess = false
  for (const pattern of SDK_SUCCESS_PATTERNS) {
    if (workflowLog.includes(pattern)) {
      foundSuccess = true
      break
    }
  }

  if (foundSuccess) {
    yield* logInfo('')
    yield* logInfo('╔══════════════════════════════════════════════════════════════════════╗')
    yield* logInfo('║  ⚠️  SDK CRASH DETECTED AFTER CLAUDE SUCCESS                          ║')
    yield* logInfo('╠══════════════════════════════════════════════════════════════════════╣')
    yield* logInfo('║  Claude completed successfully (found success output in logs)        ║')
    yield* logInfo('║  BUT action reported failure - SDK crashed before git push           ║')
    yield* logInfo('║                                                                      ║')
    yield* logInfo('║  DO NOT RETRY - Claude work is done, needs manual recovery           ║')
    yield* logInfo('╚══════════════════════════════════════════════════════════════════════╝')

    if (process.env.GITHUB_OUTPUT) {
      yield* fs
        .writeFile(
          process.env.GITHUB_OUTPUT,
          `sdk_crash=true\nreason=success_in_logs_but_failure\n`
        )
        .pipe(Effect.catchAll(() => Effect.void))
    }
    return { sdkCrash: true, reason: 'success_in_logs_but_failure' }
  }

  yield* skip('No SDK crash detected (no success output in logs)')
  if (process.env.GITHUB_OUTPUT) {
    yield* fs
      .writeFile(process.env.GITHUB_OUTPUT, `sdk_crash=false\nreason=no_success_in_logs\n`)
      .pipe(Effect.catchAll(() => Effect.void))
  }
  return { sdkCrash: false, reason: 'no_success_in_logs' }
})

/**
 * Verify Branch Command
 *
 * Checks if Claude created a branch for the issue.
 * Branch existence is used as ground truth for success (handles post-processing 404 error).
 */
const commandVerifyBranch = Effect.gen(function* () {
  const cmd = yield* CommandService
  const fs = yield* FileSystemService

  const issueNumber = parseInt(process.env.ISSUE_NUMBER ?? process.argv[3] ?? '0', 10)

  if (issueNumber === 0) {
    yield* logError('Usage: bun run cli/tdd-execute.ts verify-branch <issue_number>')
    yield* logError('       or set ISSUE_NUMBER environment variable')
    process.exit(1)
  }

  yield* logInfo(`🔍 Verifying branch for issue #${issueNumber}...`)

  const branchPattern = `claude/issue-${issueNumber}-`

  // Try git ls-remote first (most reliable, bypasses GitHub API propagation delays)
  const repo = process.env.GITHUB_REPOSITORY ?? ''
  let branchName: string | null = null

  if (repo) {
    const lsRemote = yield* cmd
      .spawn([
        'git',
        'ls-remote',
        '--heads',
        `https://github.com/${repo}.git`,
        `refs/heads/${branchPattern}*`,
      ])
      .pipe(
        Effect.catchAll(() => Effect.succeed({ stdout: '', stderr: '', exitCode: 1, duration: 0 }))
      )

    if (lsRemote.exitCode === 0 && lsRemote.stdout.trim()) {
      // Extract branch name from output (format: "<sha>\trefs/heads/<branch>")
      const match = lsRemote.stdout.match(/refs\/heads\/(claude\/issue-\d+-\S+)/)
      if (match && match[1]) {
        branchName = match[1]
        yield* logInfo(`   Found via git ls-remote: ${branchName}`)
      }
    }
  }

  // Fallback to GitHub API
  if (!branchName) {
    yield* logInfo('   git ls-remote did not find branch, trying GitHub API...')
    // Use gh api to search for branches matching pattern
    const branchSearchResult = yield* cmd
      .exec(
        `gh api repos/:owner/:repo/branches --jq '.[] | select(.name | startswith("${branchPattern}")) | .name' 2>/dev/null | head -1`,
        { throwOnError: false }
      )
      .pipe(Effect.catchAll(() => Effect.succeed('')))

    const foundBranch = branchSearchResult.trim()
    if (foundBranch) {
      branchName = foundBranch
      yield* logInfo(`   Found via GitHub API: ${branchName}`)
    }
  }

  const hasBranch = branchName !== null
  const isPostProcessing404 = hasBranch && process.env.CLAUDE_OUTCOME === 'failure'

  const result: BranchVerificationResult = {
    hasBranch,
    branchName,
    isPostProcessing404,
  }

  if (hasBranch) {
    yield* success(`Branch exists: ${branchName}`)
    if (isPostProcessing404) {
      yield* logInfo('   ⚠️  Action failed but branch exists - likely post-processing 404 error')
      yield* logInfo('   Treating as SUCCESS (issue #804 workaround)')
    }
  } else {
    yield* logError(`   No branch found with pattern: ${branchPattern}`)
  }

  // Output for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const output = `has_branch=${hasBranch}
branch_name=${branchName ?? ''}
is_post_processing_404=${isPostProcessing404}
`
    yield* fs.writeFile(process.env.GITHUB_OUTPUT, output).pipe(Effect.catchAll(() => Effect.void))
  }

  return result
})

/**
 * Extract Context Command
 *
 * Extracts spec ID and context from an issue.
 */
const commandExtractContext = Effect.gen(function* () {
  const ghClient = yield* GitHubAPIClient
  const fs = yield* FileSystemService

  const issueNumber = parseInt(process.env.ISSUE_NUMBER ?? process.argv[3] ?? '0', 10)

  if (issueNumber === 0) {
    yield* logError('Usage: bun run cli/tdd-execute.ts extract-context <issue_number>')
    yield* logError('       or set ISSUE_NUMBER environment variable')
    process.exit(1)
  }

  yield* logInfo(`🔍 Extracting context from issue #${issueNumber}...`)

  const issue = yield* ghClient
    .getIssue(issueNumber)
    .pipe(Effect.catchAll(() => Effect.succeed(null)))

  if (!issue) {
    yield* logError(`   ❌ Issue #${issueNumber} not found`)
    if (process.env.GITHUB_OUTPUT) {
      yield* fs
        .writeFile(
          process.env.GITHUB_OUTPUT,
          `spec_id=\nissue_number=${issueNumber}\nissue_found=false\n`
        )
        .pipe(Effect.catchAll(() => Effect.void))
    }
    return { specId: null, issueNumber, issueTitle: '', issueBody: '' }
  }

  // Extract spec ID from title (pattern: API-TABLES-RECORDS-DELETE-015)
  const specIdPattern = /[A-Z]+-[A-Z]+-[A-Z0-9-]+/
  let specId = issue.title.match(specIdPattern)?.[0] ?? null

  // Fallback to body
  if (!specId && issue.body) {
    specId = issue.body.match(specIdPattern)?.[0] ?? null
  }

  const result: ContextExtractionResult = {
    specId,
    issueNumber,
    issueTitle: issue.title,
    issueBody: issue.body ?? '',
  }

  yield* logInfo(`   Title: ${issue.title}`)
  yield* logInfo(`   Spec ID: ${specId ?? 'not found'}`)

  if (specId) {
    yield* success(`Extracted spec ID: ${specId}`)
  } else {
    yield* skip('No spec ID found in issue')
  }

  // Output for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const output = `spec_id=${specId ?? ''}
issue_number=${issueNumber}
issue_found=true
issue_title=${issue.title}
`
    yield* fs.writeFile(process.env.GITHUB_OUTPUT, output).pipe(Effect.catchAll(() => Effect.void))
  }

  return result
})

// =============================================================================
// Pre-Check Command - Validate context before Claude Code execution
// =============================================================================

interface PreCheckResult {
  readonly hasContext: boolean
  readonly issueNumber: number | null
  readonly skipReason: string | null
  readonly cooldownActive: boolean
  readonly hasDuplicatePR: boolean
  readonly isIssueClosed: boolean
}

/**
 * Pre-Check Command
 *
 * Validates context before Claude Code execution:
 * - Cooldown check (30 min window for manual @claude triggers)
 * - @claude mention detection
 * - Issue state validation (closed check)
 * - Duplicate PR detection
 */
const commandPreCheck = Effect.gen(function* () {
  const ghClient = yield* GitHubAPIClient

  const issueNumber = parseInt(process.env.ISSUE_NUMBER ?? process.argv[3] ?? '0', 10)
  const eventName = process.env.GITHUB_EVENT_NAME ?? ''
  const commentBody = process.env.EVENT_COMMENT_BODY ?? ''
  const commentUser = process.env.COMMENT_USER ?? ''
  const cooldownMinutes = parseInt(process.env.COOLDOWN_MINUTES ?? '30', 10)

  yield* logInfo(`🔍 Pre-check validation for issue #${issueNumber}...`)

  let result: PreCheckResult = {
    hasContext: false,
    issueNumber: issueNumber || null,
    skipReason: null,
    cooldownActive: false,
    hasDuplicatePR: false,
    isIssueClosed: false,
  }

  // Skip if comment is from Claude bot
  if (eventName === 'issue_comment' && commentUser === 'claude[bot]') {
    yield* logInfo('⏭️  Comment from Claude bot - skipping')
    result = { ...result, skipReason: 'claude_bot_comment' }
    return result
  }

  // Skip Claude Code status comments
  if (commentBody.includes('Claude Code is working')) {
    yield* logInfo('⏭️  Claude Code status comment - skipping')
    result = { ...result, skipReason: 'status_comment' }
    return result
  }

  // Check if this is an automated retry (exempt from cooldown)
  const isAutomatedRetry =
    commentBody.includes('Automatic Retry') ||
    commentBody.includes('Failed PR Recovery') ||
    commentBody.includes('Regression Auto-Fix') ||
    commentBody.includes('Code Quality') ||
    commentBody.includes('workflow dispatch fallback')

  // Cooldown check for manual @claude triggers
  if (eventName === 'issue_comment' && !isAutomatedRetry && issueNumber > 0) {
    const cmd = yield* CommandService
    const cutoffTime = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString()
    const repo = process.env.GITHUB_REPOSITORY ?? ''

    // Check for recent manual @claude comments using gh CLI
    const countOutput = yield* cmd
      .exec(
        `gh api "/repos/${repo}/issues/${issueNumber}/comments" ` +
          `--jq '[.[] | select(.created_at > "${cutoffTime}") | select(.body | test("@claude"; "i")) | select(.body | test("Automatic Retry|Failed PR Recovery|Regression Auto-Fix|Code Quality.*Auto-Fix|workflow dispatch fallback"; "i") | not)] | length'`
      )
      .pipe(Effect.catchAll(() => Effect.succeed('0')))

    const recentManualCount = parseInt(countOutput.trim(), 10) || 0

    // Subtract 1 for the current triggering comment
    const previousManualCount = Math.max(0, recentManualCount - 1)

    if (previousManualCount > 0) {
      yield* logInfo(
        `⏳ Cooldown active: ${previousManualCount} recent @claude comment(s) in last ${cooldownMinutes} min`
      )
      result = { ...result, skipReason: 'cooldown_active', cooldownActive: true }
      return result
    }

    yield* logInfo('✅ Cooldown check passed')
  }

  // Validate issue exists and get state
  if (issueNumber > 0) {
    const issueBody = yield* ghClient.getIssueBody(issueNumber).pipe(
      Effect.catchAll(() => Effect.succeed(''))
    )

    if (!issueBody) {
      yield* logInfo(`❌ Issue #${issueNumber} not found`)
      result = { ...result, skipReason: 'issue_not_found' }
      return result
    }

    // Check for duplicate PRs
    const duplicateCheck = yield* ghClient.hasPRForBranch(`#${issueNumber}`).pipe(
      Effect.catchAll(() => Effect.succeed(false))
    )

    if (duplicateCheck) {
      yield* logInfo(`⚠️  Found existing PR for issue #${issueNumber}`)
      result = { ...result, skipReason: 'duplicate_pr', hasDuplicatePR: true }
      return result
    }

    // All checks passed
    yield* logInfo('✅ Pre-check validation passed')
    result = { ...result, hasContext: true }
  } else if (eventName === 'workflow_dispatch') {
    // workflow_dispatch requires valid issue number
    result = { ...result, skipReason: 'no_issue_number' }
  } else {
    // Check for @claude mention in comment
    if (commentBody.toLowerCase().includes('@claude')) {
      result = { ...result, hasContext: true }
    } else {
      result = { ...result, skipReason: 'no_claude_mention' }
    }
  }

  // Write JSON output for YAML consumption
  const outputPath = process.env.TDD_OUTPUT_FILE ?? '.github/tdd-output.json'
  const fs = yield* FileSystemService
  yield* fs.writeFile(outputPath, JSON.stringify(result, null, 2)).pipe(Effect.catchAll(() => Effect.void))

  // Write to GITHUB_OUTPUT if available
  if (process.env.GITHUB_OUTPUT) {
    const output = [
      `has_context=${result.hasContext}`,
      `issue_number=${result.issueNumber ?? ''}`,
      `skip_reason=${result.skipReason ?? ''}`,
      `cooldown_active=${result.cooldownActive}`,
      `has_duplicate_pr=${result.hasDuplicatePR}`,
    ].join('\n')
    yield* fs.writeFile(process.env.GITHUB_OUTPUT, output).pipe(Effect.catchAll(() => Effect.void))
  }

  return result
})

// =============================================================================
// Main CLI Entry Point
// =============================================================================

const main = Effect.gen(function* () {
  const command = process.argv[2]

  if (!command) {
    yield* logError('Usage: bun run cli/tdd-execute.ts <command>')
    yield* logError('')
    yield* logError('Commands:')
    yield* logError('  analyze-result   - Classify Claude Code outcome (error type, retryability)')
    yield* logError('  detect-sdk-crash - Check if Claude succeeded but SDK crashed')
    yield* logError('  verify-branch    - Check if expected branch was created')
    yield* logError('  extract-context  - Extract spec ID and context from issue')
    yield* logError('  pre-check        - Validate context before Claude Code execution')
    yield* logError('')
    yield* logError('Environment Variables:')
    yield* logError(
      '  CLAUDE_OUTCOME      - Claude Code action outcome (success/failure/cancelled)'
    )
    yield* logError('  WORKFLOW_LOG_FILE   - Path to workflow log file for analysis')
    yield* logError('  ISSUE_NUMBER        - Issue number for branch/context commands')
    yield* logError('  GITHUB_REPOSITORY   - Repository name (owner/repo) for git operations')
    yield* logError('  GITHUB_OUTPUT       - GitHub Actions output file')
    yield* logError('')
    process.exit(1)
  }

  switch (command) {
    case 'analyze-result':
      yield* commandAnalyzeResult
      break
    case 'detect-sdk-crash':
      yield* commandDetectSdkCrash
      break
    case 'verify-branch':
      yield* commandVerifyBranch
      break
    case 'extract-context':
      yield* commandExtractContext
      break
    case 'pre-check':
      yield* commandPreCheck
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
  GitHubAPIClientLive,
  ErrorClassifierLive
)

Effect.runPromise(
  main.pipe(
    Effect.provide(MainLayer),
    Effect.catchAll((error) =>
      Effect.sync(() => {
        console.error('TDD Execute error:', error)
        process.exit(1)
      })
    )
  )
)
