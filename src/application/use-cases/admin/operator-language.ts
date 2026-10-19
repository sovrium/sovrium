/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The operator's console language, for an admin read that phrases a value on
 * the server (a run's `stepsLabel`).
 *
 * The same rank the mounted console composes its pages in: the ACCOUNT's own
 * language first, then the browser's remembered `sovrium_language` preference,
 * each clamped to the languages the CONSOLE declares — never the host app's,
 * which may declare none — and English when neither names one of them.
 */

import { Effect } from 'effect'
import { AccountRepository } from '@/application/ports/repositories/auth/account-repository'
import { groupLabelFor, roleLabelFor } from '@/domain/models/app/auth/readable-name-service'
import { findDeclaredLanguageCode } from '@/domain/models/app/languages/language-detection'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import type { AccountDatabaseError } from '@/application/ports/repositories/auth/account-repository'
import type { AdminReadRequest } from '@/application/use-cases/admin/admin-read-operation'
import type { App } from '@/domain/models/app'
import type { Languages } from '@/domain/models/app/languages/language'

/**
 * The console's declared languages: a MIRROR of `languages.supported` in
 * `src/admin/app.ts`, kept by hand because no import can carry it. Application
 * may not reach `admin-config` at all, and `admin-config` may reach the domain
 * for TYPES only, so not even a shared domain
 * constant could feed both. Adding a console language means adding it here
 * too, or this read keeps phrasing it in English.
 */
const CONSOLE_SUPPORTED = [
  { code: 'en', locale: 'en-US', label: 'English' },
  { code: 'fr', locale: 'fr-FR', label: 'Français' },
] as const

/** A language the operator console is written in. */
export type ConsoleLanguage = (typeof CONSOLE_SUPPORTED)[number]['code']

/** The clamp's reference, in the shape the language matcher reads. */
const CONSOLE_LANGUAGES: Languages = { default: 'en', supported: CONSOLE_SUPPORTED }

/** A raw preference (`fr`, `fr-FR`) as a console language, or `undefined` when undeclared. */
const asConsoleLanguage = (raw: string | null | undefined): ConsoleLanguage | undefined => {
  const code = findDeclaredLanguageCode(CONSOLE_LANGUAGES, raw ?? undefined)
  return CONSOLE_SUPPORTED.find((entry) => entry.code === code)?.code
}

/**
 * Resolve the language the caller's console is composed in: account, then the
 * request's remembered preference, then English.
 */
export const resolveOperatorLanguage = (
  request: Pick<AdminReadRequest, 'actorUserId' | 'preferredLanguage'>
): Effect.Effect<ConsoleLanguage, AccountDatabaseError, AccountRepository> =>
  Effect.gen(function* () {
    const accounts = yield* AccountRepository
    const profile = yield* accounts.loadProfile(request.actorUserId)
    return (
      asConsoleLanguage(profile?.language) ?? asConsoleLanguage(request.preferredLanguage) ?? 'en'
    )
  }).pipe(Effect.withSpan('admin.resolve-operator-language'))

/** What the console calls a role and a group, for one reader. */
export interface ConsoleLabels {
  readonly role: (name: string) => string
  readonly group: (name: string) => string
}

/**
 * The words the console shows for the app's roles and groups in `language`:
 * a declared `label` (its `$t:` key read from the app's translations), else the
 * console's words for a role every app carries, else the name made readable.
 */
export const consoleLabels = (app: App, language: ConsoleLanguage): ConsoleLabels => {
  const translate = (text: string) => resolveTranslationPattern(text, language, app.languages)
  return {
    role: (name) => roleLabelFor(app.auth, name, language, translate),
    group: (name) => groupLabelFor(app.auth, name, translate),
  }
}
