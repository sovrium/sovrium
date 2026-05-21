/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Console, Effect, Layer } from 'effect'
import { FileSystemServiceLive, LoggerServiceLive } from '../../../lib/effect'
import { findReadySpec } from '../../core/find-ready-spec'
import { extractSpecIdFromBranch } from '../../core/parse-pr-title'
import { LiveLayer } from '../../layers/live'
import { checkCreditLimits } from '../../programs/check-credit-limits'
import { createTDDPR } from '../../programs/create-tdd-pr'
import { findActiveTDDPR } from '../../programs/find-active-tdd-pr'
import { ForgejoApi } from '../../services/vcs-api'

interface PRCreatorOutput {
  readonly prCreated: boolean
  readonly prNumber: string
  readonly specId: string
  readonly specFile: string
  readonly branch: string
}

function extractFilePrefix(specId: string): string | null {
  const match = specId.match(/^(.+)-(?:\d+|REGRESSION)$/i)
  if (match?.[1]) {
    return match[1].toUpperCase()
  }
  return null
}

const outputNoop = (reason: string) =>
  Effect.gen(function* () {
    yield* Console.error(`⏭️  Skipping PR creation: ${reason}`)
    const result: PRCreatorOutput = {
      prCreated: false,
      prNumber: '',
      specId: '',
      specFile: '',
      branch: '',
    }
    yield* Console.log(JSON.stringify(result))
  })

