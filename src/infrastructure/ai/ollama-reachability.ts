/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Ollama reachability probe — the I/O half of the `ECO_AI_PROVIDER_PRECEDENCE`
 * resolver. The pure routing rules live in
 * `@/domain/models/env/ai-eco-routing`; this module performs the actual
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
