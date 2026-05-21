/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Console, Effect, Layer } from 'effect'
import { TDD_LABELS } from '../core/config'
import { ForgejoApi, ForgejoApiLive, forgejoFetch, getForgejoConfig } from '../services/vcs-api'

const STALE_THRESHOLD_MS: number = (() => {
  const raw = process.env['TDD_STALE_THRESHOLD_MS']
  if (!raw) return 2 * 60 * 60 * 1000
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2 * 60 * 60 * 1000
})()

interface RawPRDetails {
  readonly number: number
  readonly draft: boolean
  readonly headSha: string
  readonly updatedAt: string
}

const getRawPRDetails = (prNumber: number) =>
  Effect.tryPromise({
    try: async (): Promise<RawPRDetails> => {
      const { owner, repo } = getForgejoConfig()
      const pr = await forgejoFetch<{
        number: number
        draft?: boolean
        head: { sha: string }
        updated_at: string
      }>(`/repos/${owner}/${repo}/pulls/${prNumber}`)
      return {
        number: pr.number,
        draft: Boolean(pr.draft),
        headSha: pr.head.sha,
        updatedAt: pr.updated_at,
      }
    },
    catch: (error) => new Error(`getRawPRDetails #${prNumber}: ${String(error)}`),
  })

const getHeadCommitDate = (sha: string) =>
  Effect.tryPromise({
    try: async (): Promise<Date | null> => {
      const { owner, repo } = getForgejoConfig()
      const commit = await forgejoFetch<{
        commit?: { committer?: { date?: string }; author?: { date?: string } }
      }>(`/repos/${owner}/${repo}/git/commits/${sha}`)
      const dateStr = commit.commit?.committer?.date ?? commit.commit?.author?.date
      return dateStr ? new Date(dateStr) : null
    },
    catch: () => null,
  }).pipe(Effect.catchAll(() => Effect.succeed(null)))

const hasActiveWorkflowRun = (sha: string) =>
  Effect.tryPromise({
    try: async (): Promise<boolean> => {
      const { owner, repo } = getForgejoConfig()
      const data = await forgejoFetch<{
        workflow_runs?: Array<{ status?: string }>
      }>(`/repos/${owner}/${repo}/actions/runs?head_sha=${sha}&limit=50`)
      const runs = data.workflow_runs ?? []
      return runs.some((run) => {
        const s = (run.status ?? '').toLowerCase()
        return s === 'running' || s === 'queued' || s === 'waiting' || s === 'in_progress'
      })
    },
    catch: (error) => new Error(`hasActiveWorkflowRun ${sha}: ${String(error)}`),
  }).pipe(Effect.catchAll(() => Effect.succeed(true)))

const hasActiveClaudeCodeRun = (prNumber: number) =>
  Effect.tryPromise({
    try: async (): Promise<boolean> => {
      const { owner, repo } = getForgejoConfig()
      const data = await forgejoFetch<{
        workflow_runs?: Array<{ status?: string; display_title?: string; event?: string }>
      }>(`/repos/${owner}/${repo}/actions/runs?workflow=tdd-claude-code.yml&limit=50`)
      const runs = data.workflow_runs ?? []
      return runs.some((run) => {
        const s = (run.status ?? '').toLowerCase()
        const active = s === 'running' || s === 'queued' || s === 'waiting' || s === 'in_progress'
        if (!active) return false
        const title = run.display_title ?? ''
        return title.includes(String(prNumber)) || title === ''
      })
    },
    catch: (error) => new Error(`hasActiveClaudeCodeRun ${prNumber}: ${String(error)}`),
  }).pipe(Effect.catchAll(() => Effect.succeed(true)))

