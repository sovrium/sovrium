/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Console, Effect } from 'effect'


export interface StartupPhase {
  readonly label: string
  readonly detail?: string
  readonly type: 'success' | 'warning' | 'skip'
}

export interface BootstrapTokenBanner {
  readonly plaintext: string
  readonly claimEndpoint: string
  readonly expiresInMinutes: number
}

export interface StartupSummary {
  readonly version: string
  readonly phases: readonly StartupPhase[]
  readonly url: string
  readonly durationMs: number
  readonly bootstrapToken?: BootstrapTokenBanner
}

export const formatDuration = (ms: number): string =>
  ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`

export const renderStartupSummary = (summary: StartupSummary): Effect.Effect<void> =>
  renderSummary({
    version: summary.version,
    phases: summary.phases,
    footer: summary.url,
    ...(summary.bootstrapToken ? { bootstrapToken: summary.bootstrapToken } : {}),
  })

const renderSummary = (params: {
  readonly version: string
  readonly phases: readonly StartupPhase[]
  readonly footer: string
  readonly bootstrapToken?: BootstrapTokenBanner
}): Effect.Effect<void> =>
  Effect.gen(function* () {
    const warnings = params.phases.filter((p) => p.type === 'warning')
    const successes = params.phases.filter((p) => p.type === 'success')

    yield* Console.log('')
    yield* Console.log(`  Sovrium v${params.version}`)

    if (warnings.length > 0) {
      yield* Console.log('')
      yield* Effect.forEach(warnings, (phase) => Console.log(`  ⚠ ${phase.label}`))
    }

    if (successes.length > 0) {
      yield* Console.log('')
      yield* Effect.forEach(successes, (phase) => Console.log(`  ✓ ${phase.label}`))
    }

    yield* Console.log('')
    yield* Console.log(`  → ${params.footer}`)

    if (params.bootstrapToken) {
      yield* Console.log(`  → First-admin token (POST ${params.bootstrapToken.claimEndpoint}):`)
      yield* Console.log(`    ${params.bootstrapToken.plaintext}`)
    }
    yield* Console.log('')
  })

export interface BuildSummary {
  readonly version: string
  readonly phases: readonly StartupPhase[]
  readonly outputDir: string
}

export const renderBuildSummary = (summary: BuildSummary): Effect.Effect<void> =>
  renderSummary({ version: summary.version, phases: summary.phases, footer: summary.outputDir })
