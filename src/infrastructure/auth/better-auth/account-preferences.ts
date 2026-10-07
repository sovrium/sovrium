/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The account's own engine-owned preferences on `auth.user` — the interface
 * language and the two operator-email switches — declared to Better Auth as
 * `user.additionalFields`, and the write-door guards that decide which values
 * each account may store.
 *
 * One module for the three, because they share one shape: Better Auth stores a
 * DECLARED additional field verbatim once `input: true` lets a client send it,
 * validating its type and nothing more. So every such field needs both halves —
 * the declaration and the guard — and keeping them side by side is what stops
 * a new preference from shipping with the first and not the second.
 */

import { parseSovriumAdmin } from '@/domain/models/process-env/admin'
import { resolveAdminPresetApp } from '@/infrastructure/assets/admin-preset'
import {
  acceptedPreferenceLanguages,
  applyLanguagePreferenceGuard,
} from './language-preference-guard'
import {
  applyNotificationPreferenceGuard,
  NOTIFICATION_PREFERENCE_ADDITIONAL_FIELDS,
} from './notification-preference-guard'
import type { App } from '@/domain/models/app'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles/role'
import type { Languages } from '@/domain/models/app/languages/language'
import type { createAuthMiddleware } from 'better-auth/api'

/** The Better Auth `before`-hook context (same derivation as the guards'). */
type AuthMiddlewareCtx = Parameters<typeof createAuthMiddleware>[0] extends (
  ctx: infer C
) => unknown
  ? C
  : never

/**
 * `user.additionalFields`. `language` is nullable and free of a default ("has
 * chosen nothing" is a real state); the two email switches default to `true`,
 * matching their `NOT NULL DEFAULT true` columns.
 */
export const ACCOUNT_PREFERENCE_FIELDS = {
  language: { type: 'string', required: false, input: true },
  ...NOTIFICATION_PREFERENCE_ADDITIONAL_FIELDS,
} as const

/**
 * Run every preference guard for one request. The language guard refuses a
 * language the app does not declare; the notification guard refuses either
 * email switch from an account that is not admin-tier.
 */
export async function applyAccountPreferenceGuards(
  ctx: AuthMiddlewareCtx,
  languages: Languages | undefined,
  app: AdminRoleResolvable
): Promise<void> {
  applyLanguagePreferenceGuard(ctx, languages)
  await applyNotificationPreferenceGuard(ctx, app)
}

/**
 * The languages of the operator console mounted on this host, or `undefined`
 * when it is not served — the write door accepts them beside the host's own
 * (`acceptedPreferenceLanguages`, a languages spec).
 *
 * The same two switches `buildEmbeddedAppMounts` reads — the app's
 * `admin: false` and the deployment's `SOVRIUM_ADMIN=off` — so the write door
 * and the mount cannot disagree about whether the console exists. The kill
 * switch is read first, so an instance running without the console never
 * decodes its preset here.
 */
const mountedConsoleLanguages = (admin: App['admin'] | undefined): Languages | undefined =>
  parseSovriumAdmin() === 'off' || admin === false ? undefined : resolveAdminPresetApp().languages

/**
 * The vocabulary the language guard accepts for this app: its own declared
 * languages plus those of the console mounted on it. One account row serves
 * both apps and each clamps it on its own read, so a value only the console
 * declares is honoured there and ignored by the host.
 */
export const writablePreferenceLanguages = (
  app: { readonly languages?: Languages; readonly admin?: App['admin'] } | undefined
): Languages | undefined =>
  acceptedPreferenceLanguages(app?.languages, mountedConsoleLanguages(app?.admin))
