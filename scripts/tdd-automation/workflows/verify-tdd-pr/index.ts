/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Console, Effect, Layer } from 'effect'
import { TDD_CONFIG, TDD_LABELS } from '../../core/config'
import { parseTDDPRTitle } from '../../core/parse-pr-title'
import { extractCostFromComment } from '../../services/cost-tracker'
import { ForgejoApi, ForgejoApiLive } from '../../services/vcs-api'

interface VerifyOutput {
  readonly should_dispatch: boolean
  readonly spec_id: string
  readonly spec_file: string
  readonly failure_type: string
  readonly attempt: number
  readonly max_attempts: number
}

function output(result: VerifyOutput): Effect.Effect<void> {
  return Console.log(JSON.stringify(result))
}

function skipDispatch(reason: string): Effect.Effect<void> {
  return Effect.gen(function* () {
    yield* Console.error(`   ⏭️  ${reason}`)
    yield* output({
      should_dispatch: false,
      spec_id: '',
      spec_file: '',
      failure_type: '',
      attempt: 0,
      max_attempts: 0,
    })
  })
}

function extractSpecFileFromBody(body: string): string {
  const match = body.match(/\*\*File\*\*:\s*`([^:`]+\.spec\.ts)/)
  return match?.[1] ?? ''
}

function determineFailureType(
  env: NodeJS.ProcessEnv
): 'quality' | 'spec' | 'e2e-regression' | 'both' | 'infrastructure' {
  const lintResult = env['LINT_RESULT']
  const typecheckResult = env['TYPECHECK_RESULT']
  const e2eTddTargetResult = env['E2E_TDD_TARGET_RESULT']
  const e2eTddDomainResult = env['E2E_TDD_DOMAIN_RESULT']
  const e2eResult = env['E2E_RESULT']

  const allResults = [
    lintResult,
    typecheckResult,
    e2eTddTargetResult,
    e2eTddDomainResult,
    e2eResult,
  ]
  const actionableResults = allResults.filter((r) => r === 'failure' || r === 'success')

  if (actionableResults.length === 0) {
    return 'infrastructure'
  }

  const lintFailed = lintResult === 'failure'
  const typecheckFailed = typecheckResult === 'failure'
  const qualityFailed = lintFailed || typecheckFailed

  const targetSpecFailed = e2eTddTargetResult === 'failure' || e2eTddDomainResult === 'failure'
  const fullE2eFailed = e2eResult === 'failure'
  const specFailed = targetSpecFailed || fullE2eFailed

  if (qualityFailed && specFailed) return 'both'
  if (qualityFailed) return 'quality'

  if (fullE2eFailed && !targetSpecFailed) return 'e2e-regression'

  return 'spec'
}

async function findSpecFileByGrep(specId: string): Promise<string> {
  try {
    const result = Bun.spawnSync(['grep', '-rl', specId, 'specs/', '--include=*.spec.ts'])
    const output = result.stdout.toString().trim()
    return output.split('\n')[0] ?? ''
  } catch {
    return ''
  }
}

const main = Effect.gen(function* () {
  const prNumber = Number(process.env['PR_NUMBER'])
  if (!prNumber) {
    yield* Console.error('::error::PR_NUMBER environment variable is required')
    yield* output({
      should_dispatch: false,
      spec_id: '',
      spec_file: '',
      failure_type: '',
      attempt: 0,
      max_attempts: 0,
    })
    return
  }

  yield* Console.error(`🔍 Verifying TDD PR #${prNumber}`)

  const forgejo = yield* ForgejoApi

  const pr = yield* forgejo.getPR(prNumber)

  if (!pr.labels.includes(TDD_LABELS.AUTOMATION)) {
    yield* skipDispatch(`PR #${prNumber} does not have tdd-automation label`)
    return
  }

  const parsed = parseTDDPRTitle(pr.title)
  const currentAttempt = parsed?.attempt ?? 1
  const maxAttempts = parsed?.maxAttempts ?? TDD_CONFIG.MAX_ATTEMPTS
  const specId = parsed?.specId ?? ''
  const nextAttempt = currentAttempt + 1

  const comments = yield* forgejo.getPRComments(prNumber)
  const reportCount = comments.filter((c) => extractCostFromComment(c.body) !== null).length

  yield* Console.error(`   Attempt: ${currentAttempt}/${maxAttempts}, Reports: ${reportCount}`)

  if (nextAttempt > maxAttempts || reportCount >= maxAttempts) {
    yield* Console.error(
      `   Max attempts reached (attempt ${currentAttempt}/${maxAttempts}, reports=${reportCount})`
    )
    yield* forgejo
      .addLabel(prNumber, TDD_LABELS.MANUAL_INTERVENTION)
      .pipe(
        Effect.catchTag('ForgejoApiError', (error) =>
          Console.error(`   ⚠️  Failed to add manual-intervention label: ${error.operation}`)
        )
      )
    yield* skipDispatch('Max attempts reached — added manual-intervention label')
    return
  }


  let specFile: string = ''
  const prBody = yield* Effect.tryPromise({
    try: async () => {
      const { owner, repo, baseUrl, token } = await import('../../services/vcs-api').then((m) =>
        m.getForgejoConfig()
      )
      const resp = await fetch(`${baseUrl}/api/v1/repos/${owner}/${repo}/pulls/${prNumber}`, {
        headers: { Authorization: `token ${token}` },
      })
      const data = (await resp.json()) as { body: string }
      return data.body ?? ''
    },
    catch: () => '',
  }).pipe(Effect.catchAll(() => Effect.succeed('')))

  specFile = extractSpecFileFromBody(prBody)

  if (!specFile && specId) {
    specFile = yield* Effect.promise(() => findSpecFileByGrep(specId))
  }

  yield* Console.error(`   Spec: ${specId}, File: ${specFile}`)

  const failureType = determineFailureType(process.env)
  yield* Console.error(`   Failure type: ${failureType}`)

  if (failureType === 'infrastructure') {
    yield* Console.error('   Infrastructure failure detected — skipping Claude dispatch')
    yield* skipDispatch('Infrastructure failure — not a code issue')
    return
  }

  yield* output({
    should_dispatch: true,
    spec_id: specId,
    spec_file: specFile,
    failure_type: failureType,
    attempt: nextAttempt,
    max_attempts: maxAttempts,
  })
}).pipe(
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      const msg = error instanceof Error ? error.message : String(error)
      yield* Console.error(`::error::Verify TDD PR failed: ${msg}`)
      yield* output({
        should_dispatch: false,
        spec_id: '',
        spec_file: '',
        failure_type: '',
        attempt: 0,
        max_attempts: 0,
      })
    })
  ),
  Effect.provide(Layer.mergeAll(ForgejoApiLive))
)

Effect.runPromise(main).catch((error) => {
  console.error(`::error::Unhandled error in verify-tdd-pr: ${error}`)
  console.log(
    JSON.stringify({
      should_dispatch: false,
      spec_id: '',
      spec_file: '',
      failure_type: '',
      attempt: 0,
      max_attempts: 0,
    })
  )
})
