/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The signing-request half of a run's event channel.
 *
 * A `signature/send` or `signature/cancel` step moves a request, and the move
 * starts the signature automations listening to it, as a move a signer makes
 * does. Started in the background, for the reason the record channel's runs
 * are: a run waiting on the runs it starts would hold its concurrency slot.
 * The started runs are one automation write deeper than the step's run.
 */

import { AutomationFiberBridge } from '@/application/ports/services/automation-fiber-bridge'
import { triggersOfType } from '@/domain/models/app/automations/trigger-entries-service'
import { logError } from '@/infrastructure/logging/logger'
import {
  triggerSignatureEventAutomations,
  type TriggerSignatureEventInput,
} from '../trigger-signature-event'
import type { StepContext } from './types'
import type { App } from '@/domain/models/app'

/** A move a step made, as the signature triggers read it. */
export type StepSignatureEvent = Omit<TriggerSignatureEventInput, 'app' | 'depth'>

/** How the request moves a step makes reach the signature triggers. */
export interface SignatureEventChannel {
  readonly dispatch: (move: StepSignatureEvent) => void
}

/** True when some automation of `app` listens to a request of `flow`. */
const hasSignatureAutomations = (app: App, flow: string): boolean =>
  (app.automations ?? []).some((automation) =>
    triggersOfType(automation, 'signature').some((trigger) => trigger.flow === flow)
  )

/** What the channel reads from the run it belongs to. */
type ChannelContext = Pick<StepContext, 'app' | 'recordEventDepth' | 'runProgram'>

/** Build the signature channel for one run. */
export const buildSignatureEventChannel = (ctx: ChannelContext): SignatureEventChannel => ({
  dispatch: (move) => {
    if (!hasSignatureAutomations(ctx.app, move.flow.name)) return
    const program = triggerSignatureEventAutomations({
      ...move,
      app: ctx.app,
      depth: ctx.recordEventDepth + 1,
    })
    // eslint-disable-next-line functional/no-expression-statements -- background dispatch; see the module doc for why the step does not wait
    ctx.runProgram(AutomationFiberBridge.use((bridge) => bridge.trackBackground(program))).then(
      () => undefined,
      (error: unknown) => {
        logError('[automation:signature] background dispatch from a step rejected', error)
      }
    )
  },
})
