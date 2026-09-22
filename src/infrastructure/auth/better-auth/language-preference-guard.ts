/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { APIError } from 'better-auth/api'
import { findDeclaredLanguage } from '@/domain/models/app/languages/language-detection'
import type { Languages } from '@/domain/models/app/languages/language'
import type { createAuthMiddleware } from 'better-auth/api'

/**
 * The Better Auth `before`-hook context. Re-derived here (rather than imported
 * from `auth.ts`) so this guard module has no cycle back to the instance
 * factory that consumes it — same reasoning as `avatar-url-guard.ts`.
 */
type AuthMiddlewareCtx = Parameters<typeof createAuthMiddleware>[0] extends (
  ctx: infer C
) => unknown
  ? C
  : never

/**
 * Endpoints on which a CLIENT can put a value into `auth.user.language`, and
 * where in the body it sits.
 *
 * The same four doors the avatar guard closes, for the same structural reason:
 * `language` is declared through `user.additionalFields`, and Better Auth
 * stores an additional field verbatim once it is declared — it validates the
 * TYPE and nothing else. So every path that can carry the key reaches the same
 * column, and guarding one would be theatre.
 *
 * - `/sign-up/email` — `body.language`, and note this one is **unauthenticated**.
 * - `/update-user` — `body.language`, the self-service path a person's own
 *   language switcher uses.
 * - `/admin/create-user`, `/admin/update-user` — `body.data.language`, which
 *   rides in on the `data` passthrough without appearing in either body schema.
 *
 * The nesting mirrors `avatar-url-guard.ts` and `admin-role-guards.ts`, where
 * reading the wrong key silently skips validation. The location is therefore
 * data, not a conditional.
 */
const LANGUAGE_WRITING_PATHS: ReadonlyMap<string, 'body' | 'data'> = new Map([
  ['/sign-up/email', 'body'],
  ['/update-user', 'body'],
  ['/admin/create-user', 'data'],
  ['/admin/update-user', 'data'],
])

/**
 * Read the `language` field, distinguishing "absent" from "present and null".
 *
 * The distinction is load-bearing: absent means the request is not about the
 * language at all and must pass through untouched — a plain name change through
 * `/update-user` has to keep working — whereas an explicit `null` is somebody
 * clearing their preference, which is exactly how a person returns to the
 * default and must always be allowed.
 */
// eslint-disable-next-line functional/prefer-immutable-types
const readLanguageField = (ctx: AuthMiddlewareCtx, location: 'body' | 'data'): unknown => {
  const body = ctx.body as { language?: unknown; data?: { language?: unknown } } | undefined
  if (location === 'data') {
    const data = body?.data
    if (typeof data !== 'object' || data === null) return undefined
    return (data as { language?: unknown }).language
  }
  return body?.language
}

/**
 * Refuse a language the app does not declare, with a 400. `null` (clear the
 * preference) and an absent field both pass.
 *
 * ─── WHY AT THE WRITE DOOR RATHER THAN ON THE READ ──────────────────────────
 *
 * Clamping only on the way out would leave the row holding a value the app
 * cannot honour: harmless to the page, which falls back correctly, and then
 * published verbatim by the account export, carried across a restore, and
 * reported by any operator tool that reads the column. A value that can never
 * be honoured should never have been stored, and the door is the one place that
 * can still say so.
 *
 * ─── DECLAREDNESS, NOT PERSISTENCE ──────────────────────────────────────────
 *
 * `findDeclaredLanguage` rather than `resolvePreferredLanguage`, deliberately:
 * the latter also answers `undefined` when the app sets
 * `persistSelection: false`, and using it here would make such an app refuse a
 * language it plainly declares — a legal value rejected for an unrelated
 * reason, reported as though the value were wrong. Persistence is honoured
 * where it belongs, on the read.
 *
 * An app declaring no `languages` at all declares no language, so any value is
 * undeclared and is refused. That is the same rule, not a special case: there
 * is nothing that could ever honour it.
 *
 * ─── STATUS CODE ────────────────────────────────────────────────────────────
 *
 * 400, not 404. Standing rule S1 mandates 404 for UNAUTHORIZED access so a
 * probe cannot distinguish "exists but forbidden" from "does not exist". No
 * such ambiguity exists here: the caller is writing their OWN row, is allowed
 * to write it, and has simply sent a value the app cannot honour. Nothing is
 * enumerable, so a 400 discloses nothing and — unlike a 404 — tells the caller
 * what to fix.
 */
export function applyLanguagePreferenceGuard(
  // eslint-disable-next-line functional/prefer-immutable-types -- the Better Auth hook context is mutable by its own type
  ctx: AuthMiddlewareCtx,
  languages: Languages | undefined
) {
  const location = LANGUAGE_WRITING_PATHS.get(ctx.path)
  if (location === undefined) return

  const language = readLanguageField(ctx, location)
  // Absent → the request is not about the language. Explicit null → clearing it.
  if (language === undefined || language === null) return

  if (typeof language === 'string' && findDeclaredLanguage(languages, language) !== undefined) {
    return
  }

  // eslint-disable-next-line functional/no-throw-statements
  throw new APIError('BAD_REQUEST', {
    message:
      'That language is not one this app declares. Choose one of its supported languages, or send `language: null` to clear the preference.',
  })
}