const main = Effect.gen(function* () {
  yield* Console.error('🚀 TDD PR Creator - Starting orchestration')
  yield* Console.error('')

  yield* Console.error('── Step 1: Check for active TDD PRs ──')
  const activePRResult = yield* findActiveTDDPR

  if (activePRResult.hasActivePR && activePRResult.activePR) {
    yield* Console.error(
      `   Active TDD PR: #${activePRResult.activePR.number} (${activePRResult.activePR.specId})`
    )
    return yield* outputNoop(
      `Active TDD PR #${activePRResult.activePR.number} exists (serial processing)`
    )
  }
  yield* Console.error('   ✅ No active TDD PR — can proceed')
  yield* Console.error('')

  yield* Console.error('── Step 2: Check credit limits ──')
  const creditResult = yield* checkCreditLimits

  for (const warning of creditResult.warnings) {
    yield* Console.error(`   ⚠️  ${warning}`)
  }

  if (!creditResult.canProceed) {
    return yield* outputNoop('Credits exhausted')
  }
  yield* Console.error('   ✅ Credits available')
  yield* Console.error('')

  yield* Console.error('── Step 2b: Check for budget-closed PRs ──')
  const forgejo = yield* ForgejoApi

  const closedPRs = yield* forgejo
    .listTDDPRs('closed')
    .pipe(Effect.catchTag('ForgejoApiError', () => Effect.succeed([] as const)))

  for (const pr of closedPRs) {
    const comments = yield* forgejo
      .getPRComments(pr.number)
      .pipe(Effect.catchTag('ForgejoApiError', () => Effect.succeed([] as const)))
    const wasBudgetClosed = comments.some((c) => c.body.includes('Budget Exceeded'))

    if (wasBudgetClosed) {
      yield* Console.error(`   Found budget-closed PR #${pr.number} (${pr.specId}) — reopening`)
      yield* forgejo
        .reopenPR(pr.number)
        .pipe(
          Effect.catchTag('ForgejoApiError', (error) =>
            Console.error(`   ⚠️  Failed to reopen PR #${pr.number}: ${error.operation}`)
          )
        )
      yield* forgejo
        .postComment(
          pr.number,
          '## :white_check_mark: Credits Available — PR Reopened\n\n' +
            'Claude Code credits are available again.\n' +
            'This PR has been reopened and will be picked up by the next test cycle.'
        )
        .pipe(Effect.catchTag('ForgejoApiError', () => Effect.void))

      return yield* outputNoop(`Reopened budget-closed PR #${pr.number} — waiting for test cycle`)
    }
  }
  yield* Console.error('   No budget-closed PRs found')
  yield* Console.error('')

  yield* Console.error('── Step 3: Find blocked spec files ──')
  const allPRs = yield* forgejo.listTDDPRs()

  const manualInterventionPRs = allPRs.filter((pr) => pr.hasManualInterventionLabel)

  const blockedSpecs = manualInterventionPRs
    .map((pr) => extractSpecIdFromBranch(pr.branch))
    .filter((specId): specId is string => specId !== null)

  const blockedFiles = Array.from(
    new Set(
      blockedSpecs
        .map((specId) => extractFilePrefix(specId))
        .filter((prefix): prefix is string => prefix !== null)
    )
  )

  if (blockedFiles.length > 0) {
    yield* Console.error(`   🚫 ${blockedFiles.length} blocked file(s):`)
    for (const filePrefix of blockedFiles) {
      yield* Console.error(`      - ${filePrefix}`)
    }
  } else {
    yield* Console.error('   ✅ No blocked files')
  }
  yield* Console.error('')

  yield* Console.error('── Step 4: Find next ready spec ──')
  const readySpec = yield* findReadySpec(blockedFiles.length > 0 ? blockedFiles : undefined)

  if (!readySpec) {
    return yield* outputNoop('No .fixme() spec available for processing')
  }

  yield* Console.error(`   📋 Selected: ${readySpec.specId}`)
  yield* Console.error(`      File: ${readySpec.file}:${readySpec.line}`)
  yield* Console.error(`      Description: ${readySpec.description}`)
  yield* Console.error(`      Priority: ${readySpec.priority}`)
  yield* Console.error('')

  yield* Console.error('── Step 5: Create TDD branch and PR ──')
  const createResult = yield* createTDDPR({ spec: readySpec })

  yield* Console.error(`   ✅ PR created: #${createResult.prNumber}`)
  yield* Console.error(`      Branch: ${createResult.branch}`)
  yield* Console.error(`      URL: ${createResult.prUrl}`)
  yield* Console.error('')

  const result: PRCreatorOutput = {
    prCreated: true,
    prNumber: String(createResult.prNumber),
    specId: createResult.specId,
    specFile: readySpec.file,
    branch: createResult.branch,
  }

  yield* Console.error('🎉 TDD PR Creator completed successfully')
  yield* Console.log(JSON.stringify(result))
}).pipe(
  Effect.catchTag('CreditsExhausted', () =>
    Effect.gen(function* () {
      yield* Console.error('::warning::Claude Code API credits exhausted')
      yield* outputNoop('Claude Code API credits exhausted')
    })
  ),
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      const tag = '_tag' in error ? (error as { _tag: string })._tag : 'Unknown'
      const errorMsg =
        'operation' in error && 'stderr' in error
          ? `${(error as { operation: string }).operation}: ${String((error as { stderr: unknown }).stderr)}`
          : 'operation' in error && 'cause' in error
            ? `${(error as { operation: string }).operation}: ${String((error as { cause: unknown }).cause)}`
            : 'message' in error
              ? String((error as { message: unknown }).message)
              : String(error)
      yield* Console.error(`::error::${tag}: ${errorMsg}`)
      yield* Console.log(
        JSON.stringify({
          prCreated: false,
          prNumber: '',
          specId: '',
          specFile: '',
          branch: '',
          error: `${tag}: ${errorMsg}`,
        })
      )
    })
  ),
  Effect.provide(Layer.mergeAll(LiveLayer, FileSystemServiceLive, LoggerServiceLive()))
)

Effect.runPromise(main).catch((error) => {
  console.error(`::error::Unhandled error in TDD PR Creator: ${error}`)
  console.log(
    JSON.stringify({
      prCreated: false,
      prNumber: '',
      specId: '',
      specFile: '',
      branch: '',
      error: String(error),
    })
  )
})
