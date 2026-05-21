/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { spawnSync } from 'node:child_process'
import { Console, Effect } from 'effect'
import { forgejoFetch, getForgejoConfig } from '../services/vcs-api'
import { TDD_LABELS, TDD_V4_CONFIG, TDD_V4_LABELS } from './config'
import { ForgejoApiError } from './errors'
import { scanForSpecFiles } from './file-scanner'
import { extractSpecId } from './spec-scanner'

export interface ReadyFile {
  readonly path: string
  readonly slug: string
  readonly fixmeSpecCount: number
  readonly activeSpecCount: number
  readonly hasRegression: boolean
  readonly priority: number
  readonly fixmeSpecIds: readonly string[]
}

interface ForgejoLitePR {
  readonly number: number
  readonly title: string
  readonly headRef: string
  readonly labelNames: readonly string[]
}

const fetchOpenPRsByLabel = (labelName: string): Effect.Effect<readonly ForgejoLitePR[], never> =>
  Effect.tryPromise({
    try: async () => {
      const { owner, repo } = getForgejoConfig()

      const repoLabels = await forgejoFetch<Array<{ id: number; name: string }>>(
        `/repos/${owner}/${repo}/labels?limit=50`
      )
      const targetLabel = repoLabels.find((l) => l.name === labelName)
      if (!targetLabel) return [] as ForgejoLitePR[]

      const prs = await forgejoFetch<
        Array<{
          number: number
          title: string
          head: { ref: string }
          labels: Array<{ name: string }>
        }>
      >(`/repos/${owner}/${repo}/pulls?state=open&labels=${targetLabel.id}&limit=50`)

      return prs.map((pr) => ({
        number: pr.number,
        title: pr.title,
        headRef: pr.head.ref,
        labelNames: pr.labels.map((l) => l.name),
      }))
    },
    catch: (cause) => new ForgejoApiError({ operation: 'fetchOpenPRsByLabel', cause }),
  }).pipe(Effect.catchAll(() => Effect.succeed([] as readonly ForgejoLitePR[])))

export const countLifetimePartialMergeCycles = (slug: string): number => {
  try {
    const result = spawnSync(
      'git',
      [
        'log',
        '--grep',
        `tdd-v4:partial-merge.*${slug}`,
        '--extended-regexp',
        '--pretty=format:%H',
        'main',
      ],
      { encoding: 'utf-8' }
    )
    if (result.status !== 0) return 0
    const lines = result.stdout.split('\n').filter((l) => l.trim().length > 0)
    return lines.length
  } catch {
    return 0
  }
}

export const findReadyFile = () =>
  Effect.gen(function* () {
    yield* Console.error('🔍 V4 find-ready-file: scanning + applying filters...')
    yield* Console.error('')

    const openV4PRs = yield* fetchOpenPRsByLabel(TDD_V4_LABELS.AUTOMATION)
    const activeV4PRs = openV4PRs.filter(
      (pr) => !pr.labelNames.includes(TDD_V4_LABELS.MANUAL_INTERVENTION)
    )

    if (activeV4PRs.length >= TDD_V4_CONFIG.MAX_CONCURRENT) {
      const active = activeV4PRs[0]!
      yield* Console.error(
        `⏳ V4 concurrency cap reached (${activeV4PRs.length}/${TDD_V4_CONFIG.MAX_CONCURRENT}): PR #${active.number} (${active.headRef})`
      )
      return null as ReadyFile | null
    }

    const v4InFlightSlugs = new Set(
      openV4PRs
        .map((pr) => {
          const m = pr.headRef.match(/^tdd-v4\/(.+)$/i)
          return m?.[1]?.toLowerCase() ?? null
        })
        .filter((s): s is string => s !== null)
    )

    const openV3PRs = yield* fetchOpenPRsByLabel(TDD_LABELS.AUTOMATION)
    const v3InFlightSpecIds = new Set(
      openV3PRs
        .map((pr) => {
          const m = pr.title.match(/^\[TDD\]\s+Implement\s+([A-Z]+-[A-Z-]+-(?:\d{3}|REGRESSION))/i)
          return m?.[1]?.toUpperCase() ?? null
        })
        .filter((s): s is string => s !== null)
    )

    const scan = yield* scanForSpecFiles

    if (scan.files.length === 0) {
      yield* Console.error('✅ V4: no spec files with .fixme() patterns remain')
      return null as ReadyFile | null
    }
    yield* Console.error(`   Scanner returned ${scan.files.length} eligible file(s)`)

    const eligible = scan.files.filter((f) => {
      if (v4InFlightSlugs.has(f.slug)) return false
      if (countLifetimePartialMergeCycles(f.slug) >= TDD_V4_CONFIG.MAX_PARTIAL_MERGE_CYCLES) {
        return false
      }
      if (f.fixmeSpecs.some((s) => v3InFlightSpecIds.has(s.specId))) return false
      if (f.fixmeSpecs.length === 0) return false
      return true
    })

    if (eligible.length === 0) {
      yield* Console.error(
        '⏳ All eligible files are either in-flight, lifetime-capped, or held by an open V3 PR.'
      )
      return null as ReadyFile | null
    }

    const head = eligible[0]!
    yield* Console.error('')
    yield* Console.error('✅ V4: next file to process:')
    yield* Console.error(`   Path: ${head.path}`)
    yield* Console.error(`   Slug: ${head.slug}`)
    yield* Console.error(`   .fixme() count: ${head.fixmeSpecs.length}`)
    yield* Console.error(`   Active count: ${head.activeSpecs.length}`)
    yield* Console.error(`   hasRegression: ${head.hasRegression}`)
    yield* Console.error(`   priority: ${head.priority}`)

    return {
      path: head.path,
      slug: head.slug,
      fixmeSpecCount: head.fixmeSpecs.length,
      activeSpecCount: head.activeSpecs.length,
      hasRegression: head.hasRegression,
      priority: head.priority,
      fixmeSpecIds: head.fixmeSpecs.map((s) => s.specId),
    } satisfies ReadyFile
  })

export { extractSpecId }
