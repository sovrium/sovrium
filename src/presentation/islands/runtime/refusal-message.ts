/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Its own module, apart from `write-refusal.ts`: a shared module ships whole to
// every island that imports it, and the board and the calendar need only this.

/**
 * The sentence a write the records API refused with `400` carries — a table
 * rule's message, say — or `undefined` for any other answer, or a body without
 * one. Read only from a `400`: a 5xx body is never shown.
 */
export async function refusalMessageOf(response: Response): Promise<string | undefined> {
  if (response.status !== 400) return undefined
  const body = (await response.json().catch(() => undefined)) as
    { readonly message?: unknown } | undefined
  return typeof body?.message === 'string' && body.message !== '' ? body.message : undefined
}
