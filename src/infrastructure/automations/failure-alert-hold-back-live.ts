/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Live `FailureAlertHoldBack`: one process-local hold-back per running server.
 *
 * The state is a module value rather than a layer-built `Ref` because the run
 * loop, the roll-up scheduler and the trigger routes each provide their own
 * layer, and all of them must read the SAME memory. It is stamped with the
 * instant the server started and starts empty when another server boots in the
 * same process (the E2E harness does), as it would after a real restart.
 */

import { Effect, Layer } from 'effect'
import { FailureAlertHoldBack } from '@/application/ports/services/failure-alert-hold-back'
import {
  EMPTY_HOLD_BACK,
  decideHoldBack,
  takeHeldBack,
  type HoldBackState,
} from '@/domain/models/app/automations/automation-run-outcome-service'
import { readServerBootInstant } from '@/infrastructure/process/server-boot-instant'

let current: { readonly bootMs: number; readonly state: HoldBackState } = {
  bootMs: readServerBootInstant().getTime(),
  state: EMPTY_HOLD_BACK,
}

/** The hold-back of the running server, empty again after a new boot. */
const readState = (): HoldBackState => {
  const bootMs = readServerBootInstant().getTime()
  if (current.bootMs !== bootMs) current = { bootMs, state: EMPTY_HOLD_BACK }
  return current.state
}

const writeState = (state: HoldBackState): void => {
  current = { bootMs: current.bootMs, state }
}

export const FailureAlertHoldBackLive = Layer.succeed(
  FailureAlertHoldBack,
  FailureAlertHoldBack.of({
    decide: (failure, history) =>
      Effect.sync(() => {
        const next = decideHoldBack(readState(), failure, history)
        writeState(next.state)
        return next.decision
      }),
    take: Effect.sync(() => {
      const taken = takeHeldBack(readState())
      writeState(taken.state)
      return { groups: taken.groups, overflow: taken.overflow }
    }),
  })
)
