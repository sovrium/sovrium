/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Console, Effect, Layer } from 'effect'
import { FileSystemService, FileSystemServiceLive } from '../../lib/effect'
import { ForgejoApi, ForgejoApiLive } from '../services/vcs-api'
import type { ExecutionReport } from '../workflows/post-test-v4/partial-merge'

export type DryRunScenario = 'happy' | 'straggler' | 'total-failure' | 'regression-fail'

const SCENARIO_VALUES: ReadonlySet<DryRunScenario> = new Set([
  'happy',
  'straggler',
  'total-failure',
  'regression-fail',
])

export function buildSyntheticReport(params: {
  readonly scenario: DryRunScenario
  readonly tier: 1 | 2
  readonly fixmeSpecIds: readonly string[]
  readonly cost: number
  readonly durationMin: number
}): ExecutionReport {
  const { scenario, fixmeSpecIds, cost, durationMin } = params

  if (fixmeSpecIds.length === 0) {
    return {
      specsFlipped: [],
      stragglers: [],
      regressionStatus: 'skipped',
      totalCost: cost,
      totalDuration: durationMin,
    }
  }

  switch (scenario) {
    case 'happy':
      return {
        specsFlipped: fixmeSpecIds,
        stragglers: [],
        regressionStatus: 'regenerated',
        totalCost: cost,
        totalDuration: durationMin,
      }
    case 'straggler': {
      const flipped = fixmeSpecIds.slice(0, fixmeSpecIds.length - 1)
      const stragglers = fixmeSpecIds.slice(fixmeSpecIds.length - 1)
      return {
        specsFlipped: flipped,
        stragglers,
        regressionStatus: 'regenerated',
        totalCost: cost,
        totalDuration: durationMin,
      }
    }
    case 'total-failure':
      return {
        specsFlipped: [],
        stragglers: fixmeSpecIds,
        regressionStatus: 'skipped',
        totalCost: cost,
        totalDuration: durationMin,
      }
    case 'regression-fail':
      return {
        specsFlipped: fixmeSpecIds,
        stragglers: [],
        regressionStatus: 'failed',
        totalCost: cost,
        totalDuration: durationMin,
      }
    default: {
      const _exhaustive: never = scenario
      throw new Error(`Unknown scenario: ${String(_exhaustive)}`)
    }
  }
}

