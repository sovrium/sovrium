/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How `sovrium deploy` prints a deployment's progress while it waits: each
 * state it reaches, and each new attempt when the cloud tries it again.
 */

import { deploymentStatusValues } from '@/domain/models/api/automations/automations'
import type { PreviousDeploymentAttempt } from '@/domain/models/api/automations/automations'

const KNOWN_STATUSES: ReadonlySet<string> = new Set(deploymentStatusValues)

/**
 * A state as a person reads it: a state this version knows is printed in
 * words (`waking-up` is `waking up`); one a newer cloud added is printed as
 * the cloud wrote it.
 *
 * @public
 */
export const describeDeploymentStatus = (status: string): string =>
  KNOWN_STATUSES.has(status) ? status.replaceAll('-', ' ') : status

/**
 * The line saying the cloud is on another attempt, and how the one before
 * ended when it says: `attempt 2, previous attempt failed: <why>`.
 *
 * @public
 */
export const describeDeploymentAttempt = (
  attempt: number,
  previous: PreviousDeploymentAttempt | null | undefined
): string => {
  if (previous == null) return `attempt ${attempt}`
  const ended = `attempt ${attempt}, previous attempt ${describeDeploymentStatus(previous.status)}`
  return previous.error == null || previous.error === '' ? ended : `${ended}: ${previous.error}`
}

/** What the command last printed of a deployment: its state, and the attempt it was on. */
export interface PrintedProgress {
  readonly status: string
  readonly attempt: number | undefined
}

/** A deployment's progress as one read reports it. */
export interface ReadProgress {
  readonly status: string
  readonly attempt?: number | null | undefined
  readonly previous?: PreviousDeploymentAttempt | null | undefined
}

/**
 * The line announcing a later attempt, when the read is on one this command
 * has not printed yet. A first attempt is never announced.
 *
 * @public
 */
export const attemptLines = (
  id: string,
  printedAttempt: number | undefined,
  read: Pick<ReadProgress, 'attempt' | 'previous'>
): readonly string[] => {
  const attempt = read.attempt ?? undefined
  return attempt !== undefined && attempt > 1 && attempt !== printedAttempt
    ? [`Deployment ${id}: ${describeDeploymentAttempt(attempt, read.previous)}`]
    : []
}

/**
 * The lines one read adds to what was printed: the new attempt, when the cloud
 * moved to a later one — even if its state is one already printed — then the
 * state, when it changed.
 *
 * @public
 */
export const progressLines = (
  id: string,
  printed: PrintedProgress,
  read: ReadProgress
): readonly string[] => [
  ...attemptLines(id, printed.attempt, read),
  ...(read.status === printed.status
    ? []
    : [`Deployment ${id}: ${describeDeploymentStatus(read.status)}`]),
]
