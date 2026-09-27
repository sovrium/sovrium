/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Who receives one kind of operator email — the automation-failure alert, or
 * the weekly summary.
 *
 * Two audiences, unioned:
 *
 * 1. The app's admin-tier accounts (every role the operator console admits),
 *    not banned, whose own preference for that email is still on — only when
 *    the app declares `auth:`, since without it there are no accounts at all.
 * 2. The addresses in `SOVRIUM_NOTIFY_TO`, whatever the app declares. For an
 *    app with no `auth:` block they are the whole audience, which is why the
 *    variable exists.
 *
 * Addresses are de-duplicated case-insensitively, first spelling kept, so an
 * admin who is also listed in `SOVRIUM_NOTIFY_TO` receives one email.
 *
 * A failed account lookup degrades to the listed addresses and is logged: the
 * caller is an alert about something that already went wrong, and a second
 * failure must not silence it entirely.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { adminTierRoleNames } from '@/domain/models/app/auth/roles/role'
import { parseSovriumNotifyTo } from '@/domain/models/process-env/notifications'
import { logError } from '@/infrastructure/logging/logger'
import type { NotificationPreference } from '@/application/ports/repositories/auth/auth-repository'
import type { App } from '@/domain/models/app'

/** Case-insensitive de-duplication, keeping the first spelling of each address. */
const dedupeAddresses = (addresses: readonly string[]): readonly string[] =>
  addresses.filter(
    (address, index) =>
      addresses.findIndex((other) => other.toLowerCase() === address.toLowerCase()) === index
  )

/** The opted-in admin-tier accounts, or none when the app has no `auth:`. */
const loadAccountRecipients = (
  app: App,
  preference: NotificationPreference
): Effect.Effect<readonly string[], never, AuthRepository> =>
  Effect.gen(function* () {
    if (!app.auth) return [] as readonly string[]
    const repo = yield* AuthRepository
    return yield* repo.findNotificationRecipients({ roles: adminTierRoleNames(app), preference })
  }).pipe(
    Effect.catch((error) => {
      logError('[resolve-notification-recipients] account lookup failed', error.cause)
      return Effect.succeed([] as readonly string[])
    })
  )

/**
 * Resolve the recipients of one kind of operator email.
 *
 * `env` defaults to the process environment; `SOVRIUM_NOTIFY_TO` was validated
 * at boot, so a malformed value here is impossible in a running server.
 */
export const resolveNotificationRecipients = (
  app: App,
  preference: NotificationPreference,
  env: Readonly<Record<string, string | undefined>> = process.env
): Effect.Effect<readonly string[], never, AuthRepository> =>
  Effect.gen(function* () {
    const accounts = yield* loadAccountRecipients(app, preference)
    return dedupeAddresses([...accounts, ...parseSovriumNotifyTo(env)])
  }).pipe(Effect.withSpan('notifications.resolve-recipients'))
