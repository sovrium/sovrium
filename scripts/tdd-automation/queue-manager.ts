#!/usr/bin/env bun
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * TDD Queue Manager
 *
 * Manages the TDD automation queue:
 * - Scans for test.fixme() patterns and extracts spec IDs
 * - Creates minimal spec issues (one per spec)
 * - Tracks queue status (queued, in-progress, completed)
 * - Provides queue operations (get next, mark in-progress, mark completed)
 */

import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import {
  FileSystemService,
  FileSystemServiceLive,
  CommandServiceLive,
  LoggerServicePretty,
  success,
  progress,
  logInfo,
  skip,
  logError,
} from '../lib/effect'
import {
  checkIdempotencyLock,
  createIdempotencyLock,
  removeIdempotencyLock,
} from './services/idempotency-lock'
import { createSpecIssue } from './services/issue-creator'
import {
  checkRateLimit,
  getQueuedSpecs,
  getInProgressSpecs,
  getAllExistingSpecs,
  specHasIssue,
  specHasOpenIssue,
  getNextSpec,
  markInProgress,
  markCompleted,
  markFailed,
} from './services/queue-operations'
import { scanForFixmeSpecs } from './services/spec-scanner'
import type { SpecItem, SpecIssue, QueueScanResult } from './services/types'

// Re-export types for backward compatibility
export type { SpecItem, SpecIssue, QueueScanResult }

// Re-export functions for backward compatibility
export {
  scanForFixmeSpecs,
  checkRateLimit,
  getQueuedSpecs,
  getInProgressSpecs,
  getAllExistingSpecs,
  specHasIssue,
  specHasOpenIssue,
  createSpecIssue,
  getNextSpec,
  markInProgress,
  markCompleted,
  markFailed,
}

/**
 * CLI: Scan for all test.fixme() and save to file
 */
const commandScan = Effect.gen(function* () {
  const fs = yield* FileSystemService
  const result = yield* scanForFixmeSpecs

  // Save to file
  const outputPath = '.github/tdd-queue-scan.json'
  yield* fs.writeFile(outputPath, JSON.stringify(result, null, 2))
  yield* logInfo('')
  yield* success(`Results saved to ${outputPath}`)

  // Output for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const output = `total_specs=${result.totalSpecs}\n`
    yield* fs.writeFile(process.env.GITHUB_OUTPUT, output).pipe(Effect.catchAll(() => Effect.void))
  }
})

/**
 * CLI: Create issues for all specs (skip duplicates)
 */
const commandPopulate = Effect.gen(function* () {
  // Check idempotency lock
  const canProceed = yield* checkIdempotencyLock
  if (!canProceed) {
    return yield* Effect.fail(new Error('Another populate operation is in progress'))
  }

  // Create lock
  yield* createIdempotencyLock

  try {
    const fs = yield* FileSystemService

    // Read scan results
    const scanPath = '.github/tdd-queue-scan.json'
    const scanExists = yield* fs.exists(scanPath)

    if (!scanExists) {
      yield* logError('❌ No scan results found')
      yield* logError(`   Run: bun run queue-manager scan`)
      yield* removeIdempotencyLock
      return
    }

    const scanContent = yield* fs.readFile(scanPath)
    const scanResult = JSON.parse(scanContent) as QueueScanResult

    if (scanResult.totalSpecs === 0) {
      yield* skip('No specs with .fixme() found')
      yield* removeIdempotencyLock
      return
    }

    // Check rate limit before bulk operations
    yield* checkRateLimit

    // Get all existing spec IDs in one call (efficient bulk query)
    const existingSpecIds = yield* getAllExistingSpecs

    // Filter out specs that already have issues
    const newSpecs = scanResult.specs.filter((spec) => !existingSpecIds.has(spec.specId))

    if (newSpecs.length === 0) {
      yield* skip('All specs already have issues')
      yield* removeIdempotencyLock
      return
    }

    yield* logInfo('')
    yield* logInfo(`📝 Creating ${newSpecs.length} new spec issues...`)
    yield* logInfo('')

    let created = 0
    let skipped = 0

    // Create issues for new specs (skip existence check since we did bulk query)
    for (const spec of newSpecs) {
      const issueNumber = yield* createSpecIssue(spec, true) // skipExistenceCheck=true

      if (issueNumber > 0) {
        created++
        yield* progress(`Created ${created}/${newSpecs.length} issues`)
      } else {
        skipped++
      }
    }

    yield* logInfo('')
    yield* success(`✅ Created ${created} issues, skipped ${skipped} duplicates`)

    // Remove lock
    yield* removeIdempotencyLock
  } catch (error) {
    // Ensure lock is removed even on error
    yield* removeIdempotencyLock
    return yield* Effect.fail(error)
  }
})

