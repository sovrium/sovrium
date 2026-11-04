/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The listener's idle guard, and the line it leaves when it cuts a request.
 *
 * Bun closes the connection of a request that has gone `idleTimeout` seconds
 * without an answer (10 s unless `SOVRIUM_REQUEST_IDLE_TIMEOUT_S` widens it).
 * The caller sees a reset socket, a reverse proxy a `502`, and Bun itself says
 * so once per PROCESS, in a line that names neither the route nor the time.
 * So every cut is logged here, once per request, with what an operator needs
 * to find the slow route and widen the guard.
 *
 * Bun aborts `request.signal` when it closes the socket, whoever closed it. A
 * request that has already produced its `Response` is never reported — a
 * streamed body or a WebSocket upgrade ends long after its answer — and one
 * closed well before the guard could have fired is the client hanging up, not
 * a cut.
 */

import { logWarning } from '@/infrastructure/logging/logger'

/**
 * How much earlier than the guard a close still counts as a cut. Bun arms its
 * timer when the request's bytes arrive, the handler runs when the event loop
 * gets to it, so on a busy server the handler's own clock starts late and
 * reads a cut as shorter than the guard.
 */
const HANDLER_START_SLACK_MS = 2000

/** What a cut is reported with; the logger by default, a sink in a test. */
type CutReporter = (message: string) => void

/** The one line a cut request leaves in the engine log. */
export const idleCutMessage = (
  method: string,
  path: string,
  elapsedMs: number,
  guardSeconds: number
): string =>
  `[server] request cut after ${String(Math.round(elapsedMs))} ms by the ${String(guardSeconds)} s idle guard: ${method} ${path} (raise SOVRIUM_REQUEST_IDLE_TIMEOUT_S)`

/** The path a request names, without its query, which may carry a token. */
const pathOf = (url: string): string => {
  try {
    return new URL(url, 'http://localhost').pathname
  } catch {
    return url.split('?')[0] ?? url
  }
}

/**
 * Watch one request for a cut by the idle guard, and return the function that
 * marks it answered.
 *
 * Call the returned function the moment the handler has produced its
 * `Response` (or failed): from then on a closed socket is not a cut.
 */
export const watchIdleCut = (
  request: Readonly<Request>,
  guardSeconds: number,
  report: CutReporter = logWarning,
  now: () => number = Date.now
): (() => void) => {
  const startedAt = now()
  const signal = request.signal as AbortSignal | undefined
  if (signal === undefined || signal.aborted) return () => undefined
  const onAbort = (): void => {
    const elapsedMs = now() - startedAt
    if (elapsedMs < guardSeconds * 1000 - HANDLER_START_SLACK_MS) return
    report(idleCutMessage(request.method, pathOf(request.url), elapsedMs, guardSeconds))
  }
  signal.addEventListener('abort', onAbort, { once: true })
  return () => signal.removeEventListener('abort', onAbort)
}

/**
 * Run a request's handler under {@link watchIdleCut}: the watch ends when the
 * handler produces its answer, synchronously or not.
 */
export const withIdleCutWatch = <R>(
  request: Readonly<Request>,
  guardSeconds: number,
  handle: () => R | Promise<R>
): R | Promise<R> => {
  const answered = watchIdleCut(request, guardSeconds)
  try {
    const result = handle()
    if (result instanceof Promise) return result.finally(answered)
    answered()
    return result
  } catch (error) {
    answered()
    throw error
  }
}
