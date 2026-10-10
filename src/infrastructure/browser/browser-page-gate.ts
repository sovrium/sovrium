/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sleep, StepError, type CdpSend } from './browser-cdp'
import { settle } from './browser-page-find'
import { decideSend, gatesSends, isExemptGesture, isSend } from './browser-send-gate'
import type { Paused, PageState } from './browser-page-state'
import type { BrowserSend, BrowserSends } from '@/application/ports/services/browser-driver'

/**
 * The submission gate on a Chrome page: the
 * stateful half of `browser-send-gate.ts`.
 *
 * Every request already pauses at the `Fetch` Request stage for the host
 * guard; a send the guard lets through then meets the gate. A held send is
 * simply left paused — unanswered, the site receives nothing — and released
 * later with `Fetch.continueRequest`, once, in the order the page sent it: the
 * page's own request goes on with its own cookies, token and awaiting script,
 * never a replay. A session closed with sends still held fails them first.
 *
 * A gesture is an agent's click, press, fill, select or check: its window
 * opens before the input and closes once the action settled, plus a short
 * grace for a script that sends a beat after its event.
 */

/** How long after an action settled a send still belongs to it. */
const GESTURE_GRACE_MS = 300

/** How long failing one held send may take while the session closes. */
const FAIL_ON_CLOSE_MS = 2000

export const failRequest = (
  send: CdpSend,
  requestId: string,
  timeoutMs?: number
): Promise<unknown> =>
  send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }, timeoutMs)

const originOf = (url: string): string | undefined => {
  try {
    return new URL(url).origin
  } catch {
    return undefined
  }
}

/** Continue a request the guard let through. */
const continuePaused = async (
  state: PageState,
  send: CdpSend,
  paused: { readonly requestId: string; readonly url: string },
  topDocument: boolean
): Promise<void> => {
  if (topDocument) state.topOrigin = originOf(paused.url)
  await send('Fetch.continueRequest', { requestId: paused.requestId })
}

const sendOf = (paused: Paused): BrowserSend => ({ method: paused.method, url: paused.url })

/** The gesture in flight, its exemption settled by its first send. */
const gestureNow = (state: PageState): { readonly exempt: boolean } | undefined => {
  const { gate } = state
  if (gate.gesture === undefined) return undefined
  if (gate.gesture.exempt === undefined) {
    gate.gesture.exempt = gate.policy === 'approve' && isExemptGesture(gate.typed)
  }
  return { exempt: gate.gesture.exempt }
}

/** Continue, hold or fail a request the host guard let through. */
export const gateRequest = async (
  state: PageState,
  send: CdpSend,
  paused: Paused,
  topDocument: boolean
): Promise<void> => {
  const { gate } = state
  const continuesReleased =
    gate.released.has(paused.requestId) ||
    (paused.redirectedRequestId !== undefined && gate.released.has(paused.redirectedRequestId))
  const decision = decideSend(
    { method: paused.method, resourceType: paused.resourceType, continuesReleased },
    { gate: gate.policy, gesture: gatesSends(gate.policy) ? gestureNow(state) : undefined }
  )
  if (decision.kind === 'hold') {
    gate.held = [...gate.held, { ...sendOf(paused), requestId: paused.requestId, topDocument }]
    return
  }
  if (decision.kind === 'refuse') {
    if (decision.reason === 'gesture') gate.refused = [...gate.refused, sendOf(paused)]
    else gate.heldBack = [...gate.heldBack, sendOf(paused)]
    await failRequest(send, paused.requestId)
    return
  }
  if (gatesSends(gate.policy) && isSend(paused)) {
    // A send that left: what was typed before it exempts nothing more.
    gate.typed = { secret: 0, plain: 0 }
    if (continuesReleased) gate.released = new Set([...gate.released, paused.requestId])
  }
  await continuePaused(state, send, paused, topDocument)
}

/** What an agent gesture types: a credential (`secret`), a value of the model's (`plain`), or nothing. */
export type GestureTyping = 'secret' | 'plain' | undefined

/**
 * Run `act` as one agent gesture: its sends are attributed to it. Without a
 * gate it is just `act`.
 */
export const asGesture = async <A>(
  state: PageState,
  typing: GestureTyping,
  act: () => Promise<A>
): Promise<A> => {
  const { gate } = state
  if (!gatesSends(gate.policy)) return act()
  if (typing !== undefined) {
    gate.typed = { ...gate.typed, [typing]: gate.typed[typing] + 1 }
  }
  gate.gesture = { exempt: undefined }
  try {
    const result = await act()
    if (gate.held.length === 0) await sleep(GESTURE_GRACE_MS)
    return result
  } finally {
    gate.gesture = undefined
  }
}

/** What the gate did since the last call; the held sends stay held. */
export const takeSends = (state: PageState): BrowserSends => {
  const { gate } = state
  const taken: BrowserSends = {
    held: gate.held.map(({ method, url }) => ({ method, url })),
    refused: gate.refused,
    heldBack: gate.heldBack,
  }
  gate.refused = []
  gate.heldBack = []
  return taken
}

/**
 * Release every held send, once each and in order, then wait for what it
 * started. A send the page makes before the release settled is held again: a
 * person approved what they saw, not what the page sends next.
 */
export const releaseSends = async (state: PageState, timeoutMs: number): Promise<void> => {
  const { gate, send } = state
  const { held } = gate
  if (send === undefined || held.length === 0) return
  gate.held = []
  gate.typed = { secret: 0, plain: 0 }
  gate.released = new Set([...gate.released, ...held.map((h) => h.requestId)])
  gate.gesture = { exempt: false }
  try {
    const failed = await held.reduce<Promise<readonly string[]>>(async (previous, request) => {
      const done = await previous
      // Not a swallow: a request that cannot be continued any more is named in the
      // step's failure below.
      const ok = await continuePaused(state, send, request, request.topDocument).then(
        () => true,
        () => false
      )
      return ok ? done : [...done, `${request.method} ${request.url}`]
    }, Promise.resolve([]))
    if (failed.length > 0) {
      throw new StepError(
        'step_failed',
        `the approved request(s) could no longer be sent (${failed.join(', ')}): the page dropped them while it waited`
      )
    }
    await settle(state, timeoutMs)
    if (gate.held.length === 0) await sleep(GESTURE_GRACE_MS)
  } finally {
    gate.gesture = undefined
  }
}

/** Fail every send still held, so nothing leaves once the session closes. Never throws. */
export const failHeld = async (state: PageState): Promise<void> => {
  const { gate, send } = state
  const { held } = gate
  gate.held = []
  if (send === undefined) return
  await Promise.all(
    // Swallowed: the view is being closed, and closing it ends a paused request
    // unanswered as well; failing it first only makes that explicit.
    held.map((request) =>
      failRequest(send, request.requestId, FAIL_ON_CLOSE_MS).catch(() => undefined)
    )
  )
}