const removeLabelByName = (prNumber: number, labelName: string) =>
  Effect.tryPromise({
    try: async (): Promise<'removed' | 'not-found' | 'not-on-pr'> => {
      const { owner, repo } = getForgejoConfig()

      const labels = await forgejoFetch<Array<{ id: number; name: string }>>(
        `/repos/${owner}/${repo}/labels?limit=50`
      )
      const match = labels.find((l) => l.name === labelName)
      if (!match) return 'not-found'

      try {
        await forgejoFetch(`/repos/${owner}/${repo}/issues/${prNumber}/labels/${match.id}`, {
          method: 'DELETE',
        })
        return 'removed'
      } catch (err) {
        const msg = String(err)
        if (msg.includes('404')) return 'not-on-pr'
        throw err
      }
    },
    catch: (error) => new Error(`removeLabelByName #${prNumber} ${labelName}: ${String(error)}`),
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Console.error(
          `::warning::[CLAUDE-RUNNING-GUARD] #${prNumber} removeLabel failed: ${error.message}`
        )
        return 'not-found' as const
      })
    )
  )

function buildRecoveryComment(params: {
  readonly headSha: string
  readonly lastCommitAt: Date
  readonly thresholdMs: number
}): string {
  const ageHours = (Date.now() - params.lastCommitAt.getTime()) / (1000 * 60 * 60)
  const thresholdHours = params.thresholdMs / (1000 * 60 * 60)

  return [
    '## 🚧 Stuck PR Recovery — Auto-labeled for Manual Intervention',
    '',
    'This TDD PR has been automatically labeled with `tdd-automation:manual-intervention` by the Stuck PR Recovery pre-flight step in `tdd-pr-creator.yml`.',
    '',
    '### Why this PR was flagged',
    '',
    `- **Last commit age**: ~${ageHours.toFixed(1)}h (threshold: ${thresholdHours.toFixed(1)}h)`,
    `- **Head SHA**: \`${params.headSha}\``,
    `- **No active CI**: no workflow run for the head SHA is running/queued/waiting`,
    '',
    '### Two-signal rule',
    '',
    'The pipeline labels a TDD PR as stale only when **both** conditions hold:',
    '',
    `1. The latest commit is older than ${thresholdHours.toFixed(1)} hours`,
    '2. No workflow run for the head SHA is running/queued/waiting',
    '',
    'This prevents false positives: a PR mid-execution is never labeled, and a freshly pushed PR gets the full grace period even if CI has not started yet.',
    '',
    '### Next steps',
    '',
    '- **Fix the underlying issue**, then remove the `tdd-automation:manual-intervention` label to unblock this spec and its file prefix.',
    '- **Or close this PR** if the spec needs to be reworked. The PR Creator will pick a different spec on its next run.',
    '',
    '_Serial processing means one stuck PR blocks every subsequent spec. The Stuck PR Recovery step unblocks the pipeline while preserving this PR for human review._',
    '',
    '<!-- [STATE] [STUCK-PR] [RECOVERY] -->',
  ].join('\n')
}

const recoverPRIfStale = (pr: { number: number; specId: string; labels: readonly string[] }) =>
  Effect.gen(function* () {
    const forgejo = yield* ForgejoApi

    if (pr.labels.includes(TDD_LABELS.MANUAL_INTERVENTION)) {
      yield* Console.error(
        `   ⏭️  [STUCK-PR] #${pr.number} (${pr.specId}) — already has manual-intervention label, skip`
      )
      return { labeled: false }
    }

    const details = yield* getRawPRDetails(pr.number).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Console.error(`::warning::[STUCK-PR] #${pr.number} getPR failed: ${error.message}`)
          return null
        })
      )
    )
    if (!details) return { labeled: false }

    if (details.draft) {
      yield* Console.error(`   ⏭️  [STUCK-PR] #${pr.number} (${pr.specId}) — draft PR, skip`)
      return { labeled: false }
    }

    const commitDate = yield* getHeadCommitDate(details.headSha)
    const lastActivityAt = commitDate ?? new Date(details.updatedAt)
    const ageMs = Date.now() - lastActivityAt.getTime()
    if (ageMs < STALE_THRESHOLD_MS) {
      yield* Console.error(
        `   ⏭️  [STUCK-PR] #${pr.number} (${pr.specId}) — last commit ${(ageMs / 3_600_000).toFixed(2)}h ago < threshold ${(STALE_THRESHOLD_MS / 3_600_000).toFixed(2)}h`
      )
      return { labeled: false }
    }

    const activeCi = yield* hasActiveWorkflowRun(details.headSha)
    if (activeCi) {
      yield* Console.error(
        `   ⏭️  [STUCK-PR] #${pr.number} (${pr.specId}) — active/queued workflow run for head SHA, skip`
      )
      return { labeled: false }
    }

    yield* Console.error(
      `   🚩 [STUCK-PR] #${pr.number} (${pr.specId}) — STALE (age ${(ageMs / 3_600_000).toFixed(2)}h, no active CI) → labeling`
    )

    yield* forgejo
      .addLabel(pr.number, TDD_LABELS.MANUAL_INTERVENTION)
      .pipe(
        Effect.catchTag('ForgejoApiError', (error) =>
          Console.error(
            `::warning::[STUCK-PR] #${pr.number} addLabel failed: ${error.operation} — ${String(error.cause)}`
          )
        )
      )

    const comment = buildRecoveryComment({
      headSha: details.headSha,
      lastCommitAt: lastActivityAt,
      thresholdMs: STALE_THRESHOLD_MS,
    })

    yield* forgejo
      .postComment(pr.number, comment)
      .pipe(
        Effect.catchTag('ForgejoApiError', (error) =>
          Console.error(
            `::warning::[STUCK-PR] #${pr.number} postComment failed: ${error.operation} — ${String(error.cause)}`
          )
        )
      )

    return { labeled: true }
  })

