/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Dev-mode notice environment configuration.
 *
 * Env vars: SOVRIUM_DEV_MODE, SOVRIUM_DEV_NAME, SOVRIUM_DEV_URL,
 * SOVRIUM_DEV_EMAIL, SOVRIUM_DEV_PASSWORD. `sovrium dev` sets all five for its
 * session (an ambient value winning key by key); a hosted demo sets them per
 * app at deploy time. The older `SOVRIUM_DEMO_*` names are no longer read.
 *
 * SOVRIUM_DEV_PUBLIC is the sixth, and the only one `sovrium dev` never sets:
 * an operator's statement that a dev-mode instance is reachable at a public
 * address on purpose (a hosted preview). See {@link isDevPublicEnabled}.
 *
 * ## Why env and NOT AppSchema
 *
 * The panel describes the ENVIRONMENT an app runs in, not the app. The same
 * `app.yaml` runs in a developer's `sovrium dev` session, in a hosted demo and
 * in production, so a config-baked panel would ship "sign in with this pair"
 * and "data is disposable" into every production app built from that config.
 * There is deliberately no `app.dev.*` schema field, and adding one would
 * reintroduce the leak.
 *
 * Not to be confused with `dev-mode.ts`, which holds the `NODE_ENV` predicates:
 * this module is the panel's switch, that one is the runtime's posture.
 *
 * ## Polarity — INVERSE of the badge
 *
 * `BadgeSchema` is positive-polarity (shown unless `badge: false`). This notice
 * is the opposite: **off unless an operator explicitly turns it on**. A panel
 * that appeared by default would announce "data on this instance is
 * disposable" on real production deployments. Opt-in is the safe default.
 *
 * ## Credential separation is a security boundary
 *
 * `SOVRIUM_DEV_EMAIL` / `SOVRIUM_DEV_PASSWORD` are display-only strings and
 * are deliberately SEPARATE variables from the real `AUTH_ADMIN_EMAIL` /
 * `AUTH_ADMIN_PASSWORD` bootstrap credentials. The renderer must read ONLY the
 * `SOVRIUM_DEV_*` pair. Because the real credentials are never in scope for
 * this model, it is structurally impossible to leak a production admin password
 * by enabling the notice on a production instance — the worst case is that the
 * notice renders with no credentials block at all.
 *
 * Never widen this struct to read `AUTH_ADMIN_*`.
 */
export const DevNoticeEnvSchema = Schema.Struct({
  mode: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'Master switch for dev mode (SOVRIUM_DEV_MODE). Unset means no notice.',
        examples: ['on'],
      })
    )
  ),
  name: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Optional display name (SOVRIUM_DEV_NAME). Sets the panel title to `<name> — development` / `<name> — développement`; unset (or empty) falls back to `Dev mode` / `Mode dev`.',
        examples: ['CRM'],
      })
    )
  ),
  url: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'Target of the notice "learn more" call to action (SOVRIUM_DEV_URL)',
        examples: ['https://sovrium.com/en/docs'],
      })
    )
  ),
  email: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Display-only sign-in email (SOVRIUM_DEV_EMAIL). NEVER sourced from AUTH_ADMIN_EMAIL.',
        examples: ['admin@crm.local'],
      })
    )
  ),
  password: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Display-only sign-in password (SOVRIUM_DEV_PASSWORD). NEVER sourced from AUTH_ADMIN_PASSWORD.',
        examples: ['sovrium-dev-password'],
      })
    )
  ),
  public: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Says a dev-mode instance is public on purpose (SOVRIUM_DEV_PUBLIC): no boot warning, and the instance keeps itself out of search indexes. Ignored unless dev mode is on.',
        examples: ['on'],
      })
    )
  ),
})

export type DevNoticeEnvConfig = Schema.Schema.Type<typeof DevNoticeEnvSchema>

/**
 * Values that turn dev mode on, compared case-insensitively after trimming.
 * Everything else — including the empty string — leaves it off.
 *
 * The empty string must resolve to OFF because the E2E harness inherits every
 * `SOVRIUM_*` variable from the parent shell into the spawned test server. A
 * spec asserting the notice is absent neutralizes a leaked parent value by
 * passing `SOVRIUM_DEV_MODE: ''`, which only works if empty means off.
 */
const ENABLED_VALUES: ReadonlySet<string> = new Set(['on', 'true', '1', 'yes'])

