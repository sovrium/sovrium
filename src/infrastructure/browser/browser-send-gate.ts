/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { BrowserSendGate } from '@/application/ports/services/browser-driver'

/**
 * The submission gate's decisions: what a request the host guard
 * let through may still do while a browser agent drives.
 *
 * The gate is a request METHOD, read at the network, whoever composed the
 * request: a form, a script's `fetch` or XHR, a beacon. `GET` and `HEAD` always
 * flow, and so does the CORS preflight Chrome sends on its own. Everything else
 * is a SEND, and a send belongs to the agent gesture in flight when it left, or
 * to nobody:
 *
 * - a beacon (`Ping` — `navigator.sendBeacon`, `<a ping>`) is refused, always;
 * - a send outside a gesture (on load, on a timer, after `goto`) is refused;
 * - under `refuse` (chat `browser.use`) a gesture's send is refused too, and the
 *   call ends with `submit_requires_approval`;
 * - under `approve` a gesture's send is HELD unanswered for a person, unless the
 *   gesture is exempt (a sign-in typed from `credentials` alone);
 * - a 307/308 continuing a request already released follows its release.
 *
 * Pure: the page session keeps the state and sends each decision to Chrome.
 */

/** What the gate reads of a request the host guard already let through. */
export interface SendRequest {
  readonly method: string
  readonly resourceType: string
  /** The request continues one a person released (a 307/308 of it). */
  readonly continuesReleased: boolean
}

/** What the gate knows of the moment the request left. */
export interface SendContext {
  readonly gate: BrowserSendGate | undefined
  /** The gesture in flight, if any, and whether its sends are exempt. */
  readonly gesture: { readonly exempt: boolean } | undefined
}

export type SendDecision =
  | { readonly kind: 'flow' }
  /** Held unanswered in the browser until a person decides. */
  | { readonly kind: 'hold' }
  /** Failed in the browser: the site receives nothing. */
  | { readonly kind: 'refuse'; readonly reason: 'beacon' | 'background' | 'gesture' }

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD'])

/** Whether the request carries something of the page's to the site. */
export const isSend = (request: Pick<SendRequest, 'method' | 'resourceType'>): boolean =>
  !SAFE_METHODS.has(request.method.toUpperCase()) && request.resourceType !== 'Preflight'

/** Whether a gate holds sends at all: `allow` (an agent with `approveSubmit: false`) does not. */
export const gatesSends = (gate: BrowserSendGate | undefined): boolean =>
  gate === 'approve' || gate === 'refuse'

/** Decide one request. */
export const decideSend = (request: SendRequest, context: SendContext): SendDecision => {
  if (!gatesSends(context.gate) || !isSend(request)) return { kind: 'flow' }
  if (request.continuesReleased) return { kind: 'flow' }
  if (request.resourceType === 'Ping') return { kind: 'refuse', reason: 'beacon' }
  if (context.gesture === undefined) return { kind: 'refuse', reason: 'background' }
  if (context.gate === 'refuse') return { kind: 'refuse', reason: 'gesture' }
  return context.gesture.exempt ? { kind: 'flow' } : { kind: 'hold' }
}

/** What the agent typed since the page's last navigation, or since the last send that left. */
export interface TypedSince {
  readonly secret: number
  readonly plain: number
}

/**
 * Whether a gesture's sends flow without approval: every value the agent typed
 * came from `credentials`, and it typed at least one.
 */
export const isExemptGesture = (typed: TypedSince): boolean => typed.secret > 0 && typed.plain === 0