const recoverStaleClaudeRunningLabel = (pr: {
  number: number
  specId: string
  labels: readonly string[]
}) =>
  Effect.gen(function* () {
    if (!pr.labels.includes(TDD_LABELS.CLAUDE_RUNNING)) {
      return { cleared: false }
    }

    const active = yield* hasActiveClaudeCodeRun(pr.number)
    if (active) {
      yield* Console.error(
        `   ⏭️  [CLAUDE-RUNNING-GUARD] #${pr.number} (${pr.specId}) — active Claude run for PR, skip`
      )
      return { cleared: false }
    }

    yield* Console.error(
      `   🧹 [CLAUDE-RUNNING-GUARD] #${pr.number} (${pr.specId}) — STALE claude-running label (no active run) → clearing`
    )
    const result = yield* removeLabelByName(pr.number, TDD_LABELS.CLAUDE_RUNNING)
    if (result === 'removed') {
      yield* Console.error(`   ✅ [CLAUDE-RUNNING-GUARD] #${pr.number} — label removed`)
      return { cleared: true }
    }
    return { cleared: false }
  })

const main = Effect.gen(function* () {
  yield* Console.error('🔎 [STUCK-PR] Stuck PR Recovery — pre-flight scan starting')
  yield* Console.error(`   staleness threshold: ${(STALE_THRESHOLD_MS / 3_600_000).toFixed(2)}h`)

  const forgejo = yield* ForgejoApi

  const prs = yield* forgejo.listTDDPRs('open').pipe(
    Effect.catchTag('ForgejoApiError', (error) =>
      Effect.gen(function* () {
        yield* Console.error(
          `::warning::[STUCK-PR] listTDDPRs failed: ${error.operation} — ${String(error.cause)}`
        )
        return [] as const
      })
    )
  )

  yield* Console.error(`   open TDD PRs: ${prs.length}`)

  let labeledCount = 0
  for (const pr of prs) {
    const result = yield* recoverPRIfStale(pr)
    if (result.labeled) labeledCount++
  }

  yield* Console.error(`✅ [STUCK-PR] Stuck PR Recovery complete — ${labeledCount} PR(s) labeled`)

  yield* Console.error('🔎 [CLAUDE-RUNNING-GUARD] Stale label sweep starting')
  let clearedCount = 0
  for (const pr of prs) {
    const result = yield* recoverStaleClaudeRunningLabel(pr)
    if (result.cleared) clearedCount++
  }
  yield* Console.error(
    `✅ [CLAUDE-RUNNING-GUARD] Stale label sweep complete — ${clearedCount} label(s) cleared`
  )
}).pipe(
  Effect.catchAll((error) =>
    Console.error(`::warning::[STUCK-PR] Unexpected error: ${String(error)}`)
  ),
  Effect.provide(Layer.mergeAll(ForgejoApiLive))
)

Effect.runPromise(main).catch((error) => {
  console.error(`::warning::[STUCK-PR] Unhandled error: ${error}`)
})
