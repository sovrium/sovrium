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
  parseSchemaContent,
} from '@/domain/utils'
import { validateOutboundUrl } from '@/infrastructure/utils/validate-outbound-url'
import type { AppEncoded } from '@/domain/models/app'

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
 * @throws Error if the URL is a blocked outbound target, the fetch fails, or
 *   the content cannot be parsed.
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
    const response = await fetch(validation.url)

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
