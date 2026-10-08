/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A run parking on a long wait, and resuming from where it parked.
 *
 * A `delay` step that waits longer than a minute answers a {@link RunPark}:
 * the instant to resume at, and no frame yet. Each sequence the park crosses
 * on its way up — a loop item, a path branch, the run's own actions — adds the
 * frame of the step it was running, and a loop or a path first says where it
 * is inside itself (`container`), which that frame carries. The run stores the
 * frames as its resume cursor.
 *
 * Resuming hands each container it re-enters a {@link ContainerResume}: its own
 * frame, the frames below it, and what its step row held at the park.
 */

import type { StoredNested } from '../run/nested-step-record'
import type {
  ResumeContainerFrame,
  ResumeFrame,
} from '@/domain/models/app/automations/run-resume-cursor-service'

/** A run parking: when it resumes, and the frames gathered so far. */
export interface RunPark {
  /** Epoch milliseconds. */
  readonly resumeAt: number
  readonly frames: readonly ResumeFrame[]
  /** Where a loop or a path is inside itself, for the frame its parent writes. */
  readonly container?: ResumeContainerFrame
}

/** The park once the sequence that ran `step` at `index` has written its frame. */
export const parkedAt = (park: RunPark, step: string, index: number): RunPark => ({
  resumeAt: park.resumeAt,
  frames: [{ step, index, ...park.container }, ...park.frames],
})

/** What a resumed container re-enters with. */
export interface ContainerResume {
  /** The container's own frame. */
  readonly frame: ResumeFrame
  /** The frames below it; the last one is the wait step. */
  readonly inner: readonly ResumeFrame[]
  /** What the container's step row held when the run parked. */
  readonly prior: { readonly output: unknown; readonly nested: StoredNested }
  /** When the run resumed (ISO 8601), which the wait step's output gains. */
  readonly resumedAt: string
}

/**
 * The output a resumed wait step reads: what it answered at the park, plus
 * `resumedAt` — and `timedOut: true` for a `delay/webhook`, whose deadline is
 * what resumed it.
 */
export const resumedWaitOutput = (
  action: Readonly<Record<string, unknown>>,
  stored: unknown,
  resumedAt: string
): Readonly<Record<string, unknown>> => {
  const base =
    stored !== null && typeof stored === 'object' && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {}
  return action['operator'] === 'webhook'
    ? { ...base, timedOut: true, resumedAt }
    : { ...base, resumedAt }
}