/**
 * CLI: Get next queued spec (sorted by priority)
 */
const commandNext = Effect.gen(function* () {
  const fs = yield* FileSystemService
  const next = yield* getNextSpec

  if (!next) {
    yield* skip('No queued specs found')
    // Output for GitHub Actions
    if (process.env.GITHUB_OUTPUT) {
      const output = `has_next=false\n`
      yield* fs
        .writeFile(process.env.GITHUB_OUTPUT, output)
        .pipe(Effect.catchAll(() => Effect.void))
    }
    return
  }

  yield* logInfo('')
  yield* logInfo(`📋 Next spec: ${next.specId}`)
  yield* logInfo(
    `   Priority: ${next.labels?.includes('priority:high') ? 'HIGH' : next.labels?.includes('priority:medium') ? 'MEDIUM' : 'LOW'}`
  )
  yield* logInfo(`   Issue: ${next.url}`)
  yield* logInfo(`   State: ${next.state}`)
  yield* logInfo('')

  // Output for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const output = `has_next=true
spec_id=${next.specId}
issue_number=${next.number}
test_file=${next.testFile || ''}
`
    yield* fs.writeFile(process.env.GITHUB_OUTPUT, output).pipe(Effect.catchAll(() => Effect.void))
  }
})

/**
 * CLI: Show queue status
 */
const commandStatus = Effect.gen(function* () {
  const queued = yield* getQueuedSpecs
  const inProgress = yield* getInProgressSpecs

  yield* logInfo('')
  yield* logInfo(`📊 Queue Status`)
  yield* logInfo(`   Queued: ${queued.length}`)
  yield* logInfo(`   In Progress: ${inProgress.length}`)
  yield* logInfo('')

  if (queued.length > 0) {
    yield* logInfo(`📋 Queued Specs (${queued.length}):`)
    for (const spec of queued.slice(0, 10)) {
      const priority = spec.labels?.includes('priority:high')
        ? 'HIGH'
        : spec.labels?.includes('priority:medium')
          ? 'MED'
          : 'LOW'
      yield* logInfo(`   [${priority}] ${spec.specId} - ${spec.url}`)
    }
    if (queued.length > 10) {
      yield* logInfo(`   ... and ${queued.length - 10} more`)
    }
    yield* logInfo('')
  }

  if (inProgress.length > 0) {
    yield* logInfo(`⚙️  In Progress (${inProgress.length}):`)
    for (const spec of inProgress) {
      yield* logInfo(`   ${spec.specId} - ${spec.url}`)
    }
    yield* logInfo('')
  }
})

/**
 * Main CLI entry point
 */
const main = Effect.gen(function* () {
  const command = process.argv[2]

  if (!command) {
    yield* logError('Usage: bun run queue-manager <command>')
    yield* logError('')
    yield* logError('Commands:')
    yield* logError('  scan      - Scan for test.fixme() and save results')
    yield* logError('  populate  - Create GitHub issues for all specs')
    yield* logError('  next      - Get next queued spec (sorted by priority)')
    yield* logError('  status    - Show queue status')
    yield* logError('')
    process.exit(1)
  }

  switch (command) {
    case 'scan':
      yield* commandScan
      break
    case 'populate':
      yield* commandPopulate
      break
    case 'next':
      yield* commandNext
      break
    case 'status':
      yield* commandStatus
      break
    default:
      yield* logError(`Unknown command: ${command}`)
      process.exit(1)
  }
})

// Run with dependencies
const MainLayer = Layer.merge(
  FileSystemServiceLive,
  Layer.merge(CommandServiceLive, LoggerServicePretty())
)

Effect.runPromise(
  main.pipe(
    Effect.provide(MainLayer),
    Effect.catchAll((error) =>
      Effect.sync(() => {
        console.error('Queue manager error:', error)
        process.exit(1)
      })
    )
  )
)
