/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Run one agent action through the automation engine's own handler, outside
 * any automation run.
 *
 * An agent's actions (`record.create`, `http.request`, `email.send`, …) are the
 * automation engine's actions, so they run through the SAME handlers a step
 * does — the record write fires its table's webhooks and record automations,
 * the request goes through the egress guard, the email through the configured
 * sender. A turn started by an automation dispatches through its run instead
 * (`runContext.invokeNativeAction`); this is the dispatcher for the turns no
 * run started — a chat turn, a scheduled run, an approved action resumed.
 *
 * The action runs in a synthetic automation named after the agent. The
 * agent's role was judged by the gates BEFORE this point. With no `caller` (a
 * scheduled run) the handler writes what the gates admitted, as the system
 * actor; with one (a chat turn, or the approval of a call one paused) it runs
 * AS that person, exactly like an automation someone started by hand: every
 * record read is scoped to her rows and columns, every write judged by her
 * grants, row-level rules and field audiences.
 *
 * `state.*` actions are refused: their values are keyed by automation, and a
 * turn outside an automation run has none to keep them under.
 */

import { Effect } from 'effect'
import { TemplateEngine } from '@/application/ports/services/template-engine'
import { announceRecordWrites } from '@/application/use-cases/tables/record-change-announcement'
import { agentActionKey, needsAutomationRun } from '@/domain/models/app/agents/agent-turn-service'
import { buildEnvLookup } from '@/domain/models/app/env-reference-service'
import { actionKey, defaultActionHandlers } from '../automations/action-handlers'
import type { AgentActionResult } from './agent-tool-call'
import type { ActionRunContext, AutomationContext } from '../automations/action-handlers'
import type { StepRequirements } from '../automations/run/types'
import type { App } from '@/domain/models/app'

/** The run's starter, as a hand-started automation names one: the person the turn answers. */
const asStarter = (
  caller: { readonly userId: string | undefined } | undefined
): Pick<AutomationContext, 'startedByHand' | 'userId'> =>
  caller === undefined
    ? {}
    : { startedByHand: true, ...(caller.userId !== undefined && { userId: caller.userId }) }

/** An action declined before it ran, for a reason that names it and no value. */
const declined = (explanation: string): AgentActionResult =>
  ({ ok: false, error: explanation, explanation }) as const

/** Run `action` with `props` for the agent named `agentName`. */
export const dispatchAgentAction = (input: {
  readonly app: App
  readonly agentName: string
  readonly action: string
  readonly props: Readonly<Record<string, unknown>>
  /** The person the turn answers; absent when nobody does. */
  readonly caller?: { readonly userId: string | undefined } | undefined
}): Effect.Effect<AgentActionResult, never, StepRequirements> =>
  Effect.gen(function* () {
    if (needsAutomationRun(input.action)) {
      return declined(
        `the action "${input.action}" keeps its values per automation and is only available when an automation runs the agent`
      )
    }
    const { type, operator } = agentActionKey(input.action)
    const handler = defaultActionHandlers.get(actionKey(type, operator))
    if (handler === undefined) return declined(`the action "${input.action}" is not available`)
    const rawAction = { name: `agent:${input.action}`, type, operator, props: input.props }
    const runContext: ActionRunContext = {
      previousSteps: {},
      triggerData: {},
      rawAction,
      authoredProps: input.props,
      // A model's arguments are values, never a template to render.
      propsFinal: true,
      envLookup: buildEnvLookup(input.app.env, process.env),
      templates: yield* TemplateEngine,
    }
    const automation: AutomationContext = {
      name: `agent:${input.agentName}`,
      id: '',
      ...asStarter(input.caller),
    }
    const outcome = yield* announceRecordWrites(input.app)(
      handler(rawAction, input.app, automation, runContext)
    )
    return outcome.status === 'success'
      ? ({ ok: true, output: outcome.output ?? {} } as const)
      : ({
          ok: false,
          error: outcome.error ?? `${input.action} failed`,
          refusedWrite: outcome.refusedWrite,
          requestFailure: outcome.requestFailure,
        } as const)
  }).pipe(Effect.withSpan('agents.dispatch-agent-action'))
