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
 * Displayed in the banner when a config declares no `version`.
 *
 * BANNER CHROME ONLY — a render-site substitution, never a schema default.
 * `app.version` stays absent everywhere else, and four consumers stand a
 * different value in for it on purpose: this banner shows `1.0.0`, the MCP
 * server reports `0.0.0`, the instance facts keep `null` because a config gate
 * reads the absence itself, and the published JSON Schema declares no default
 * at all. Moving the substitution onto `VersionSchema` would silently change
 * all four. in `[internal ref]`.
 */
const BANNER_DEFAULT_APP_VERSION = '1.0.0'

/**
 * The application's own identity, printed as the banner's opening rows.
 *
 * The engine is a qualifier here, never the subject: with several servers
 * running on distinct ports, a header naming only Sovrium identifies every
 * terminal identically — the app is what tells them apart.
 *
 * `description` occupies its OWN row rather than being joined to the header.
 * `DescriptionSchema` admits any non-newline text, so a joined
 * `<name> v<ver> — <description>` would put a second dash on the row for any
 * description that contains one — and Sovrium's own `src/admin/app.ts` ships
 * exactly that, so the render site cannot control the dash count.
 */
/*
 * `| undefined` is spelled explicitly so a caller can forward an absent
 * `app.version` / `app.description` straight through, rather than each one
 * re-deriving a conditional spread. Both absences are decided HERE — the
 * version by {@link BANNER_DEFAULT_APP_VERSION}, the description by the
 * truthiness gate in `summaryBlocks` — which is what keeps the two rules
 * stated once instead of once per caller.
 */
export interface BannerAppIdentity {
  readonly name: string
  readonly version?: string | undefined
  readonly description?: string | undefined
}

/**
 * Summary of all startup phases, rendered as clean structured output
 */
