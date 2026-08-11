/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Bootstrap-token attachment for the startup banner.
 *
 * Extracted from `server.ts` so the renderer composition stays under the
 * per-file `max-lines` cap. The bootstrap-token surface is a self-contained
 * concern: a `⚠ No admin user …` warning phase prepended to the existing
 * phase list, plus a `BootstrapTokenBanner` attachment that
 * `renderStartupSummary` turns into a `→ First-admin token (POST …)` +
 * indented plaintext footer pair.
 *
 * The plaintext is rendered EXACTLY ONCE and is never routed through the
 * persistent structured logger.
 */

import type { StartupPhase } from '@/infrastructure/logging/startup-summary'

/**
 * One-time bootstrap-token TTL in minutes — kept in sync with
 * `BOOTSTRAP_TOKEN_TTL_MS` in `bootstrap-token.ts` (60 * 60 * 1000 ms = 60 min).
 * Hardcoded here so the banner copy is self-contained.
 */
const BOOTSTRAP_TOKEN_TTL_MINUTES = 60

/**
 * `POST` endpoint to surface in the startup banner. Matches the route
 * Better Auth's bootstrap claim handler is mounted at
 * (`src/infrastructure/server/route-setup/bootstrap-routes.ts`).
 */
const BOOTSTRAP_CLAIM_ENDPOINT = '/api/admin/bootstrap/claim'

/**
 * The shape `renderStartupSummary` consumes for the optional `bootstrapToken`
 * attachment. Mirrors `BootstrapTokenBanner` in `logger.ts`.
 */
export interface BootstrapTokenAttachment {
  readonly plaintext: string
  readonly claimEndpoint: string
  readonly expiresInMinutes: number
}

/**
 * Combined output of `applyBootstrapTokenToSummary` — the (possibly modified)
 * phase list and the optional token attachment.
 */
export interface BootstrapTokenSummaryParts {
  readonly phases: readonly StartupPhase[]
  readonly bootstrapToken?: BootstrapTokenAttachment
}

/**
 * Build the bootstrap-token-aware phase list and banner attachment for
 * `renderStartupSummary`. When `bootstrapToken` is defined, prepends a
 * `⚠ No admin user …` warning and attaches the token banner footer.
 * Returns the unchanged phase list and no attachment otherwise.
 */
export const applyBootstrapTokenToSummary = (
  phases: readonly StartupPhase[],
  bootstrapToken: string | undefined
): BootstrapTokenSummaryParts => {
  if (!bootstrapToken) return { phases }
  const warning: StartupPhase = {
    label: 'No admin user — claim one within 1 hour with the token below',
    type: 'warning' as const,
  }
  return {
    phases: [warning, ...phases],
    bootstrapToken: {
      plaintext: bootstrapToken,
      claimEndpoint: BOOTSTRAP_CLAIM_ENDPOINT,
      expiresInMinutes: BOOTSTRAP_TOKEN_TTL_MINUTES,
    },
  }
}
