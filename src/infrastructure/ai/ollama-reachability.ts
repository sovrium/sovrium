/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Ollama reachability probe — the I/O half of the `ECO_AI_PROVIDER_PRECEDENCE`
 * resolver. The pure routing rules live in
 * `@/domain/models/env/ai/ai-eco-routing`; this module performs the actual
 * network check and is injected into the resolver (so the domain stays pure
 * and the probe stays trivially mockable).
 *
 * The probe hits `GET ${baseUrl}/api/tags` — Ollama's lightweight model-list
 * endpoint — with a short timeout. Any non-2xx response, network error, or
 * timeout counts as "unreachable".
 */

/** Timeout (ms) for the Ollama reachability probe. Kept short so a down/absent
 * Ollama never stalls server startup or a `/api/health` request. */
const OLLAMA_PROBE_TIMEOUT_MS = 2000

/**
 * Probe whether an Ollama instance is reachable at `baseUrl`. Returns `false`
 * for any failure (DNS, connection refused, non-2xx, timeout) so callers can
 * treat the result as a simple "is the local provider available right now"
 * boolean. `undefined`/empty `baseUrl` is reported as unreachable.
 */
export const probeOllamaReachable = async (baseUrl: string | undefined): Promise<boolean> => {
  const trimmed = baseUrl?.trim()
  if (!trimmed) return false
  const target = `${trimmed.replace(/\/+$/, '')}/api/tags`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OLLAMA_PROBE_TIMEOUT_MS)
  try {
    const response = await fetch(target, { method: 'GET', signal: controller.signal })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * How long a probe result is reused before the endpoint is checked again (ms).
 *
 * Long enough that a dashboard refresh never pays for a probe, short enough
 * that an operator who starts or stops Ollama sees the routing panel catch up
 * within a minute without restarting the server — the same "re-read at request
 * time" expectation the `ECO_*` levers carry.
 */
const OLLAMA_REACHABILITY_TTL_MS = 60_000

/** A memoised probe, keyed by the endpoint it was taken against. */
interface CachedReachability {
  /** The `baseUrl` this result describes; a different one is a cache MISS. */
  readonly baseUrl: string | undefined
  /** Epoch ms after which the result is re-probed. */
  readonly expiresAt: number
  /** The in-flight or settled probe. Stored unresolved so concurrent callers
   * share one round trip instead of each starting their own. */
  readonly result: Promise<boolean>
}

// eslint-disable-next-line functional/no-let -- process-local memo; surviving across requests is the entire point
let cached: CachedReachability | undefined

/**
 * Reachability with a process-local TTL memo — the read path for anything that
 * resolves AI routing on a REQUEST rather than at boot.
 *
 * {@link probeOllamaReachable} is a network round trip bounded by a hard 2s
 * timeout, and against an unreachable endpoint it always spends the full
 * budget: a configured-but-down Ollama is exactly the case where the probe is
 * slowest. Calling it per request puts that stall on every load of a
 * `Cache-Control: no-store` admin dashboard, so the footprint endpoint reads
 * through here instead.
 *
 * Invalidation has two triggers and no others: the TTL elapses, or `baseUrl`
 * changes (an operator repointing `OLLAMA_BASE_URL` must not be answered from
 * a memo taken against the old endpoint). The entry holds the PROMISE, not the
 * boolean, so a burst of concurrent requests during a cold probe collapses to
 * a single round trip rather than N.
 *
 * Deliberately NOT reset between tests: the E2E fixture spawns a fresh server
 * process per spec, so the memo is already scoped to one server's lifetime.
 */
export const getCachedOllamaReachable = (baseUrl: string | undefined): Promise<boolean> => {
  const now = Date.now()
  if (cached !== undefined && cached.baseUrl === baseUrl && cached.expiresAt > now) {
    return cached.result
  }
  // `probeOllamaReachable` resolves `false` on every failure mode rather than
  // rejecting, so a stored promise can never become an unhandled rejection.
  const result = probeOllamaReachable(baseUrl)
  // eslint-disable-next-line functional/no-expression-statements -- writing the memo is the point
  cached = { baseUrl, expiresAt: now + OLLAMA_REACHABILITY_TTL_MS, result }
  return result
}
