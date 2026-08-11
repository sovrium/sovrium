/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Demo-context-notice environment configuration.
 *
 * Env vars: SOVRIUM_DEMO_NOTICE, SOVRIUM_DEMO_URL, SOVRIUM_DEMO_EMAIL,
 * SOVRIUM_DEMO_PASSWORD.
 *
 * ## Why env and NOT AppSchema
 *
 * Sovrium publishes its template apps as live demos at
 * `https://<slug>.demo.sovrium.com`. Those demos run the SAME `app.yaml` that
 * `sovrium init --template <slug>` clones into a user's own repository — the
 * template directory IS the distributed artifact. A config-baked notice would
 * therefore ship to every user's production app asserting "data resets nightly"
 * and "sign in with demo@sovrium.com", both false for their app.
 *
 * The notice describes the HOSTING ENVIRONMENT, not the application, so per the
 * standing infra/app split it lives in env vars the demo fleet writes at deploy
 * time and no template ever carries. There is deliberately no `app.demo.*`
 * schema field, and adding one would reintroduce the leak.
 *
 * ## Polarity — INVERSE of the badge
 *
 * `BadgeSchema` is positive-polarity (shown unless `badge: false`). This notice
 * is the opposite: **off unless an operator explicitly turns it on**. A notice
 * that appeared by default would announce "this is a throwaway demo, data is
 * wiped nightly" on real production deployments — a far worse failure than a
 * demo that forgot its notice. Opt-in is the safe default.
 *
 * ## Credential separation is a security boundary
 *
 * `SOVRIUM_DEMO_EMAIL` / `SOVRIUM_DEMO_PASSWORD` are display-only strings and
 * are deliberately SEPARATE variables from the real `AUTH_ADMIN_EMAIL` /
 * `AUTH_ADMIN_PASSWORD` bootstrap credentials. The renderer must read ONLY the
 * `SOVRIUM_DEMO_*` pair. Because the real credentials are never in scope for
 * this model, it is structurally impossible to leak a production admin password
 * by enabling the notice on a production instance — the worst case is that the
 * notice renders with no credentials block at all.
 *
 * Never widen this struct to read `AUTH_ADMIN_*`.
 */
export const DemoNoticeEnvSchema = Schema.Struct({
  notice: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description:
          'Master switch for the demo context notice (SOVRIUM_DEMO_NOTICE). Unset means no notice.',
        examples: ['on'],
      })
    )
  ),
  name: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description:
          'Optional template display name (SOVRIUM_DEMO_NAME). Sets the panel title to `<name> demo` / `Démo <name>`; unset (or empty) falls back to the brand title.',
        examples: ['CRM'],
      })
    )
  ),
  url: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Target of the notice "more info" call to action (SOVRIUM_DEMO_URL)',
        examples: ['https://sovrium.com/apps/crm'],
      })
    )
  ),
  email: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description:
          'Display-only demo sign-in email (SOVRIUM_DEMO_EMAIL). NEVER sourced from AUTH_ADMIN_EMAIL.',
        examples: ['demo@sovrium.com'],
      })
    )
  ),
  password: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description:
          'Display-only demo sign-in password (SOVRIUM_DEMO_PASSWORD). NEVER sourced from AUTH_ADMIN_PASSWORD.',
        examples: ['demo'],
      })
    )
  ),
})

export type DemoNoticeEnvConfig = Schema.Schema.Type<typeof DemoNoticeEnvSchema>

/**
 * Values that turn the notice on, compared case-insensitively after trimming.
 * Everything else — including the empty string — leaves it off.
 *
 * The empty string must resolve to OFF because the E2E harness inherits every
 * `SOVRIUM_*` variable from the parent shell into the spawned test server. A
 * spec asserting the notice is absent neutralizes a leaked parent value by
 * passing `SOVRIUM_DEMO_NOTICE: ''`, which only works if empty means off.
 */
const ENABLED_VALUES: ReadonlySet<string> = new Set(['on', 'true', '1', 'yes'])

/**
 * Read the demo-notice configuration from an env snapshot. Defaults to
 * `process.env`; specs and unit tests pass an explicit snapshot so the parser
 * stays a pure, directly testable function.
 */
export const parseDemoNoticeEnvConfig = (
  processEnv: Readonly<Record<string, string | undefined>> = process.env
): DemoNoticeEnvConfig =>
  Schema.decodeUnknownSync(DemoNoticeEnvSchema)({
    notice: processEnv['SOVRIUM_DEMO_NOTICE'],
    name: processEnv['SOVRIUM_DEMO_NAME'],
    url: processEnv['SOVRIUM_DEMO_URL'],
    email: processEnv['SOVRIUM_DEMO_EMAIL'],
    password: processEnv['SOVRIUM_DEMO_PASSWORD'],
  })

/**
 * Single source of truth for the notice's opt-in polarity: rendered only when
 * `SOVRIUM_DEMO_NOTICE` explicitly carries an enabling value.
 *
 * Every injection point (dynamic page, default homepage, standalone and closed
 * form documents, static error fallbacks) resolves visibility through this one
 * predicate — mirroring `isBadgeEnabled` — so the polarity can never drift
 * apart across surfaces.
 *
 * The error fallbacks reach it INDIRECTLY: `NotFoundPage` / `ErrorPage` render
 * through `DynamicPage` without passing `demoNoticeEnabled`, and undefined means
 * "let the env decide". Note the corollary — because those two components take
 * no props they cannot pass `false` either, so an operator-console 404/500
 * (authorized admin on an unmatched `/_admin/*` sub-path, whose embedded config
 * defines no `/404`) is the one surface where the console carve-out does not
 * reach. Closing that needs a prop threaded from `render-error-pages.tsx`.
 */
export const isDemoNoticeEnabled = (config: DemoNoticeEnvConfig): boolean => {
  const raw = config.notice?.trim().toLowerCase()
  return raw !== undefined && ENABLED_VALUES.has(raw)
}

/**
 * True when BOTH display credentials are present and non-empty.
 *
 * Three shipped demo templates (`hello-world`, `landing-page`, `docs-site`) have
 * no auth at all, so the deploy script simply omits the pair for them and the
 * notice degrades to its no-credentials form. Partial configuration (email
 * without password) is treated as absent rather than rendering a half-filled
 * credentials block.
 */
export const hasDemoCredentials = (config: DemoNoticeEnvConfig): boolean =>
  (config.email?.trim() ?? '') !== '' && (config.password?.trim() ?? '') !== ''

/**
 * The template display name (`SOVRIUM_DEMO_NAME`), trimmed, or `undefined` when
 * it is unset or blank whitespace. When present it takes the panel title slot
 * (`<name> demo` / `Démo <name>`); when absent the title falls back to the
 * brand (`Sovrium demo` / `Démo Sovrium`).
 *
 * The empty string must resolve to `undefined` for the same parent-shell
 * inheritance reason as {@link isDemoNoticeEnabled}: the E2E harness inherits
 * every `SOVRIUM_*` variable from the parent shell into the spawned test server,
 * so the brand-fallback spec passes `SOVRIUM_DEMO_NAME: ''` to neutralize a
 * leaked value — which only works if empty means unset. The name itself is never
 * translated; only the surrounding title template is localized.
 */
export const resolveDemoName = (config: DemoNoticeEnvConfig): string | undefined => {
  const trimmed = config.name?.trim() ?? ''
  return trimmed === '' ? undefined : trimmed
}
