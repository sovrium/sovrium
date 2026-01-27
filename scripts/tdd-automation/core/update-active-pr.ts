#!/usr/bin/env bun

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Update Active PR Information
 *
 * Updates the state file with PR information for an active spec.
 * Called by the orchestrator after creating a PR.
 *
 * Usage:
 *   bun run scripts/tdd-automation/core/update-active-pr.ts \
 *     --spec-id "API-TABLES-001" \
 *     --pr-number 123 \
 *     --pr-url "https://github.com/owner/repo/pull/123" \
 *     --branch "tdd/API-TABLES-001-1234567890"
 */

import { parseArgs } from 'node:util'
import { Effect, Layer, Logger, LogLevel } from 'effect'
import { isCI } from './github-operations'
import { StateManager, StateManagerLive } from './state-manager'

/**
 * Parse command line arguments
 */
const parseArguments = () => {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      'spec-id': { type: 'string' },
      'pr-number': { type: 'string' },
      'pr-url': { type: 'string' },
      branch: { type: 'string' },
    },
    strict: true,
  })

  const { 'spec-id': specId, 'pr-number': prNumber, 'pr-url': prUrl, branch } = values

  if (!specId || !prNumber || !prUrl || !branch) {
    console.error(
      'Usage: update-active-pr.ts --spec-id ID --pr-number NUM --pr-url URL --branch NAME'
    )
    console.error('')
    console.error('Required arguments:')
    console.error('  --spec-id     Spec ID (e.g., "API-TABLES-001")')
    console.error('  --pr-number   PR number (e.g., 123)')
    console.error('  --pr-url      PR URL (e.g., "https://github.com/owner/repo/pull/123")')
    console.error('  --branch      Branch name (e.g., "tdd/API-TABLES-001-1234567890")')
    process.exit(1)
  }

  const prNumberInt = parseInt(prNumber, 10)
  if (isNaN(prNumberInt)) {
    console.error(`Error: --pr-number must be a valid integer, got: ${prNumber}`)
    process.exit(1)
  }

  return {
    specId,
    prNumber: prNumberInt,
    prUrl,
    branch,
  }
}

/**
 * Main program
 */
const program = Effect.gen(function* () {
  const args = parseArguments()

  console.error(`📝 Updating PR info for ${args.specId}...`)
  console.error(`   PR #${args.prNumber}: ${args.prUrl}`)
  console.error(`   Branch: ${args.branch}`)

  const stateManager = yield* StateManager

  yield* stateManager.updateActivePR(args.specId, {
    prNumber: args.prNumber,
    prUrl: args.prUrl,
    branch: args.branch,
  })

  console.error(`✅ PR info updated successfully`)

  // Output success JSON for workflow consumption
  console.log(
    JSON.stringify({
      success: true,
      specId: args.specId,
      prNumber: args.prNumber,
      prUrl: args.prUrl,
      branch: args.branch,
    })
  )
})

// Run the program
if (!isCI()) {
  console.error('⚠️  Running in local development mode')
}

Effect.runPromise(
  program.pipe(
    Effect.provide(Layer.mergeAll(StateManagerLive)),
    Logger.withMinimumLogLevel(LogLevel.Warning)
  )
).catch((error) => {
  console.error('❌ Failed to update PR info:', error)
  process.exit(1)
})
