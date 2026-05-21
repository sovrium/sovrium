/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { TDD_V4_CONFIG } from '../../core/config'

export type Action =
  | 'dispatch-tier-1'
  | 'auto-merge'
  | 'dispatch-tier-2'
  | 'partial-merge'
  | 'manual-intervention'

export interface ExecutionReport {
  readonly specsFlipped: readonly string[]
  readonly stragglers: readonly string[]
  readonly regressionStatus: 'regenerated' | 'skipped' | 'failed'
  readonly totalCost: number
  readonly totalDuration: number
}

export interface PRState {
  readonly kind: 'v4'
  readonly slug: string
  readonly attempt: number
  readonly maxAttempts: number
  readonly totalFixmeAtPRCreation: number
}

export interface LifetimeState {
  readonly lifetimePartialMergeCycles: number
}

export interface BudgetState {
  readonly cumulativeCost: number
  readonly hardKillUSD: number
}

export interface Decision {
  readonly action: Action
  readonly reason: string
}

export const DEFAULT_HARD_KILL_USD = 85


export function decidePostTestAction(params: {
  readonly testResult: 'success' | 'failure'
  readonly pr: PRState
  readonly report: ExecutionReport
  readonly budget: BudgetState
  readonly lifetime: LifetimeState
}): Decision {
  const { testResult, pr, report, budget, lifetime } = params

  if (testResult === 'failure') {
    return {
      action: 'manual-intervention',
      reason: `CI E2E suite failed — Claude self-reported flipping specs but the suite caught a regression. Investigate manually.`,
    }
  }

  if (budget.cumulativeCost >= budget.hardKillUSD) {
    return {
      action: 'manual-intervention',
      reason: `Cumulative cost $${budget.cumulativeCost.toFixed(2)} reached hard kill ceiling $${budget.hardKillUSD.toFixed(2)}. No more dispatches.`,
    }
  }

  if (report.specsFlipped.length === 0) {
    return {
      action: 'manual-intervention',
      reason: `Tier ${pr.attempt} flipped 0 specs (${report.stragglers.length} stragglers remain). The model could not make any progress on this file.`,
    }
  }

  if (pr.attempt >= pr.maxAttempts && report.regressionStatus === 'failed') {
    return {
      action: 'manual-intervention',
      reason: `Final attempt failed to regenerate the @regression test. Merging would land a stale regression. Escalating.`,
    }
  }

  if (pr.attempt < pr.maxAttempts) {
    if (report.stragglers.length === 0) {
      return {
        action: 'auto-merge',
        reason: `Tier 1 (Sonnet) flipped all ${report.specsFlipped.length} fixme spec(s). Regression: ${report.regressionStatus}.`,
      }
    }
    return {
      action: 'dispatch-tier-2',
      reason: `Tier 1 flipped ${report.specsFlipped.length} spec(s) but left ${report.stragglers.length} straggler(s). Dispatching Opus tier on stragglers only.`,
    }
  }

  if (report.stragglers.length === 0) {
    return {
      action: 'auto-merge',
      reason: `Tier 2 (Opus) closed the remaining gap. ${report.specsFlipped.length} additional spec(s) flipped. Regression: ${report.regressionStatus}.`,
    }
  }

  const nextLifetime = lifetime.lifetimePartialMergeCycles + 1
  if (nextLifetime > TDD_V4_CONFIG.MAX_PARTIAL_MERGE_CYCLES) {
    return {
      action: 'manual-intervention',
      reason: `File slug "${pr.slug}" already had ${lifetime.lifetimePartialMergeCycles} partial-merge cycle(s) on main; partial-merging again would exceed the lifetime cap (${TDD_V4_CONFIG.MAX_PARTIAL_MERGE_CYCLES}). Escalating.`,
    }
  }

  return {
    action: 'partial-merge',
    reason: `Tier 2 made partial progress (${report.specsFlipped.length} additional spec(s) flipped, ${report.stragglers.length} straggler(s) remain). Merging the green work with the .fixme() retained on the stragglers. Lifetime cycle ${nextLifetime}/${TDD_V4_CONFIG.MAX_PARTIAL_MERGE_CYCLES}.`,
  }
}

export function decideNoReportAction(params: {
  readonly pr: PRState
  readonly budget: BudgetState
}): Decision {
  const { pr, budget } = params

  if (budget.cumulativeCost >= budget.hardKillUSD) {
    return {
      action: 'manual-intervention',
      reason: `No execution report on PR and cumulative cost $${budget.cumulativeCost.toFixed(2)} already at hard kill ceiling $${budget.hardKillUSD.toFixed(2)}. Refusing to dispatch.`,
    }
  }

  if (pr.attempt >= pr.maxAttempts) {
    return {
      action: 'manual-intervention',
      reason: `PR is at Attempt ${pr.attempt}/${pr.maxAttempts} but no execution report was posted. The Claude run silently failed and no sentinel was posted either. Escalating for human review.`,
    }
  }

  return {
    action: 'dispatch-tier-1',
    reason: `First post-test cycle for this PR (Attempt ${pr.attempt}/${pr.maxAttempts}). No execution report yet — dispatching Tier 1 (Sonnet) on the file's .fixme() specs.`,
  }
}

export function renderDecisionComment(
  decision: Decision,
  params: {
    readonly pr: PRState
    readonly report: ExecutionReport
    readonly budget: BudgetState
    readonly lifetime: LifetimeState
  }
): string {
  const { pr, report, budget, lifetime } = params

  const header =
    decision.action === 'auto-merge'
      ? '## ✅ V4 Auto-Merge'
      : decision.action === 'dispatch-tier-1'
        ? '## 🚀 V4 Initial Dispatch → Sonnet Tier 1'
        : decision.action === 'dispatch-tier-2'
          ? '## 🔁 V4 Escalation → Opus Tier 2'
          : decision.action === 'partial-merge'
            ? '## ⚠️ V4 Partial-Merge'
            : '## 🛑 V4 Manual Intervention'

  return [
    header,
    '',
    `**Action**: \`${decision.action}\``,
    `**Reason**: ${decision.reason}`,
    '',
    '### Execution report',
    `- Specs flipped this tier: ${report.specsFlipped.length} (${report.specsFlipped.join(', ') || '—'})`,
    `- Stragglers remaining: ${report.stragglers.length} (${report.stragglers.join(', ') || '—'})`,
    `- Regression status: \`${report.regressionStatus}\``,
    `- Tier cost: $${report.totalCost.toFixed(2)} (cumulative $${budget.cumulativeCost.toFixed(2)} / $${budget.hardKillUSD.toFixed(2)})`,
    `- Tier duration: ${report.totalDuration} min`,
    '',
    '### PR state',
    `- File slug: \`${pr.slug}\``,
    `- Attempt: ${pr.attempt}/${pr.maxAttempts}`,
    `- Lifetime partial-merge cycles for this file: ${lifetime.lifetimePartialMergeCycles}/${TDD_V4_CONFIG.MAX_PARTIAL_MERGE_CYCLES}`,
  ].join('\n')
}
