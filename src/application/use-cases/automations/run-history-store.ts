/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface AutomationRunRecord {
  readonly id: string
  readonly automationName: string
  readonly startedAt: string
  readonly finishedAt: string
  readonly status: 'success' | 'failure' | 'timed-out' | 'exhausted' | 'completed-with-errors'
  readonly steps: ReadonlyArray<{
    readonly name: string
    readonly type: string
    readonly operator?: string
    readonly status: 'success' | 'failure' | 'skipped'
    readonly error?: string
    readonly props?: Record<string, unknown>
    readonly output?: Record<string, unknown>
  }>
  readonly error?: string
}

const MAX_RUNS_PER_AUTOMATION = 100

let runs: ReadonlyArray<AutomationRunRecord> = []

export const recordAutomationRun = (run: AutomationRunRecord): void => {
  const sameAutomation = runs.filter((r) => r.automationName === run.automationName)
  const otherRuns = runs.filter((r) => r.automationName !== run.automationName)
  const trimmed =
    sameAutomation.length >= MAX_RUNS_PER_AUTOMATION
      ? sameAutomation.slice(-(MAX_RUNS_PER_AUTOMATION - 1))
      : sameAutomation
  runs = [...otherRuns, ...trimmed, run]
}

export const listAutomationRuns = (filter?: {
  readonly automationName?: string
}): ReadonlyArray<AutomationRunRecord> => {
  if (!filter?.automationName) return runs
  return runs.filter((r) => r.automationName === filter.automationName)
}

export const getAutomationRun = (id: string): AutomationRunRecord | undefined =>
  runs.find((r) => r.id === id)

export const clearAutomationRuns = (): void => {
  runs = []
}
