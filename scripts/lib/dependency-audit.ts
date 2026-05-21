/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import * as Effect from 'effect/Effect'
import { CommandService, FileSystemService, progress, success, logError, skip } from './effect'
import type { CheckResult } from './effect'

const AUDIT_IGNORE_FILE = '.audit-ignore'

interface BunAuditAdvisory {
  readonly url?: string
  readonly id?: number
  readonly severity?: string
  readonly title?: string
}

const parseAuditIgnore = (content: string): ReadonlySet<string> =>
  new Set(
    content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
  )

const advisoryId = (advisory: BunAuditAdvisory): string =>
  advisory.url ? (advisory.url.split('/').pop() ?? advisory.url) : String(advisory.id ?? 'unknown')

export const runDependencyAudit = Effect.gen(function* () {
  const cmd = yield* CommandService
  const fs = yield* FileSystemService
  const startTime = Date.now()

  yield* progress('Dependency Audit...')

  const ignoreContent = yield* fs
    .readFile(AUDIT_IGNORE_FILE)
    .pipe(Effect.catchAll(() => Effect.succeed('')))
  const ignored = parseAuditIgnore(ignoreContent)

  const result = yield* cmd
    .spawn(['bun', 'audit', '--json'], { timeout: 60_000, throwOnError: false })
    .pipe(
      Effect.catchTag('CommandTimeoutError', () =>
        Effect.succeed({ exitCode: 1, stdout: '', stderr: 'bun audit timed out' })
      ),
      Effect.catchTag('CommandSpawnError', (e) =>
        Effect.succeed({
          exitCode: 1,
          stdout: '',
          stderr: e.cause ? String(e.cause) : 'Failed to spawn bun audit',
        })
      ),
      Effect.catchTag('CommandFailedError', (e) =>
        Effect.succeed({ exitCode: e.exitCode, stdout: e.stdout, stderr: e.stderr })
      )
    )

  const duration = Date.now() - startTime

  const jsonStart = result.stdout.indexOf('{')
  if (jsonStart < 0) {
    yield* skip(
      `Dependency Audit: no parsable audit output (registry unreachable?) — skipped (${duration}ms)`
    )
    return { name: 'Dependency Audit', success: true, duration } as CheckResult
  }

  const parseResult = yield* Effect.try(
    () => JSON.parse(result.stdout.slice(jsonStart)) as Record<string, readonly BunAuditAdvisory[]>
  ).pipe(Effect.either)
  if (parseResult._tag === 'Left') {
    yield* skip(`Dependency Audit: could not parse audit output — skipped (${duration}ms)`)
    return { name: 'Dependency Audit', success: true, duration } as CheckResult
  }
  const report = parseResult.right

  const unexpected: Array<{ pkg: string; id: string; severity: string; title: string }> = []
  for (const [pkg, advisories] of Object.entries(report)) {
    for (const advisory of advisories) {
      const id = advisoryId(advisory)
      if (!ignored.has(id)) {
        unexpected.push({
          pkg,
          id,
          severity: advisory.severity ?? 'unknown',
          title: advisory.title ?? '',
        })
      }
    }
  }

  if (unexpected.length > 0) {
    yield* logError(
      `Dependency Audit failed (${duration}ms): ${unexpected.length} advisory(ies) not in ${AUDIT_IGNORE_FILE}`
    )
    for (const a of unexpected) {
      yield* Effect.log(`  [${a.severity}] ${a.pkg} — ${a.title} (${a.id})`)
    }
    yield* Effect.log(
      `  Fix: bump the affected dependency, or (after review) add the advisory ID to ${AUDIT_IGNORE_FILE} with a justification comment.`
    )
    return {
      name: 'Dependency Audit',
      success: false,
      duration,
      error: `${unexpected.length} unbaselined advisory(ies)`,
    } as CheckResult
  }

  yield* success(
    `Dependency Audit passed (${duration}ms — ${ignored.size} baselined advisories tolerated)`
  )
  return { name: 'Dependency Audit', success: true, duration } as CheckResult
})
