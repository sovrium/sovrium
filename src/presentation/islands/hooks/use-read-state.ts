/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useContext, useEffect, useState } from 'react'
import { IslandHostIdContext } from '../runtime/island-host-context'
import type * as ReadStates from '../runtime/read-state'
import type { ReadState } from '@/domain/models/app/pages/components/read-state-gate'

/**
 * The gates' runtime, fetched only on a page that holds a gated button rather
 * than mounted with every data island: few pages carry one. Calls made before
 * it lands run in order once it has.
 */
let requested = false
const withReadStates = (run: (module: typeof ReadStates) => void): void => {
  // Once fetched, it hears every later call: a page left behind must still be forgotten.
  requested ||= document.querySelector('[data-read-hidden],[data-read-disabled-when]') !== null
  if (!requested) return
  // A failed fetch surfaces as an unhandled rejection; the buttons keep the
  // state the server drew.
  void import('../runtime/read-state').then(run)
}

/**
 * Announce the state of a data component's latest read to the buttons that
 * follow it (`runtime/read-state.ts`): under `id` — the island host's
 * `props.id` when not given — and on `channel`, its `dataSource.bindTo`.
 * `state` is `undefined` while no read has settled since the last one, so a
 * re-read in flight keeps the previous state. Silent for a component with
 * neither name, which no gate can follow.
 */
export function useReadState(
  channel: string | undefined,
  state: ReadState | undefined,
  id?: string
): void {
  const hostId = useContext(IslandHostIdContext)
  const name = id ?? hostId
  const [key] = useState(() => ({}))
  useEffect(() => {
    if (name === undefined && channel === undefined) return
    withReadStates((states) => states.announceReadState(key, name, channel, state))
  }, [key, name, channel, state])
  useEffect(() => () => withReadStates((states) => states.forgetReadState(key)), [key])
}
