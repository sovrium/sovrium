/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Remote Loader - Infrastructure Layer
 *
 * Network I/O operations for fetching schemas from remote URLs.
 */

import {
  detectFormatFromContentType,
  detectFormatFromUrl,
} from '@/domain/kernel/config-parsing/format-detection'
import { parseSchemaContent } from '@/domain/models/app/app-content-parsing'
import { fetchFollowingRedirects } from '@/infrastructure/egress/follow-redirects'
import { validateOutboundUrl } from '@/infrastructure/egress/validate-outbound-url'
import type { AppEncoded } from '@/domain/models/app'

/**
 * Deadline for the remote schema fetch (standing rule E6).
 *
 * This runs at BOOT, before the listener binds, so an unbounded fetch here is
 * a server that never finishes starting and never says why — the worst shape a
 * hang can take, because a supervisor sees a process that is alive and a port
 * that never opens. 15 s is generous for a config document (a few KB over
 * HTTPS) and short enough that the failure is legible as a failure.
 */
const REMOTE_SCHEMA_FETCH_TIMEOUT_MS = 15_000

/**
 * Fetch and parse schema from a remote URL.
 *
 * SSRF guard: an `APP_SCHEMA` URL is an attacker-influenceable input on a
 * deployment that loads its schema remotely, so the target is validated
 * BEFORE any `fetch`. Private / loopback / link-local hosts (cloud metadata,
 * RFC1918, 127.0.0.0/8) are rejected and the fetch never happens. SSRF
 * guarding is always on and relaxes only under the explicit
 * `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1` opt-out. Uses the discriminated-union
 * result, matching `webhooks/dispatcher.ts`.
 *
 * REDIRECTS ARE HOPS, and each one is decided afresh. The guard above runs once,
 * on the URL in `APP_SCHEMA`, and `fetch` would otherwise follow up to twenty
 * redirects with nothing in front of any of them — so the schema a deployment
 * boots on was chosen by whoever controlled the last hop. `fetchFollowingRedirects`
 * re-applies the guard, requires https of every hop, and caps the chain; the same
 * helper `init --from-url` uses, because the two must not be able to disagree about
 * which documents may become an application.
 *
 * @throws Error if the URL is a blocked outbound target, a redirect hop is
 *   refused, the fetch fails, or the content cannot be parsed.
 */
export const fetchRemoteSchema = async (url: string): Promise<AppEncoded> => {
  const validation = validateOutboundUrl(url)
  if (!validation.ok) {
    // eslint-disable-next-line functional/no-throw-statements -- boot-time SSRF rejection must fail loud (message contains "outbound" + the structured reason so it is greppable and operator-actionable)
    throw new Error(
      `Blocked outbound schema URL ${url}: ${validation.issue.reason} targets are not allowed (SSRF guard). ` +
        `Set SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1 to permit private/loopback outbound targets.`
    )
  }
  try {
    // No retry: a boot that silently takes three times as long to fail is
    // worse than one that fails once and says so, and the operator restarting
    // the process is the retry.
    const fetched = await fetchFollowingRedirects(validation.url, REMOTE_SCHEMA_FETCH_TIMEOUT_MS)
    if (!fetched.ok) {
      // eslint-disable-next-line functional/no-throw-statements -- a refused hop must fail boot loudly, for the same reason the SSRF rejection above does
      throw new Error(fetched.message)
    }
    const { response } = fetched

    if (!response.ok) {
      // eslint-disable-next-line functional/no-throw-statements
      throw new Error(`Failed to fetch schema from ${url}: HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''
    const content = await response.text()

    // Try to detect format from Content-Type header, then URL extension
    const format = detectFormatFromContentType(contentType) || detectFormatFromUrl(url)

    return parseSchemaContent(content, format)
  } catch (error) {
    // eslint-disable-next-line functional/no-throw-statements
    throw new Error(
      `Failed to fetch or parse schema from ${url}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
