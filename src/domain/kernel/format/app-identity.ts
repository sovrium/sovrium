/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one spelling of "which app, on which engine": `<app> v<ver> (Sovrium
 * v<engine>)` — the app first, the engine as a parenthesised qualifier.
 *
 * Shared by the startup banner and the subject line of every operator email, so
 * an operator running several apps reads the same identity in the terminal and
 * in their inbox. A second spelling would drift, and the drift would read as two
 * different apps.
 */

/**
 * The version shown for an app that declares none. A render-site substitution,
 * never a schema default: `app.version` stays absent everywhere else.
 */
export const DEFAULT_DISPLAYED_APP_VERSION = '1.0.0'

/** What {@link formatAppIdentity} needs. */
export interface AppIdentityInput {
  readonly name: string
  readonly version?: string
  readonly engineVersion: string
}

/** `acme-ops v2.3.1 (Sovrium v0.28.0)`. */
export const formatAppIdentity = ({ name, version, engineVersion }: AppIdentityInput): string =>
  `${name} v${version ?? DEFAULT_DISPLAYED_APP_VERSION} (Sovrium v${engineVersion})`
