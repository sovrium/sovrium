/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Console, Effect, Layer } from 'effect'
import { FileSystemServiceLive, LoggerServiceLive } from '../../../lib/effect'
import {
  TDD_V4_CONFIG,
  TDD_V4_LABELS,
  formatTDDV4PRTitle,
  getTDDV4BranchName,
} from '../../core/config'
import { GitOperationError } from '../../core/errors'
import { findReadyFile, type ReadyFile } from '../../core/find-ready-file'
import { LiveLayer } from '../../layers/live'
import { checkCreditLimits } from '../../programs/check-credit-limits'
import { GitOperations } from '../../services/git-operations'
import { ForgejoApi } from '../../services/vcs-api'

interface V4PRCreatorOutput {
  readonly prCreated: boolean
  readonly prNumber: string
  readonly slug: string
  readonly filePath: string
  readonly branch: string
  readonly fixmeSpecCount: number
  readonly hasRegression: boolean
}

const outputNoop = (reason: string) =>
  Effect.gen(function* () {
    yield* Console.error(`⏭️  V4: skipping PR creation: ${reason}`)
    const result: V4PRCreatorOutput = {
      prCreated: false,
      prNumber: '',
      slug: '',
      filePath: '',
      branch: '',
      fixmeSpecCount: 0,
      hasRegression: false,
    }
    yield* Console.log(JSON.stringify(result))
  })

function activateAllFixmeSpecs(filePath: string): Effect.Effect<number, GitOperationError> {
  return Effect.tryPromise({
    try: async () => {
      const file = Bun.file(filePath)
      const content = await file.text()
      const lines = content.split('\n')
      let activated = 0
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (!line) continue
        if (line.includes('test.fixme(')) {
          lines[i] = line.replace(/test\.fixme\s*\(/g, 'test(')
          activated++
        } else if (line.includes('it.fixme(')) {
          lines[i] = line.replace(/it\.fixme\s*\(/g, 'it(')
          activated++
        }
      }
      await Bun.write(filePath, lines.join('\n'))
      return activated
    },
    catch: (error) =>
      new GitOperationError({
        operation: 'activateAllFixmeSpecs',
        stderr: error instanceof Error ? error.message : String(error),
      }),
  })
}

const createV4PR = (ready: ReadyFile) =>
  Effect.gen(function* () {
    const forgejo = yield* ForgejoApi
    const git = yield* GitOperations

    const branch = getTDDV4BranchName(ready.slug)
    const title = formatTDDV4PRTitle(ready.slug, 1, TDD_V4_CONFIG.MAX_TIERS)

    yield* git.checkout('main')
    yield* git.fetch()

    const branchExisted = yield* git.branchExists(branch)
    yield* git.deleteBranch(branch).pipe(Effect.catchAll(() => Effect.void))
    yield* git.createBranch(branch)

    const activatedCount = yield* activateAllFixmeSpecs(ready.path)
    yield* Console.error(`   Activated ${activatedCount} fixme spec(s) in ${ready.path}`)

    yield* git.stageFile(ready.path)
    yield* git.commit(`test: activate fixme specs in ${ready.slug} (V4)`)
    yield* git.push(branch, { force: branchExisted })

    const body = `## V4 TDD Automation — File-Level Pipeline

**Spec file**: \`${ready.path}\`
**Slug**: \`${ready.slug}\`
**Fixme specs to implement**: ${ready.fixmeSpecCount}
**Active specs already passing**: ${ready.activeSpecCount}
**Has @regression**: ${ready.hasRegression ? 'yes (will be regenerated)' : 'no (will be added)'}

### Spec IDs in this file

${ready.fixmeSpecIds.map((id) => `- \`${id}\``).join('\n')}

---

This PR was created by the V4 (file-level) TDD automation pipeline. See
[\`docs/development/tdd-automation-pipeline-v4.md\`](../docs/development/tdd-automation-pipeline-v4.md).

### Attempt tracking

- Tier 1 (Sonnet 4.6): ~$25 budget, all specs + regression regen
- Tier 2 (Opus 4.7): ~$60 budget, **stragglers only** if Tier 1 leaves any
- Hard kill: $85 cumulative across both tiers
- Lifetime partial-merge cap: 3 cycles per file

### What V4 Claude Code will do

For each fixme spec in source order:
1. Read GIVEN/WHEN/THEN, locate implementation file(s)
2. Implement the smallest change that makes the spec pass
3. Run \`bunx playwright test "${ready.path}" -g "<SPEC-ID>"\`
4. If green, commit \`feat: implement <SPEC-ID>\`; if red, leave the .fixme and move on
5. After all specs, regenerate the file's @regression test and commit separately
`

    const pr = yield* forgejo.createPR({
      title,
      body,
      branch,
      base: 'main',
      labels: [TDD_V4_LABELS.AUTOMATION],
    })

    return {
      prNumber: pr.number,
      branch,
      title,
    }
  })

const main = Effect.gen(function* () {
  yield* Console.error('🚀 V4 PR Creator — starting orchestration')
  yield* Console.error('')

  yield* Console.error('── Step 1: credit limits ──')
  const credits = yield* checkCreditLimits
  for (const warning of credits.warnings) {
    yield* Console.error(`   ⚠️  ${warning}`)
  }
  if (!credits.canProceed) {
    return yield* outputNoop('Credits exhausted')
  }
  yield* Console.error('   ✅ Credits available')
  yield* Console.error('')

  yield* Console.error('── Step 2: find next ready file ──')
  const ready = yield* findReadyFile()
  if (!ready) {
    return yield* outputNoop('No ready file (all in-flight, capped, or zero remaining)')
  }
  yield* Console.error('')

  yield* Console.error('── Step 3: create V4 branch + PR ──')
  const created = yield* createV4PR(ready)
  yield* Console.error(`   ✅ PR created: #${created.prNumber}`)
  yield* Console.error(`      Branch: ${created.branch}`)
  yield* Console.error(`      Title: ${created.title}`)
  yield* Console.error('')

  const result: V4PRCreatorOutput = {
    prCreated: true,
    prNumber: String(created.prNumber),
    slug: ready.slug,
    filePath: ready.path,
    branch: created.branch,
    fixmeSpecCount: ready.fixmeSpecCount,
    hasRegression: ready.hasRegression,
  }
  yield* Console.error('🎉 V4 PR Creator complete')
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
      yield* Console.error(`::error::V4 PR Creator failed (${tag}): ${errorMsg}`)
      yield* Console.log(
        JSON.stringify({
          prCreated: false,
          prNumber: '',
          slug: '',
          filePath: '',
          branch: '',
          fixmeSpecCount: 0,
          hasRegression: false,
          error: `${tag}: ${errorMsg}`,
        })
      )
    })
  ),
  Effect.provide(Layer.mergeAll(LiveLayer, FileSystemServiceLive, LoggerServiceLive()))
)

Effect.runPromise(main).catch((error) => {
  console.error(`::error::Unhandled error in V4 PR Creator: ${error}`)
  console.log(
    JSON.stringify({
      prCreated: false,
      prNumber: '',
      slug: '',
      filePath: '',
      branch: '',
      fixmeSpecCount: 0,
      hasRegression: false,
      error: String(error),
    })
  )
})
