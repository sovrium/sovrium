/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { stripHtmlToText } from '@/domain/kernel/sanitize/html-sanitization'
import { findDeclaredLanguage } from '@/domain/models/app/languages/language-detection'
import { ADMIN_CREATE_USER_PATH } from './account-opening-routes'
import { avatarRefusal } from './avatar-url-guard'
import { stripsNameOn } from './display-name-guard'
import { languageRefusal } from './language-preference-guard'
import { NOTIFICATION_PREFERENCE_FIELDS, preferenceRefusal } from './notification-preference-guard'
import type { Languages } from '@/domain/models/app/languages/language'

/**
 * The profile rules every NEW account obeys, whichever road creates it.
 *
 * The request guards (`avatar-url-guard.ts`, `display-name-guard.ts`,
 * `language-preference-guard.ts`, `notification-preference-guard.ts`) each
 * know the doors by path, and a door they do not list writes past them: an
 * email-code sign-up stores the `image`, `language` and operator-email
 * switches of its body, and a code or link sign-up stores a marked-up `name`.
 * The row about to be written is the one place every creating road passes, so
 * the same rules run there too, from the `user.create.before` database hook.
 * The request guards stay, for the answer they give before any work is done.
 */

/** The request a creation runs in, as the database hook receives it. */
export interface CreationRequest {
  readonly path?: string
}

/**
 * A road whose profile comes from an identity provider rather than from the
 * caller: a social or federated sign-in, a provisioning call. Its picture is
 * the provider's, not a value the person typed, and it keeps it.
 */
const isFederatedRoad = (path: string): boolean =>
  path.includes('/callback') ||
  path.startsWith('/sign-in/social') ||
  path.startsWith('/sign-in/oauth2') ||
  path.startsWith('/sso/') ||
  path.startsWith('/one-tap') ||
  path.startsWith('/scim/')

/** `true` when `value` is set: neither absent nor an explicit clear. */
const isSet = (value: unknown): boolean => value !== undefined && value !== null

/** Refuse an avatar the caller chose, outside the roads whose picture is the provider's. */
const refuseChosenAvatar = (user: Readonly<Record<string, unknown>>, path: string): void => {
  if (isSet(user['image']) && !isFederatedRoad(path)) throw avatarRefusal()
}

/** Refuse a language neither the app nor the console mounted on it declares. */
const refuseUndeclaredLanguage = (
  { language }: Readonly<Record<string, unknown>>,
  languages: Languages | undefined
): void => {
  if (!isSet(language)) return
  if (typeof language === 'string' && findDeclaredLanguage(languages, language) !== undefined) {
    return
  }
  throw languageRefusal()
}

/** Refuse an operator-email switch away from its default, outside the administrators' door. */
const refuseOperatorSwitch = (user: Readonly<Record<string, unknown>>, path: string): void => {
  if (path === ADMIN_CREATE_USER_PATH) return
  const changed = NOTIFICATION_PREFERENCE_FIELDS.some(
    (field) => user[field] !== undefined && user[field] !== true
  )
  if (changed) throw preferenceRefusal()
}

/**
 * The account `user` as it may be stored, or a 400 when it breaks a rule.
 *
 * - `name`: markup is stripped and entities decoded, once: a path the request
 *   guard already cleaned (`display-name-guard.ts`) is left as it left it.
 * - `image`: refused when the caller sent one, outside the federated roads.
 * - `language`: refused unless the app (or the console mounted on it) declares it.
 * - the operator-email switches: refused at any value but their default `true`,
 *   except through the administrators' own door.
 *
 * A creation outside any request (a seed, the config's own accounts) is the
 * server's own write and passes unchanged.
 */
export const guardCreatedAccount = (
  user: Readonly<Record<string, unknown>>,
  request: CreationRequest | null,
  languages: Languages | undefined
): Readonly<Record<string, unknown>> => {
  const path = request?.path
  if (path === undefined) return user
  refuseChosenAvatar(user, path)
  refuseUndeclaredLanguage(user, languages)
  refuseOperatorSwitch(user, path)
  // Cleaned once per creation: a path the request guard already cleaned keeps
  // its name as that pass left it.
  const { name } = user
  return typeof name === 'string' && !stripsNameOn(path)
    ? { ...user, name: stripHtmlToText(name) }
    : user
}
