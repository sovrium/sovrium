/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const OLLAMA_PROBE_TIMEOUT_MS = 2000

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
