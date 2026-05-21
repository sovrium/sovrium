/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Console } from 'effect'

interface ChangeTypeResult {
  readonly isTestOnly: boolean
  readonly targetSpec: string
  readonly isTDDAutomation: boolean
  readonly changedFiles: readonly string[]
  readonly significantChanges: number
  readonly isFixmeRemovalOnly: boolean
}

export function parseTDDCommitMessage(message: string): { readonly specId: string } | null {
  const match = message.match(/^\[TDD\]\s+Implement\s+(\S+)/)
  if (match && match[1]) {
    return { specId: match[1] }
  }
  return null
}

export async function findSpecFileBySpecId(specId: string): Promise<string> {
  const proc = Bun.spawn(
    [
      'sh',
      '-c',
      `grep -rl ${JSON.stringify(specId)} specs/ --include="*.spec.ts" 2>/dev/null | head -1`,
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  )
  const stdout = await new Response(proc.stdout).text()
  await proc.exited
  return stdout.trim()
}

function execCommand(command: string): Effect.Effect<string, Error> {
  return Effect.tryPromise({
    try: async () => {
      const proc = Bun.spawn(['sh', '-c', command], {
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const stdout = await new Response(proc.stdout).text()
      const exitCode = await proc.exited
      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text()
        throw new Error(`Command failed: ${command}\n${stderr}`)
      }
      return stdout.trim()
    },
    catch: (error) => new Error(`Failed to execute command: ${error}`),
  })
}

function extractTargetSpecFromPRBody(prBody: string): string {
  const fileMatch = prBody.match(/\*\*File\*\*:\s*`([^:`]+\.spec\.ts)/)
  if (fileMatch && fileMatch[1]) {
    return fileMatch[1]
  }

  const testFileMatch = prBody.match(/\*\*(?:Test File)\*\*:\s*`([^`]+\.spec\.ts)`/)
  if (testFileMatch && testFileMatch[1]) {
    return testFileMatch[1]
  }

  const specMatch = prBody.match(/specs\/[^\s:)`]+\.spec\.ts/)
  if (specMatch && specMatch[0]) {
    return specMatch[0]
  }

  return ''
}

function buildDiffRange(baseRef: string): string {
  if (baseRef.startsWith('HEAD')) {
    return `${baseRef}..HEAD`
  }
  return `origin/${baseRef}...HEAD`
}

function getChangedFiles(baseRef: string): Effect.Effect<readonly string[], never> {
  return execCommand(`git diff --name-only ${buildDiffRange(baseRef)}`).pipe(
    Effect.map((output) =>
      output
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    ),
    Effect.catchAll(() => Effect.succeed([] as readonly string[]))
  )
}

