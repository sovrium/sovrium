/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  ALL_LANGUAGES,
  requestedRecordLanguage,
} from '@/domain/models/app/languages/localized-value-service'
import { translatableReadFieldsOf } from '@/domain/models/app/tables/translatable-read-service'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import type { App } from '@/domain/models/app'
import type { Context, Next } from 'hono'

/**
 * The language a records read serves its translatable fields in.
 *
 * Decided once per request, before the route runs: `?lang=` when it names a
 * declared language or is `*`, else the first declared language the
 * `Accept-Language` header names, else `languages.default`. The route reads
 * the decision with {@link recordReadLanguageOf}.
 *
 * A successful read of a table holding translatable content then says which
 * language it served (`Content-Language`) and that the answer depends on the
 * header (`Vary: Accept-Language`), so a cache never hands a French reader the
 * English answer. A `*` read serves every language and names none.
 */

/** The context variable the decision is kept under for the route. */
const RECORD_LANGUAGE = 'recordReadLanguage'

/** Middleware: decide the read language, and name it on a successful answer. */
export const servesRecordLanguage =
  (resolveApp: () => App) =>
  async (c: Context, next: Next): Promise<void> => {
    const app = resolveApp()
    const language = requestedRecordLanguage(
      app.languages,
      c.req.query('lang'),
      c.req.header('Accept-Language')
    )
    c.set(RECORD_LANGUAGE, language)
    await next()
    if (language === undefined || language === ALL_LANGUAGES || c.res.status !== 200) return
    if (translatableReadFieldsOf(app, getTableContext(c).tableName).size === 0) return
    c.res.headers.set('Content-Language', language)
    c.res.headers.append('Vary', 'Accept-Language')
  }

/** The read language {@link servesRecordLanguage} decided, if it ran. */
export const recordReadLanguageOf = (c: Context): string | undefined => {
  const language: unknown = c.get(RECORD_LANGUAGE)
  return typeof language === 'string' ? language : undefined
}
