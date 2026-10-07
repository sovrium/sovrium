/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The password sign-in a page is still waiting on, so the second-factor step
 * on the same page can wait for it.
 *
 * The code is checked against the challenge the password step opens — a
 * short-lived cookie its response sets. A code submitted while that response
 * is still on its way would reach the server without the cookie and be refused
 * as if the reader had no challenge at all. Every auth form on a page runs in
 * the same module instance, so the password step records its request here and
 * the code step awaits it before sending.
 */

let inFlight: Promise<unknown> = Promise.resolve()

/** Record a sign-in request; answers it unchanged. */
export function trackSignIn<T>(request: Promise<T>): Promise<T> {
  inFlight = request.catch(() => undefined)
  return request
}

/** Resolves once no sign-in started on this page is still in flight. */
export const afterSignIn = (): Promise<unknown> => inFlight
