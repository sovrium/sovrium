/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The per-run `StepContext` the run loop threads to every step: what stays
 * constant across a run's steps, assembled once after the scheduler persisted
 * the queued row (so the run id is known).
 */

import { triggerEntryName } from '@/domain/models/app/automations/trigger-list-validation'
import { withTriggerLanguageText } from '@/domain/models/app/tables/translatable-template-service'
import { createParkedStepCell } from '../action-handlers/parked-step-files'
import { createRunWrittenFiles } from '../action-handlers/run-written-files'
import { buildEnvLookup } from '../resolve-env-vars'
import { buildAutomationContext, type TriggerData } from '../resolve-trigger-data'
import { buildRunEventChannel } from './comment-event-channel'
import { toResolvedRetry, type StepContext } from './types'
import { createCalledWriteOnlyValues, type WriteOnlyInheritance } from './write-only-values'
import type { ActionHandler, ActionKey } from '../action-handlers'
import type { RunLedgers } from './run-ledger-persistence'
import type { AutomationContext } from '../action-handlers/shared'
import type { App } from '@/domain/models/app'
import type { Trigger } from '@/domain/models/app/automations/trigger'

/** The run's ledgers: those restored from its pause, else two empty ones. */
const ledgersOrFresh = (ledgers: RunLedgers | undefined): RunLedgers =>
  ledgers ?? {
    writtenFiles: createRunWrittenFiles(),
    readFiles: createRunWrittenFiles(),
    parkedStep: createParkedStepCell(),
  }

/** A run's input holding the ledgers it will run with, so the same pair is stored if it pauses. */
export const withRunLedgers = <T extends { readonly ledgers?: RunLedgers }>(
  input: T
): T & { readonly ledgers: RunLedgers } => ({ ...input, ledgers: ledgersOrFresh(input.ledgers) })

/**
 * The identity a step's handlers see: the automation, its caller (if any), the
 * persisted run id, and whether the caller started it by hand — the marker that
 * makes record actions write as them.
 */
const toAutomationContext = (input: {
  readonly name: string
  readonly automationId: string
  readonly userId: string | undefined
  readonly runId?: string
  readonly startedByHand?: boolean
  readonly startedAsGuest?: boolean
  readonly writeOnly?: WriteOnlyInheritance
  readonly ledgers?: RunLedgers
}): AutomationContext => ({
  name: input.name,
  id: input.automationId,
  ...(input.userId !== undefined ? { userId: input.userId } : {}),
  ...(input.runId !== undefined ? { runId: input.runId } : {}),
  // Kept even without a caller: a hand-started run whose caller is gone (an
  // account erased while the run waited on an approval) must write nothing,
  // never fall back to writing as the system.
  ...(input.startedByHand === true ? { startedByHand: true as const } : {}),
  // A visitor's run acts as a visitor who is not signed in, never as the system.
  ...(input.startedByHand === true && input.startedAsGuest === true
    ? { startedAsGuest: true as const }
    : {}),
  // A run its trigger started reads write-only values (as the system, unless a
  // person started it); a called run inherits its caller's standing and ledger.
  writeOnly: input.writeOnly ?? { blind: false, called: createCalledWriteOnlyValues() },
  // One ledger per run: a step writing as nobody attaches only what this run stored.
  // One per run too: a called run starts with nothing read, so it fails closed. A resumed
  // run starts with what it had stored and read before its pause.
  ...ledgersOrFresh(input.ledgers),
})

/** What the steps read: the recorded data, and the entry that started the run. */
const withStartedBy = (triggerData: TriggerData, trigger: Trigger): TriggerData => ({
  ...triggerData,
  startedBy: { type: trigger.type, name: triggerEntryName(trigger) },
})

/** What `buildStepContext` builds a run's step context from. */
interface BuildStepContextInput {
  readonly name: string
  readonly automationId: string
  readonly app: App
  readonly automation: NonNullable<App['automations']>[number]
  /** The trigger entry that started the run. */
  readonly trigger: Trigger
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly triggerData: TriggerData
  readonly handlers: ReadonlyMap<ActionKey, ActionHandler>
  readonly userId: string | undefined
  readonly startedByHand?: boolean
  readonly startedAsGuest?: boolean
  readonly writeOnly?: WriteOnlyInheritance
  readonly propsFinal?: boolean
  readonly callDepth?: number
  readonly recordEventDepth?: number
  readonly visitedAutomations?: ReadonlySet<string>
  /**
   * The persisted `system.automation_runs.id` for this run. Threaded into the
   * per-step `AutomationContext` so the `approval/request` handler can FK its
   * pending row to the run it pauses. Resolved by the scheduler
   * AFTER the queued row lands, so the orchestrator builds the context once the
   * runId is known.
   */
  readonly runId?: string
  /** See `StepContext.runProgram` — captured from the running fiber. */
  readonly runProgram: StepContext['runProgram']
  /** See `StepContext.templates` — read from the `TemplateEngine` port. */
  readonly templates: StepContext['templates']
  readonly ledgers?: RunLedgers
}

/**
 * Build a `StepContext` for the run loop.
 */
export const buildStepContext = (input: BuildStepContextInput): StepContext => {
  const { name, automationId, app, automation, processEnv, handlers, trigger } = input
  const triggerData = withStartedBy(input.triggerData, trigger)
  const recordEventDepth = input.recordEventDepth ?? 0
  const automationContext = toAutomationContext({ ...input, name, automationId })
  return {
    app,
    runProgram: input.runProgram,
    envLookup: buildEnvLookup(app.env, processEnv),
    processEnv,
    handlers,
    // A translatable field prints as its default language; `.fr` names one language.
    templateContext: buildAutomationContext(
      withTriggerLanguageText(
        app,
        trigger.type === 'record' ? trigger.table : undefined,
        triggerData as Readonly<Record<string, unknown>>
      ) as TriggerData
    ),
    templates: input.templates,
    automation: automationContext,
    triggerType: trigger.type,
    triggerData: triggerData as Readonly<Record<string, unknown>>,
    automationRetry: toResolvedRetry(automation.retry),
    callDepth: input.callDepth ?? 0,
    visitedAutomations: new Set([...(input.visitedAutomations ?? []), name]),
    recordEventDepth,
    recordEvents: buildRunEventChannel({
      ...{ app, processEnv, recordEventDepth },
      automation: automationContext,
      runProgram: input.runProgram,
    }),
    ...(input.propsFinal === true ? { propsFinal: true as const } : {}),
  }
}
