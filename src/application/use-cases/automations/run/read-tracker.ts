/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What one step read as it ran, recorded at the places the engine dispatches
 * on the step's behalf: every native action a script calls through
 * `context.actions` (and every template it invokes), classified by the shared
 * step-read classifier, and the run a synchronous call starts.
 *
 * The hook sits at the sandbox's one dispatch point, not in user code, so a
 * script cannot read anything the record does not hold.
 */

import { classifyStepRead, type StepRead } from '@/domain/models/app/automations/step-read-service'
import { redactSecretsForApp } from '../redact-secrets'
import type { ActionOutcome } from '../action-handlers'
import type { AutomationInvoker, StepContext } from './types'
import type { App } from '@/domain/models/app'

/** The reads of one step, recorded as they happen. */
export interface ReadTracker {
  /** Record what one dispatched action read, given its output when it ran. */
  readonly dispatched: (
    app: App,
    action: Readonly<Record<string, unknown>>,
    output: unknown
  ) => void
  /** Record the run a synchronous call started. */
  readonly calledRun: (automation: string, runId: string) => void
  /** Everything recorded so far, in call order. */
  readonly reads: () => readonly StepRead[]
}

/** Most reads kept per step — a runaway loop of calls must not bloat run history. */
const MAX_READS = 1000

/** A fresh tracker for one step. */
export const createReadTracker = (): ReadTracker => {
  // A mutable buffer is the point: user code calls actions as a side effect
  // from inside the sandbox, and the only way to observe those calls afterwards
  // is to record them somewhere the step can read back (`code-log-collector.ts`).
  // eslint-disable-next-line functional/prefer-immutable-types -- the tracker's buffer; see above
  const buffer: StepRead[] = []
  const append = (read: StepRead): void => {
    // Past the cap the step is not judged: it reads what no reach judges.
    const next: StepRead =
      buffer.length >= MAX_READS ? { kind: 'unknown', reason: 'called too many actions' } : read
    if (buffer.length > MAX_READS) return
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, no-restricted-syntax -- the tracker's buffer; see above
    buffer.push(next)
  }
  return {
    dispatched: (app, action, output) => append(classifyStepRead(app, action, output)),
    calledRun: (automation, runId) => append({ kind: 'calledRun', automation, runId }),
    reads: () => [...buffer],
  }
}

/**
 * The reads a step recorded as it ran, set on its outcome: what a script's
 * calls read — nothing at all when it called nothing, which is itself a
 * verdict — and the run a synchronous call started, beside any its handler
 * reported (an agent's tool calls, none included). Left unset when nothing was
 * recorded for any other step, whose read is then classified from its
 * declaration.
 */
export const withRecordedReads = (
  outcome: ActionOutcome,
  rawAction: Readonly<Record<string, unknown>>,
  tracker: ReadTracker
): ActionOutcome => {
  const reads = [...tracker.reads(), ...(outcome.reads ?? [])]
  const isScript = String(rawAction['type'] ?? '') === 'code'
  // A handler that reported its reads — an agent whose model called no tool —
  // said what it read, even nothing.
  const recorded = isScript || outcome.reads !== undefined || reads.length > 0
  return recorded ? { ...outcome, reads } : outcome
}

/**
 * The `automation:call` invoker of one step, recording the run a synchronous
 * call starts — its output is what that run returned, so it is judged by what
 * that run read. A fire-and-forget call returns nothing.
 */
export const trackedInvoker =
  (invoke: AutomationInvoker, tracker: ReadTracker): AutomationInvoker =>
  (input) =>
    invoke({
      ...input,
      onRun: (runId) => {
        if (input.mode === 'sync') tracker.calledRun(input.name, runId)
      },
    })

/**
 * What a step recorded reading, kept as read — a record's fields included, as
 * a record step's output keeps them — since it is judged at read time, but
 * redacted of env values and connection secrets like every other runtime
 * channel of a step.
 */
export const redactedReads = (
  reads: readonly StepRead[] | undefined,
  ctx: Pick<StepContext, 'app' | 'processEnv'>
): { readonly reads?: readonly StepRead[] } => {
  if (reads === undefined) return {}
  const connections = ctx.app.connections as unknown as
    ReadonlyArray<Readonly<Record<string, unknown>>> | undefined
  const redacted = redactSecretsForApp(reads, ctx.app.env, ctx.processEnv, connections)
  return { reads: redacted as readonly StepRead[] }
}
