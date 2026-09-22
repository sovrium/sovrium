/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { SystemDetailSource } from '@/domain/models/app/pages/components/system-detail-source'

/**
 * Build a system DETAIL-endpoint URL: substitute the bound id into the
 * endpoint's `:param` placeholder (default `:id`) and append any static
 * `system.query` params.
 *
 * ─── WHY THIS IS DOMAIN CODE AND NOT AN ISLAND HELPER ──────────────────────
 *
 * It was an island hook helper while the only caller was the browser. Since
 * `[internal ref]` the RENDERER
 * resolves the same binding server-side — and `presentation-rendering` may not
 * import `presentation-island`, so the choice was a shared home or a second
 * copy. A second copy of an id-injection rule is a copy that can disagree with
 * itself about what a detail URL is, and the two halves would then fetch
 * different records from the same declaration.
 *
 * Pure string work over a domain type, so it belongs here rather than in either
 * consumer.
 */
export function buildDetailEndpointUrl(system: SystemDetailSource, id: string): string {
  const placeholder = `:${system.param ?? 'id'}`
  const path = system.endpoint.includes(placeholder)
    ? system.endpoint.replace(placeholder, encodeURIComponent(id))
    : system.endpoint
  const params = new URLSearchParams()
  Object.entries(system.query ?? {}).forEach(([key, value]) => {
    params.set(key, String(value))
  })
  const suffix = params.toString()
  return `${path}${suffix ? `?${suffix}` : ''}`
}
