/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { executedFromStored, outputsOfStored } from '../run/nested-step-record'
import { EMPTY_SEQUENCE, type SequenceResume, type SequenceRun } from './nested-sequence'
import type { ContainerResume } from './run-park'
import type { ExecutedStep } from '../run/types'

/**
 * Where a `path/branch` the run resumes inside stands: the branches it
 * finished before the park, and how the branch it parked in re-enters.
 */

/** How the selected branches of a path have gone so far. */
export interface BranchRun {
  readonly matched: readonly string[]
  readonly results: Record<string, unknown>
  /** Each path that ran, with the steps run inside it. */
  readonly paths: readonly { readonly name: string; readonly steps: readonly ExecutedStep[] }[]
  /** What every path run so far produced: the next path's actions read it. */
  readonly sequence: SequenceRun
}

const asRecord = (value: unknown): Readonly<Record<string, unknown>> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {}

/**
 * The branch run a resumed path starts from — what its row held for the
 * branches that finished before the one it parked in — and that branch's own
 * re-entry. The paused branch is left out of the run: it is appended again,
 * whole, once it finishes.
 */
export const resumedBranchRun = (
  resume: ContainerResume
): { readonly run: BranchRun; readonly resume: SequenceResume } => {
  const branch = resume.frame.branch ?? ''
  const output = asRecord(resume.prior.output)
  const storedPaths = resume.prior.nested.paths ?? []
  const pausedAt = storedPaths.findLastIndex((path) => path.name === branch)
  const finished = pausedAt < 0 ? storedPaths : storedPaths.slice(0, pausedAt)
  const matched = Array.isArray(output['matched']) ? output['matched'].map(String) : []
  const results = Object.fromEntries(
    Object.entries(asRecord(output['results'])).filter(([name]) => name !== branch)
  )
  const run: BranchRun = {
    matched: matched.filter((name) => name !== branch),
    results,
    paths: finished.map((path) => ({ name: path.name, steps: path.steps.map(executedFromStored) })),
    sequence: { ...EMPTY_SEQUENCE, outputs: outputsOfStored(finished.flatMap((p) => p.steps)) },
  }
  const prior = pausedAt < 0 ? [] : (storedPaths[pausedAt]?.steps ?? [])
  return { run, resume: { frames: resume.inner, prior, resumedAt: resume.resumedAt } }
}
