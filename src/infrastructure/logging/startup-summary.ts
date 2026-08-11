/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Effect } from 'effect'
import {
  type CliBlock,
  type CliLine,
  formatDuration,
  renderDocument,
} from '@/infrastructure/logging/cli-output'

/**
 * Re-exported so the many `formatDuration` importers (notably
 * `src/cli/commands/build.ts`) keep their existing specifier. The
 * implementation moved to `cli-output.ts` because duration formatting is
 * terminal vocabulary, not a startup concern.
 */
export { formatDuration }

/**
 * Startup / build banner rendering.
 *
 * Split out of `logger.ts` so the structured logging service and the
 * human-facing `sovrium start` / `sovrium build` banner stay separate concerns.
 * The exact banner output (glyphs, indent, grouping) is asserted byte-for-byte
 * by the `[internal ref]` suite.
 */

/**
 * A single phase in the startup sequence
 */
export interface StartupPhase {
  readonly label: string
  readonly detail?: string
  readonly type: 'success' | 'warning' | 'skip'
}

/**
 * One-time bootstrap-token banner attachment.
 *
 * Set on `StartupSummary` only when `runBootstrapTokenFlow` actually generated
 * a fresh token (no users + no AUTH_ADMIN_EMAIL). When present the renderer
 * appends a second `→` footer line below the URL with the plaintext token so
 * the operator can copy it for the one-time `POST /api/admin/bootstrap/claim`
 * exchange. The plaintext is rendered EXACTLY ONCE — it is never logged via
 * the structured logger because that surface persists.
 */
export interface BootstrapTokenBanner {
  readonly plaintext: string
  readonly claimEndpoint: string
  readonly expiresInMinutes: number
}

/**
 * Summary of all startup phases, rendered as clean structured output
 */
export interface StartupSummary {
  readonly version: string
  readonly phases: readonly StartupPhase[]
  readonly url: string
  readonly durationMs: number
  /**
   * Optional one-time bootstrap-token attachment. Present only on the boot
   * where {@link runBootstrapTokenFlow} generates a fresh token; absent on
   * every subsequent boot once at least one user exists or AUTH_ADMIN_EMAIL
   * is set. See {@link BootstrapTokenBanner}.
   */
  readonly bootstrapToken?: BootstrapTokenBanner
}

/**
 * Render a clean startup summary to the console
 *
 * Output format:
 * ```
 *   Sovrium v0.2.0
 *
 *   ⚠ Warning message
 *
 *   ✓ Success phase
 *   ✓ Server ready in 320ms
 *
 *   → http://localhost:3000
 * ```
 *
 * When the summary carries a {@link BootstrapTokenBanner}, the renderer appends
 * a second `→` footer pair (`→ First-admin token (POST …):` + an indented
 * plaintext line wrapped to its own row so the 64-hex token clears 80 columns).
 */
export const renderStartupSummary = (summary: StartupSummary): Effect.Effect<void> =>
  renderSummary({
    version: summary.version,
    phases: summary.phases,
    footer: summary.url,
    ...(summary.bootstrapToken ? { bootstrapToken: summary.bootstrapToken } : {}),
  })

/**
 * Shared renderer behind both {@link renderStartupSummary} and
 * {@link renderBuildSummary}: a `Sovrium vX.Y.Z` header, grouped `⚠` warnings
 * then `✓` successes, and a trailing `→ <footer>` line.
 *
 * Centralising the format here is what guarantees `sovrium start` and
 * `sovrium build` stay visually identical — same indent, glyphs, and grouping.
 */
const summaryBlocks = (params: {
  readonly version: string
  readonly phases: readonly StartupPhase[]
  readonly footer: string
  readonly bootstrapToken?: BootstrapTokenBanner
}): readonly CliBlock[] => {
  // The ⚠-before-✓ regrouping is a STARTUP semantic, not a document one, so it
  // lives here rather than in `formatDocument`. Asserted end-to-end by
  // `warning-display-and-security-gating.spec.ts`.
  const warnings: CliBlock = params.phases
    .filter((phase) => phase.type === 'warning')
    .map((phase) => ({ glyph: 'warn' as const, text: phase.label }))

  const successes: CliBlock = params.phases
    .filter((phase) => phase.type === 'success')
    .map((phase) => ({ glyph: 'ok' as const, text: phase.label }))

  // Footer: server URL (start) or output directory (build), plus the one-time
  // bootstrap token when a fresh one was generated this boot. The token gets its
  // own `detail` row so the 64-hex value clears 80 columns — the fixture's
  // `BOOTSTRAP_TOKEN_RE` matches "first-admin token" + 64 hex across whitespace
  //, so the split is load-bearing.
  const token: readonly CliLine[] = params.bootstrapToken
    ? [
        {
          glyph: 'at' as const,
          text: `First-admin token (POST ${params.bootstrapToken.claimEndpoint}):`,
          detail: [params.bootstrapToken.plaintext],
        },
      ]
    : []

  return [
    [{ text: `Sovrium v${params.version}` }],
    warnings,
    successes,
    [{ glyph: 'at' as const, text: params.footer }, ...token],
  ]
}

const renderSummary = (params: {
  readonly version: string
  readonly phases: readonly StartupPhase[]
  readonly footer: string
  readonly bootstrapToken?: BootstrapTokenBanner
}): Effect.Effect<void> => renderDocument(summaryBlocks(params))

/**
 * Summary of a completed static build, rendered with the same banner as the
 * server-start summary. The `outputDir` becomes the `→` footer line (where the
 * server-start banner shows its URL).
 */
export interface BuildSummary {
  readonly version: string
  readonly phases: readonly StartupPhase[]
  readonly outputDir: string
}

/**
 * Render a completed build summary using the shared start/build banner.
 */
export const renderBuildSummary = (summary: BuildSummary): Effect.Effect<void> =>
  renderSummary({ version: summary.version, phases: summary.phases, footer: summary.outputDir })
