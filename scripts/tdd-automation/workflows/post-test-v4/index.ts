/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Console, Effect, Layer } from 'effect'
import { FileSystemServiceLive, LoggerServiceLive } from '../../../lib/effect'
import { countLifetimePartialMergeCycles } from '../../core/find-ready-file'
import { parseAnyTDDPRTitle } from '../../core/parse-pr-title'
import { LiveLayer } from '../../layers/live'
import { ForgejoApi } from '../../services/vcs-api'
import {
  DEFAULT_HARD_KILL_USD,
  decideNoReportAction,
  decidePostTestAction,
  renderDecisionComment,
  type Action,
  type ExecutionReport,
} from './partial-merge'

interface PostTestOutput {
  readonly action: Action | 'no-op'
  readonly reason: string
  readonly stragglers: string
  readonly comment: string
}

const fail = (reason: string): PostTestOutput => ({
  action: 'no-op',
  reason,
  stragglers: '',
  comment: '',
})

export function pickLatestExecutionReport(
  comments: readonly { readonly body: string }[]
): string | null {
  for (let i = comments.length - 1; i >= 0; i--) {
    const { body } = comments[i]!
    if (body.includes('V4 Claude Code Execution Report')) {
      return body
    }
  }
  return null
}

export function countBootstrapDispatches(comments: readonly { readonly body: string }[]): number {
  let count = 0
  for (const c of comments) {
    if (c.body.includes('V4 Initial Dispatch → Sonnet Tier 1')) count++
  }
  return count
}

export function parseExecutionReport(body: string): ExecutionReport {
  const specsFlipped = extractBulletedIds(body, /Specs implemented \(passed\):\s*\d+/i)
  const stragglers = extractBulletedIds(body, /Specs left as \.fixme \(failed\):\s*\d+/i)

  const regenMatch = body.match(/Regression test status:\s*`?([a-z]+)`?/i)
  const regenStatus = regenMatch?.[1]?.toLowerCase()
  const regressionStatus: ExecutionReport['regressionStatus'] =
    regenStatus === 'regenerated' || regenStatus === 'skipped' || regenStatus === 'failed'
      ? regenStatus
      : 'skipped'

  const costMatch = body.match(/Total cost:\s*\$\s*([0-9]+(?:\.[0-9]+)?)/i)
  const totalCost = costMatch?.[1] ? Number.parseFloat(costMatch[1]) : 0

  const durationMatch = body.match(/Total duration:\s*([0-9]+(?:\.[0-9]+)?)\s*min/i)
  const totalDuration = durationMatch?.[1] ? Number.parseFloat(durationMatch[1]) : 0

  return {
    specsFlipped,
    stragglers,
    regressionStatus,
    totalCost,
    totalDuration,
  }
}

