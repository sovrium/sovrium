/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The three requests a pad in flow mode sends, all in the signing session its
 * page's cookie holds: ask for a code, sign, decline. Each answers what the
 * pad does next: the body, or the refusal's contract code (`NOT_FOUND` for
 * every 404: the session is over), or `''` when the request did not complete.
 */

/** A request's outcome: its body, or the code it was refused with. */
export type FlowAnswer<T> =
  { readonly ok: true; readonly body: T } | { readonly ok: false; readonly code: string }

/** A code sent: what to send back with it, where it went, when a new one may be asked. */
export interface FlowChallenge {
  readonly challengeId: string
  readonly destinationHint: string
  readonly resendAfter: string
}

/** The code a refusal names, read from its body when it carries one. */
const refusalCode = async (response: Response): Promise<string> => {
  if (response.status === 404) return 'NOT_FOUND'
  try {
    const body = (await response.json()) as { readonly code?: unknown }
    return typeof body.code === 'string' ? body.code : ''
  } catch {
    return ''
  }
}

/** Send `init` to `path` and read its answer. */
const send = async <T>(path: string, init: RequestInit): Promise<FlowAnswer<T>> => {
  try {
    const response = await fetch(path, { ...init, credentials: 'same-origin' })
    if (!response.ok) return { ok: false, code: await refusalCode(response) }
    return { ok: true, body: (await response.json()) as T }
  } catch {
    return { ok: false, code: '' }
  }
}

/** Ask for a code on `channel`. */
export const requestFlowCode = (channel: string): Promise<FlowAnswer<FlowChallenge>> =>
  send('/api/signatures/challenge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel }),
  })

/** What a signature sends: the mark, and the code when the flow asked for one. */
export interface FlowSignature {
  readonly method: 'drawn' | 'typed'
  readonly typedName?: string
  readonly image?: Blob
  readonly challenge?: { readonly challengeId: string; readonly code: string }
}

/** Sign: pressing Sign is the consent, so it is always sent. */
export const postFlowSignature = (
  signature: FlowSignature
): Promise<FlowAnswer<{ readonly signedAt: string }>> => {
  const body = new FormData()
  body.append('consent', 'true')
  body.append('method', signature.method)
  if (signature.typedName !== undefined) body.append('typedName', signature.typedName)
  if (signature.image !== undefined) body.append('image', signature.image, 'signature.png')
  if (signature.challenge !== undefined) {
    body.append('challengeId', signature.challenge.challengeId)
    body.append('code', signature.challenge.code)
  }
  return send('/api/signatures/sign', { method: 'POST', body })
}

/** Decline, with the reason when one was given. */
export const postFlowDecline = (reason: string): Promise<FlowAnswer<unknown>> =>
  send('/api/signatures/decline', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(reason.trim() === '' ? {} : { reason: reason.trim() }),
  })
