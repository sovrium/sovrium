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
 * Redirects are NOT followed unless the caller says so. `redirect` defaults
 * to `'manual'`, so a 3xx comes back as itself: `validateOutboundUrl` judged
 * the first URL only, and a followed redirect would send the request — and
 * its headers — wherever the answer points, unchecked. A caller that fetches
 * a user-influenced URL goes through `guardedFetch`, which re-checks every
 * hop; a caller whose redirects are legitimate and whose target is fixed (the
 * release download, a configured AI endpoint) passes `redirect: 'follow'`.
 *
 * Caller-supplied `init.signal` is intentionally NOT supported in the v1
 * API. None of the current six call sites pass one; if a future caller
 * needs to compose two signals, extend this helper to merge them with
 * `AbortSignal.any([init.signal, controller.signal])` (Bun + Node 20+).
 */
export async function withFetchTimeout(
  input: RequestInfo | URL,
  init: Readonly<Omit<RequestInit, 'signal'>>,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, {
      ...init,
      redirect: init.redirect ?? 'manual',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * `withFetchTimeout` for a response whose BODY is the long part — a download.
 *
 * `withFetchTimeout` clears its timer as soon as the headers arrive, so a peer
 * that answers `200` and then stops sending holds the body read forever. A
 * total deadline is the wrong cure for a download: a 70 MB archive on a slow
 * link legitimately takes minutes, and a cap tight enough to catch a stall
 * would fail an honest slow connection.
 *
 * So this deadline is an INACTIVITY one: the request aborts when `stallMs`
 * passes with no progress — first while waiting for the headers, then between
 * two chunks of the body. Every chunk re-arms the timer. The body is read by
 * `read`, inside the deadline, and the timer is cleared once it settles.
 *
 * The abort errors the body stream, so `read` rejects with the same
 * `AbortError` a timed-out `withFetchTimeout` rejects with.
 */
export async function withFetchStallTimeout<T>(
  input: RequestInfo | URL,
  init: Readonly<Omit<RequestInit, 'signal'>>,
  stallMs: number,
  read: (response: Response) => Promise<T>
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), stallMs)
  try {
    const response = await fetch(input, { ...init, signal: controller.signal })
    timer.refresh()
    const watched =
      response.body === null
        ? response
        : new Response(
            response.body.pipeThrough(
              new TransformStream<Uint8Array, Uint8Array>({
                transform(chunk, stream) {
                  timer.refresh()
                  stream.enqueue(chunk)
                },
              })
            ),
            { status: response.status, statusText: response.statusText, headers: response.headers }
          )
    return await read(watched)
  } finally {
    clearTimeout(timer)
  }
}