function extractBulletedIds(body: string, headerRegex: RegExp): readonly string[] {
  const lines = body.split('\n')
  const headerIdx = lines.findIndex((line) => headerRegex.test(line))
  if (headerIdx < 0) return []
  const out: string[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (line.length === 0) break
    if (!line.startsWith('-')) {
      if (/^[A-Za-z]/.test(line)) break
      continue
    }
    const after = line.replace(/^-\s*/, '').replace(/[`*]/g, '').trim()
    if (after.length === 0) continue
    if (/^\(none\)$/i.test(after)) continue
    if (/^[A-Z][a-z].*:/.test(after)) break
    const idMatch = after.match(/^([A-Z][A-Z0-9_-]+)$/)
    if (idMatch) out.push(idMatch[1]!)
  }
  return out
}

export function sumCumulativeCost(comments: readonly { readonly body: string }[]): number {
  let sum = 0
  for (const c of comments) {
    const re = /Total cost:\s*\$\s*([0-9]+(?:\.[0-9]+)?)/gi
    let m: RegExpExecArray | null = re.exec(c.body)
    while (m) {
      if (m[1]) sum += Number.parseFloat(m[1])
      m = re.exec(c.body)
    }
  }
  return sum
}

const main = Effect.gen(function* () {
  const prNumberStr = process.env['PR_NUMBER']
  const prTitle = process.env['PR_TITLE']
  const allPassed = process.env['ALL_PASSED'] === 'true'

  if (!prNumberStr || !prTitle) {
    yield* Console.error('::error::V4 post-test requires PR_NUMBER and PR_TITLE env vars')
    yield* Console.log(JSON.stringify(fail('missing-env')))
    return
  }
  const prNumber = Number.parseInt(prNumberStr, 10)
  if (Number.isNaN(prNumber)) {
    yield* Console.error(`::error::PR_NUMBER not a number: ${prNumberStr}`)
    yield* Console.log(JSON.stringify(fail('bad-pr-number')))
    return
  }

  const parsed = parseAnyTDDPRTitle(prTitle)
  if (!parsed || parsed.kind !== 'v4') {
    yield* Console.error(
      `::warning::Title is not V4 format: "${prTitle}" — V4 post-test does nothing`
    )
    yield* Console.log(JSON.stringify(fail('not-v4-title')))
    return
  }

  yield* Console.error(
    `🔍 V4 post-test: PR #${prNumber}, slug=${parsed.slug}, attempt=${parsed.attempt}/${parsed.maxAttempts}, all_passed=${allPassed}`
  )

  const forgejo = yield* ForgejoApi
  const comments = yield* forgejo
    .getPRComments(prNumber)
    .pipe(Effect.catchAll(() => Effect.succeed([] as const)))

  yield* Console.error(`   Loaded ${comments.length} comment(s) from PR`)

  const latestReport = pickLatestExecutionReport(comments)
  if (!latestReport) {
    yield* Console.error(
      'ℹ️  No V4 execution report comment found on PR — entering bootstrap branch.'
    )

    const bootstrapDispatches = countBootstrapDispatches(comments)
    yield* Console.error(`   Prior bootstrap dispatch comments on PR: ${bootstrapDispatches}`)

    if (bootstrapDispatches >= 1) {
      const reason = `Tier 1 was already dispatched ${bootstrapDispatches} time(s) for this PR but no execution report was posted. The Claude run is either still in progress or crashed before posting. Escalating to manual review to avoid burning a duplicate dispatch.`
      yield* Console.error(`::warning::${reason}`)
      yield* Console.log(
        JSON.stringify({
          action: 'manual-intervention',
          reason,
          stragglers: '',
          comment: ['## 🛑 V4 Manual Intervention', '', `**Reason**: ${reason}`].join('\n'),
        })
      )
      return
    }

    const cumulativeCost = sumCumulativeCost(comments)
    const decision = decideNoReportAction({
      pr: {
        kind: 'v4',
        slug: parsed.slug,
        attempt: parsed.attempt,
        maxAttempts: parsed.maxAttempts,
        totalFixmeAtPRCreation: 0,
      },
      budget: { cumulativeCost, hardKillUSD: DEFAULT_HARD_KILL_USD },
    })

    yield* Console.error(`   Decision: ${decision.action} — ${decision.reason}`)

    const bootstrapComment =
      decision.action === 'dispatch-tier-1'
        ? [
            '## 🚀 V4 Initial Dispatch → Sonnet Tier 1',
            '',
            `**Action**: \`dispatch-tier-1\``,
            `**Reason**: ${decision.reason}`,
            '',
            `- PR: Attempt ${parsed.attempt}/${parsed.maxAttempts}`,
            `- Cumulative cost so far: $${cumulativeCost.toFixed(2)} / $${DEFAULT_HARD_KILL_USD.toFixed(2)}`,
            `- Slug: \`${parsed.slug}\``,
            '',
            '_Claude Code will run with the Sonnet 4.6 model and a $25 budget._',
          ].join('\n')
        : [
            '## 🛑 V4 Manual Intervention',
            '',
            `**Action**: \`manual-intervention\``,
            `**Reason**: ${decision.reason}`,
          ].join('\n')

    yield* Console.log(
      JSON.stringify({
        action: decision.action,
        reason: decision.reason,
        stragglers: '',
        comment: bootstrapComment,
      })
    )
    return
  }

  const report = parseExecutionReport(latestReport)
  yield* Console.error(
    `   Parsed report: ${report.specsFlipped.length} flipped, ${report.stragglers.length} stragglers, regen=${report.regressionStatus}, cost=$${report.totalCost.toFixed(2)}, duration=${report.totalDuration} min`
  )

  const cumulativeCost = sumCumulativeCost(comments)
  yield* Console.error(`   Cumulative cost across reports: $${cumulativeCost.toFixed(2)}`)

  const lifetimeCycles = countLifetimePartialMergeCycles(parsed.slug)
  yield* Console.error(
    `   Lifetime partial-merge cycles for slug "${parsed.slug}": ${lifetimeCycles}`
  )

  const decision = decidePostTestAction({
    testResult: allPassed ? 'success' : 'failure',
    pr: {
      kind: 'v4',
      slug: parsed.slug,
      attempt: parsed.attempt,
      maxAttempts: parsed.maxAttempts,
      totalFixmeAtPRCreation: 0,
    },
    report,
    budget: {
      cumulativeCost,
      hardKillUSD: DEFAULT_HARD_KILL_USD,
    },
    lifetime: { lifetimePartialMergeCycles: lifetimeCycles },
  })

  yield* Console.error(`   Decision: ${decision.action} — ${decision.reason}`)

  const comment = renderDecisionComment(decision, {
    pr: {
      kind: 'v4',
      slug: parsed.slug,
      attempt: parsed.attempt,
      maxAttempts: parsed.maxAttempts,
      totalFixmeAtPRCreation: 0,
    },
    report,
    budget: { cumulativeCost, hardKillUSD: DEFAULT_HARD_KILL_USD },
    lifetime: { lifetimePartialMergeCycles: lifetimeCycles },
  })

  const result: PostTestOutput = {
    action: decision.action,
    reason: decision.reason,
    stragglers: report.stragglers.join(','),
    comment,
  }

  yield* Console.log(JSON.stringify(result))
}).pipe(Effect.provide(Layer.mergeAll(LiveLayer, FileSystemServiceLive, LoggerServiceLive())))

if (import.meta.main) {
  Effect.runPromise(main).catch((error) => {
    console.error(`::error::Unhandled error in V4 post-test: ${error}`)
    console.log(JSON.stringify(fail(`unhandled:${String(error)}`)))
  })
}