function countSignificantChanges(baseRef: string): Effect.Effect<number, never> {
  return Effect.gen(function* () {
    const diffOutput = yield* execCommand(`git diff ${buildDiffRange(baseRef)} -- specs/`).pipe(
      Effect.catchAll(() => Effect.succeed(''))
    )

    if (!diffOutput) {
      return 0
    }

    const lines = diffOutput.split('\n')
    let significantCount = 0

    for (const line of lines) {
      if (!line.startsWith('+') && !line.startsWith('-')) {
        continue
      }

      if (line.startsWith('+++') || line.startsWith('---')) {
        continue
      }

      if (line.slice(1).trim() === '') {
        continue
      }

      if (line.startsWith('-') && (line.includes('.fixme(') || line.includes('.skip('))) {
        continue
      }

      if (line.startsWith('+') && !line.includes('.fixme(') && !line.includes('.skip(')) {
        const cleanedLine = line.slice(1).trim()

        const withFixme = cleanedLine.replace(/^test\(/, 'test.fixme(')
        const withSkip = cleanedLine.replace(/^test\(/, 'test.skip(')

        const deletionLineFixme = `-  ${withFixme}`
        const deletionLineSkip = `-  ${withSkip}`

        if (diffOutput.includes(deletionLineFixme) || diffOutput.includes(deletionLineSkip)) {
          continue
        }
      }

      if (line.startsWith('+') && (line.includes('.fixme(') || line.includes('.skip('))) {
        continue
      }

      significantCount++
    }

    return significantCount
  })
}

async function readPRBody(): Promise<string> {
  const prBodyFile = process.env['PR_BODY_FILE']
  if (prBodyFile) {
    try {
      const file = Bun.file(prBodyFile)
      if (await file.exists()) {
        return await file.text()
      }
    } catch {
    }
  }
  return process.env['PR_BODY'] ?? ''
}

const main = Effect.gen(function* () {
  const baseRef = process.env['BASE_REF'] ?? 'main'
  const hasTDDLabel = process.env['HAS_TDD_LABEL'] === 'true'
  const headCommitMessage = process.env['HEAD_COMMIT_MESSAGE'] ?? ''
  const prBody = yield* Effect.promise(readPRBody)

  let isTDDAutomation = false
  let targetSpec = ''
  let isTestOnly = false
  let isFixmeRemovalOnly = false

  if (hasTDDLabel) {
    isTDDAutomation = true
    yield* Console.error('🤖 TDD automation PR detected')

    targetSpec = extractTargetSpecFromPRBody(prBody)
    if (targetSpec) {
      yield* Console.error(`🎯 Target spec from PR body: ${targetSpec}`)
    } else {
      yield* Console.error('⚠️  Could not extract target spec from PR body')
    }
  } else if (baseRef.startsWith('HEAD') && headCommitMessage) {
    const parsed = parseTDDCommitMessage(headCommitMessage)
    if (parsed) {
      const specFile = yield* Effect.promise(() => findSpecFileBySpecId(parsed.specId))
      if (specFile) {
        isTDDAutomation = true
        targetSpec = specFile
        yield* Console.error(`🤖 TDD merge detected on push (spec ${parsed.specId} → ${specFile})`)
      } else {
        yield* Console.error(
          `⚠️  TDD merge detected (spec ${parsed.specId}) but no spec file found via grep — falling through to non-TDD path`
        )
      }
    }
  }

  const changedFiles = yield* getChangedFiles(baseRef)
  yield* Console.error(`🔍 Changed files: ${changedFiles.length}`)

  const nonSpecFiles = changedFiles.filter((file) => !file.startsWith('specs/'))

  if (nonSpecFiles.length === 0 && changedFiles.length > 0) {
    yield* Console.error('✅ Only spec files changed')

    const significantChanges = yield* countSignificantChanges(baseRef)
    yield* Console.error(`📊 Significant changes: ${significantChanges} lines`)

    if (significantChanges === 0) {
      isTestOnly = true
      isFixmeRemovalOnly = true
      yield* Console.error('✅ Pure .fixme() removal detected (typecheck can be skipped)')
    } else if (significantChanges < 10) {
      isTestOnly = true
      yield* Console.error('✅ Test-only change detected (primarily .fixme() removal)')
    } else {
      yield* Console.error('ℹ️ Spec files changed with significant modifications')
    }
  } else if (nonSpecFiles.length > 0) {
    yield* Console.error(`ℹ️ Non-spec files changed: ${nonSpecFiles.slice(0, 10).join(', ')}`)
  }

  const result: ChangeTypeResult = {
    isTestOnly,
    targetSpec,
    isTDDAutomation,
    changedFiles,
    significantChanges: isTestOnly ? 0 : changedFiles.length,
    isFixmeRemovalOnly,
  }

  yield* Console.error('')
  yield* Console.error('📋 Detection Results:')
  yield* Console.error(`  is_test_only=${isTestOnly}`)
  yield* Console.error(`  target_spec=${targetSpec}`)
  yield* Console.error(`  is_tdd_automation=${isTDDAutomation}`)
  yield* Console.error(`  is_fixme_removal_only=${isFixmeRemovalOnly}`)

  yield* Console.log(JSON.stringify(result))
})

if (import.meta.main) {
  Effect.runPromise(main).catch((error) => {
    console.error(`::error::${error}`)
    console.log(
      JSON.stringify({
        isTestOnly: false,
        targetSpec: '',
        isTDDAutomation: false,
        changedFiles: [],
        significantChanges: 0,
        isFixmeRemovalOnly: false,
        error: String(error),
      })
    )
  })
}