export function formatReportComment(report: ExecutionReport, tier: 1 | 2): string {
  const lines = [
    `## V4 Claude Code Execution Report (dry-run, Tier ${tier})`,
    '',
    '> :information_source: This report was produced by the V4 dry-run harness',
    '> (`TDD_V4_DRY_RUN=true`). No Claude budget was spent.',
    '',
    `- Specs implemented (passed): ${report.specsFlipped.length}`,
    ...(report.specsFlipped.length > 0
      ? report.specsFlipped.map((id) => `  - \`${id}\``)
      : ['  - (none)']),
    `- Specs left as .fixme (failed): ${report.stragglers.length}`,
    ...(report.stragglers.length > 0
      ? report.stragglers.map((id) => `  - \`${id}\``)
      : ['  - (none)']),
    `- Regression test status: \`${report.regressionStatus}\``,
    `- Total cost: $${report.totalCost.toFixed(2)}`,
    `- Total duration: ${report.totalDuration} min`,
    `- Stragglers needing Opus retry: ${report.stragglers.length > 0 ? report.stragglers.map((id) => `\`${id}\``).join(', ') : 'none'}`,
  ]
  return lines.join('\n')
}

export function parseScenarioEnv(value: string | undefined): DryRunScenario {
  if (!value) return 'happy'
  const normalized = value.trim().toLowerCase() as DryRunScenario
  if (SCENARIO_VALUES.has(normalized)) return normalized
  return 'happy'
}

function defaultCostForTier(tier: 1 | 2): number {
  return tier === 1 ? 14 : 18
}

const SPEC_ID_REGEX = /\b([A-Z]+(?:-[A-Z]+)+-(?:\d{3,}|REGRESSION))\b/

const TEST_OPEN_LINE_REGEX = /\b(?:test|it)(?:\.fixme)?\s*\(/

export const enumerateSpecIdsFromFile = (
  filePath: string
): Effect.Effect<readonly string[], never, FileSystemService> =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService
    const content = yield* fs.readFile(filePath).pipe(Effect.catchAll(() => Effect.succeed('')))
    if (content.length === 0) return []
    const lines = content.split('\n')
    const seen = new Set<string>()
    const out: string[] = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line || !TEST_OPEN_LINE_REGEX.test(line)) continue
      for (let j = i; j < Math.min(i + 4, lines.length); j++) {
        const candidate = lines[j]
        if (!candidate) continue
        const match = SPEC_ID_REGEX.exec(candidate)
        if (match?.[1]) {
          const id = match[1]
          if (!id.endsWith('-REGRESSION') && !seen.has(id)) {
            seen.add(id)
            out.push(id)
          }
          break
        }
      }
    }
    return out
  })

function defaultDurationForTier(tier: 1 | 2): number {
  return tier === 1 ? 35 : 12
}

const main = Effect.gen(function* () {
  const prNumberStr = process.env['PR_NUMBER']
  const specFile = process.env['SPEC_FILE']
  const tierStr = process.env['TIER'] ?? '1'
  const stragglerCsv = process.env['STRAGGLER_SPEC_IDS'] ?? ''

  if (!prNumberStr || !specFile) {
    yield* Console.error('::error::run-claude-v4-dry-run requires PR_NUMBER and SPEC_FILE env vars')
    process.exit(1)
  }

  const prNumber = parseInt(prNumberStr, 10)
  if (Number.isNaN(prNumber)) {
    yield* Console.error(`::error::PR_NUMBER is not a number: ${prNumberStr}`)
    process.exit(1)
  }

  const tier = (tierStr === '2' ? 2 : 1) as 1 | 2
  const scenario = parseScenarioEnv(process.env['TDD_V4_DRY_RUN_SCENARIO'])
  const cost = Number(process.env['TDD_V4_DRY_RUN_COST_USD'] ?? defaultCostForTier(tier))
  const duration = Number(
    process.env['TDD_V4_DRY_RUN_DURATION_MIN'] ?? defaultDurationForTier(tier)
  )

  yield* Console.error(
    `🧪 V4 dry-run: PR #${prNumber}, file=${specFile}, tier=${tier}, scenario=${scenario}, cost=$${cost}, duration=${duration} min`
  )

  let fixmeIds: readonly string[]
  if (tier === 2 && stragglerCsv.trim().length > 0) {
    fixmeIds = stragglerCsv
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    yield* Console.error(`   Tier 2: using ${fixmeIds.length} straggler(s) from env`)
  } else {
    fixmeIds = yield* enumerateSpecIdsFromFile(specFile)
    yield* Console.error(
      `   Tier 1: enumerated ${fixmeIds.length} spec ID(s) from ${specFile} (regression specs excluded)`
    )
  }

  const report = buildSyntheticReport({
    scenario,
    tier,
    fixmeSpecIds: fixmeIds,
    cost,
    durationMin: duration,
  })
  const body = formatReportComment(report, tier)

  yield* Console.log(body)

  const forgejo = yield* ForgejoApi
  yield* forgejo
    .postComment(prNumber, body)
    .pipe(
      Effect.catchAll((error) =>
        Console.error(`::warning::Failed to post dry-run comment: ${String(error)}`)
      )
    )

  yield* Console.error('✅ V4 dry-run completed')
}).pipe(Effect.provide(Layer.mergeAll(ForgejoApiLive, FileSystemServiceLive)))

if (import.meta.main) {
  Effect.runPromise(main).catch((error) => {
    console.error(`::error::Unhandled error in run-claude-v4-dry-run: ${error}`)
    process.exit(1)
  })
}
