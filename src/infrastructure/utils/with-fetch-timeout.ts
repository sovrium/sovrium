/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Wrap a `fetch` call with a hard timeout via `AbortController` + `setTimeout`.
 *
 * Six identical copies of this pattern were scattered across the codebase
 * (CLI updater, OAuth code exchange + refresh, webhook dispatcher, two
 * automation action handlers). Consolidating the boilerplate here removes
 * ~30 lines of duplication and ensures that `clearTimeout` always runs in
 * the `finally` block — even on the error path — without the caller having
 * to remember it.
 *
 * The timeout fires `controller.abort()` after `timeoutMs`. When that races
 * with a slow upstream, `fetch` rejects with an `AbortError`; callers
 * surface this through their own error mapping (each call site has its own
 * tagged error / discriminated union).
 *
 * Composition with `validateOutboundUrl`:
 *   const validation = validateOutboundUrl(url)
 *   if (!validation.ok) return failureFor(validation.issue)
 *   const response = await withFetchTimeout(validation.url, init, timeoutMs)
 *
 * Caller-supplied `init.signal` is intentionally NOT supported in the v1
 * API. None of the current six call sites pass one; if a future caller
 * needs to compose two signals, extend this helper to merge them with
 * `AbortSignal.any([init.signal, controller.signal])` (Bun + Node 20+).
 */
export async function withFetchTimeout(
  // eslint-disable-next-line functional/prefer-immutable-types -- RequestInfo and URL are Web standard interfaces with setters; immutability lint can't prove our consumers don't mutate them. We don't.
  input: RequestInfo | URL,
  init: Omit<RequestInit, 'signal'>,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
