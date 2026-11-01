/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getCookie } from 'hono/cookie'
import {
  detectLanguageIfEnabled,
  LANGUAGE_PREFERENCE_COOKIE,
  resolvePreferredLanguage,
  servedPageLanguage,
  validateLanguageSubdirectory,
} from '@/domain/models/app/languages/language-detection'
import {
  ALL_LANGUAGES,
  requestedRecordLanguage,
} from '@/domain/models/app/languages/localized-value-service'
import { pathMatchesPagePattern } from '@/domain/models/app/pages/sidebar-requires-service'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * The language a write posted from one of the app's pages fills — a page form,
 * a form placed on a page, a bulk action — in an app that declares languages:
 * the language that page was SHOWN in, so an editor saves the text she read.
 *
 * `?lang=` when the request names one; else the page's served language, by the
 * renderer's own order ({@link servedPageLanguage}) over what the posting page's
 * request offered: the `/{lang}/` prefix of its address (read off the
 * `Referer`), else the remembered choice (the language cookie), then that
 * page's `meta.lang`, then the browser's `Accept-Language` when the app detects
 * it, then the default language. A choice saved on the account alone is not
 * read here; the switcher writes it to the cookie as well. The `Referer` only
 * ever selects one of the app's declared languages, so a forged one changes
 * nothing but which of them a plain string fills — never who may write.
 *
 * @returns a declared code, or `undefined` when the app declares no languages
 */
export const pageWriteLanguage = (c: Context, app: App): string | undefined => {
  const { languages } = app
  if (languages === undefined) return undefined
  const asked = c.req.query('lang') ?? servedLanguageOf(c, app)
  const language = requestedRecordLanguage(languages, asked, undefined)
  return language === ALL_LANGUAGES ? languages.default : language
}

/** The language the page that posted the request was served in. */
const servedLanguageOf = (c: Context, app: App): string => {
  const path = refererPath(c.req.header('referer'))
  const address = path === undefined ? undefined : validateLanguageSubdirectory(app, path)
  const remembered = resolvePreferredLanguage(
    app.languages,
    getCookie(c, LANGUAGE_PREFERENCE_COOKIE)
  )
  return servedPageLanguage({
    languages: app.languages,
    addressed: address ?? remembered,
    pageLang: address === undefined && path !== undefined ? pageLangAt(app, path) : undefined,
    detected: detectLanguageIfEnabled(app, c.req.header('accept-language')),
  })
}

/** The path of a `Referer`, if it is an address at all. */
const refererPath = (referer: string | undefined): string | undefined =>
  referer !== undefined && URL.canParse(referer) ? new URL(referer).pathname : undefined

/** A page's path patterns: one, or one per language when it translates its path. */
const patternsOf = (pattern: string | Readonly<Record<string, string>>): readonly string[] =>
  typeof pattern === 'string' ? [pattern] : Object.values(pattern)

/** The `meta.lang` of the page serving `path`: an exact path first, then a pattern. */
const pageLangAt = (app: App, path: string): string | undefined => {
  const pages = app.pages ?? []
  const page =
    pages.find((candidate) => patternsOf(candidate.path).includes(path)) ??
    pages.find((candidate) =>
      patternsOf(candidate.path).some((pattern) => pathMatchesPagePattern(path, pattern))
    )
  return page?.meta?.lang
}