/** Whether a raw env value is one of the {@link ENABLED_VALUES}, after trim and lower-casing. */
const isEnablingValue = (value: string | undefined): boolean => {
  const raw = value?.trim().toLowerCase()
  return raw !== undefined && ENABLED_VALUES.has(raw)
}

/**
 * Read the dev-notice configuration from an env snapshot. Defaults to
 * `process.env`; specs and unit tests pass an explicit snapshot so the parser
 * stays a pure, directly testable function.
 */
export const parseDevNoticeEnvConfig = (
  processEnv: Readonly<Record<string, string | undefined>> = process.env
): DevNoticeEnvConfig =>
  Schema.decodeSync(DevNoticeEnvSchema)({
    mode: processEnv['SOVRIUM_DEV_MODE'],
    name: processEnv['SOVRIUM_DEV_NAME'],
    url: processEnv['SOVRIUM_DEV_URL'],
    email: processEnv['SOVRIUM_DEV_EMAIL'],
    password: processEnv['SOVRIUM_DEV_PASSWORD'],
    public: processEnv['SOVRIUM_DEV_PUBLIC'],
  })

/**
 * Single source of truth for dev mode's opt-in polarity: on only when
 * `SOVRIUM_DEV_MODE` explicitly carries an enabling value.
 *
 * Every injection point (dynamic page, default homepage, standalone and closed
 * form documents, static error fallbacks) and the boot banner's public-origin
 * warning resolve it through this one predicate — mirroring `isBadgeEnabled` —
 * so the polarity can never drift apart across surfaces.
 *
 * The error fallbacks reach it INDIRECTLY: `NotFoundPage` / `ErrorPage` render
 * through `DynamicPage` without passing `devNoticeEnabled`, and undefined means
 * "let the env decide". Note the corollary — because those two components take
 * no props they cannot pass `false` either, so an operator-console 404/500
 * (authorized admin on an unmatched `/_admin/*` sub-path, whose embedded config
 * defines no `/404`) is the one surface where the console carve-out does not
 * reach. Closing that needs a prop threaded from `render-error-pages.tsx`.
 */
export const isDevModeEnabled = (config: DevNoticeEnvConfig): boolean =>
  isEnablingValue(config.mode)

/**
 * True when dev mode is on AND `SOVRIUM_DEV_PUBLIC` carries an enabling value:
 * the operator says the public address is deliberate. The boot banner then
 * drops its public-origin warning, and the server keeps the instance out of
 * search indexes.
 *
 * Without dev mode the variable means nothing — never a refusal, just ignored —
 * so a production instance that inherits it stays indexable. The empty string
 * is off, for the same parent-shell inheritance reason as `SOVRIUM_DEV_MODE`.
 */
export const isDevPublicEnabled = (config: DevNoticeEnvConfig): boolean =>
  isDevModeEnabled(config) && isEnablingValue(config.public)

/**
 * True when BOTH display credentials are present and non-empty.
 *
 * An app without `auth` has no account to show, so `sovrium dev` sets no pair
 * for it and the notice degrades to its no-credentials form. Partial
 * configuration (email without password) is treated as absent rather than
 * rendering a half-filled credentials block.
 */
export const hasDevCredentials = (config: DevNoticeEnvConfig): boolean =>
  (config.email?.trim() ?? '') !== '' && (config.password?.trim() ?? '') !== ''

/**
 * The display name (`SOVRIUM_DEV_NAME`), trimmed, or `undefined` when it is
 * unset or blank whitespace. When present it takes the panel title slot
 * (`<name> — development` / `<name> — développement`); when absent the title
 * falls back to `Dev mode` / `Mode dev`.
 *
 * The empty string must resolve to `undefined` for the same parent-shell
 * inheritance reason as {@link isDevModeEnabled}: the E2E harness inherits
 * every `SOVRIUM_*` variable from the parent shell into the spawned test server,
 * so the fallback spec passes `SOVRIUM_DEV_NAME: ''` to neutralize a leaked
 * value — which only works if empty means unset. The name itself is never
 * translated; only the surrounding title template is localized.
 */
export const resolveDevName = (config: DevNoticeEnvConfig): string | undefined => {
  const trimmed = config.name?.trim() ?? ''
  return trimmed === '' ? undefined : trimmed
}