export interface StartupSummary {
  /**
   * The booted application. REQUIRED, so no caller can quietly fall back to a
   * banner that names only the engine.
   */
  readonly app: BannerAppIdentity
  readonly version: string
  readonly phases: readonly StartupPhase[]
  readonly url: string
  readonly durationMs: number
  /**
   * The operator console's sign-in address, when there is one worth printing.
   *
   * Present only when the console is SERVED and the app declares `auth` — the
   * two conditions that make the address a door someone can walk through
   * rather than one with no key. The decision belongs to the server
   * (`adminConsoleLocator` in `server.ts`); this type carries the answer, never
   * the reasoning.
   */
  readonly adminConsoleUrl?: string
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
 *   my-app v1.0.0 (Sovrium v0.2.0)
 *   A CRM workspace for contacts and deals.
 *
 *   ⚠ Warning message
 *
 *   ✓ Success phase
 *   ✓ Server ready in 320ms
 *
 *   → http://localhost:3000
 *   → Admin console: http://localhost:3000/_admin/login
 * ```
 *
 * The header block opens with the app the process just booted, the engine
 * version qualifying it in parentheses. The description row appears only when
 * the config declares one; both rows sit in ONE block, so the blank line below
 * them closes the pair rather than separating them.
 *
 * The footer is a BLOCK of locators, in a fixed order: the bare server URL, the
 * operator console's sign-in address when one is worth printing, then the
 * one-time bootstrap token when a fresh one was minted. They are one block
 * because they are one subject — where this server is — and a locator that
 * drifted above the timing rows would stop reading as another door into the
 * same process ([internal ref] asserts the adjacency, not merely the
 * presence).
 *
 * When the summary carries a {@link BootstrapTokenBanner}, the renderer appends
 * a further `→` footer pair (`→ First-admin token (POST …):` + an indented
 * plaintext line wrapped to its own row so the 64-hex token clears 80 columns).
 */
export const renderStartupSummary = (summary: StartupSummary): Effect.Effect<void> =>
  renderSummary({
    app: summary.app,
    version: summary.version,
    phases: summary.phases,
    footer: summary.url,
    ...(summary.adminConsoleUrl ? { adminConsoleUrl: summary.adminConsoleUrl } : {}),
    ...(summary.bootstrapToken ? { bootstrapToken: summary.bootstrapToken } : {}),
  })

/**
 * Shared renderer behind both {@link renderStartupSummary} and
 * {@link renderBuildSummary}: an `<app> vX.Y.Z (Sovrium vX.Y.Z)` identity header
 * with an optional description row beneath it, grouped `⚠` warnings then `✓`
 * successes, and a trailing `→ <footer>` line.
 *
 * Centralising the format here is what guarantees `sovrium start` and
 * `sovrium build` stay visually identical — same indent, glyphs, and grouping.
 * It is also the single site where {@link BANNER_DEFAULT_APP_VERSION} stands in
 * for an absent `app.version`, which is what keeps that substitution out of the
 * schema and away from the three other consumers that read the absence.
 */
const summaryBlocks = (params: {
  readonly app: BannerAppIdentity
  readonly version: string
  readonly phases: readonly StartupPhase[]
  readonly footer: string
  readonly adminConsoleUrl?: string
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

  // Footer: server URL (start) or output directory (build), then the console
  // locator, then the one-time bootstrap token when a fresh one was generated
  // this boot.
  //
  // The console row sits DIRECTLY under the bare URL because the two are one
  // fact — the addresses of this server — and an operator scanning for "where
  // do I sign in" reads them together. `Admin console:` is a T9 locator label:
  // a noun and a value, never a verb.
  const adminConsole: readonly CliLine[] = params.adminConsoleUrl
    ? [{ glyph: 'at' as const, text: `Admin console: ${params.adminConsoleUrl}` }]
    : []

  // The token gets its own `detail` row so the 64-hex value clears 80 columns —
  // the fixture's `BOOTSTRAP_TOKEN_RE` matches "first-admin token" + 64 hex
  // across whitespace, so the split is
  // load-bearing.
  const token: readonly CliLine[] = params.bootstrapToken
    ? [
        {
          glyph: 'at' as const,
          text: `First-admin token (POST ${params.bootstrapToken.claimEndpoint}):`,
          detail: [params.bootstrapToken.plaintext],
        },
      ]
    : []

  // Identity header: the app first, the engine as a parenthesised qualifier.
  //
  // The gate on `description` is TRUTHINESS, not `!== undefined`: an empty
  // string is a valid `DescriptionSchema` value, and emitting a row for it
  // would put a blank line immediately above the block's own closing blank —
  // a double blank, which the banner document format forbids.
  const appVersion = params.app.version ?? BANNER_DEFAULT_APP_VERSION
  const header: CliBlock = [
    { text: `${params.app.name} v${appVersion} (Sovrium v${params.version})` },
    ...(params.app.description ? [{ text: params.app.description }] : []),
  ]

  return [
    header,
    warnings,
    successes,
    [{ glyph: 'at' as const, text: params.footer }, ...adminConsole, ...token],
  ]
}

const renderSummary = (params: {
  readonly app: BannerAppIdentity
  readonly version: string
  readonly phases: readonly StartupPhase[]
  readonly footer: string
  readonly adminConsoleUrl?: string
  readonly bootstrapToken?: BootstrapTokenBanner
}): Effect.Effect<void> => renderDocument(summaryBlocks(params))

/**
 * Summary of a completed static build, rendered with the same banner as the
 * server-start summary. The `outputDir` becomes the `→` footer line (where the
 * server-start banner shows its URL).
 */
export interface BuildSummary {
  /** The application that was built. Same identity rows as `sovrium start`. */
  readonly app: BannerAppIdentity
  readonly version: string
  readonly phases: readonly StartupPhase[]
  readonly outputDir: string
}

/**
 * Render a completed build summary using the shared start/build banner.
 */
export const renderBuildSummary = (summary: BuildSummary): Effect.Effect<void> =>
  renderSummary({
    app: summary.app,
    version: summary.version,
    phases: summary.phases,
    footer: summary.outputDir,
  })
