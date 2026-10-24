/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Context } from 'hono'
import { translatedSlugTarget } from '@/domain/kernel/matching/localized-alternates'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { requestedPath } from '@/domain/kernel/url/requested-path'
import { validateLanguageSubdirectory } from '@/domain/models/app/languages/language-detection'
import { isPublicPage } from '@/domain/models/app/pages/is-public'
import { renderWithCache, type PageRequestContext } from './page-render-pipeline'
import type { HonoAppConfig } from '../../../application/ports/contracts/hono-app-config'

/**
 * The answer for `/{lang}/rest` once no page declares that address as written:
 * the language-agnostic page at `rest`, rendered in `urlLanguage`; else, when
 * `rest` is a translated slug of another language (`/fr/manifesto` for a page
 * whose French path is `/manifeste`), a `301` to that page's own address in
 * `urlLanguage`, so a link shared before the translation keeps working; else
 * 404. The redirect fires only toward an anonymously readable page: a `301`
 * where an undeclared path gets a 404 would disclose a gated page (S1). Its
 * target is built from config, its captured values re-encoded, and it passes
 * the same-origin redirect check before it is sent.
 *
 * A remainder that starts with a language segment of its own (`/en/fr/pricing`,
 * `/en/en/x`) names no page: serving `/fr/pricing` there would publish a
 * duplicate of the French page at an address no link should carry, so it is a
 * 404 like any other undeclared path.
 */
export async function answerLanguageRemainder(
  config: HonoAppConfig,
  c: Context,
  request: PageRequestContext,
  urlLanguage: string
): Promise<Response> {
  const { app, renderNotFoundPage } = config
  const remainder = c.req.path.replace(`/${urlLanguage}`, '') || '/'
  const served =
    validateLanguageSubdirectory(app, remainder) === undefined
      ? await renderWithCache(config, remainder, { ...request, detectedLanguage: urlLanguage }, c)
      : undefined
  if (served !== undefined) return served
  const codes = app.languages?.supported.map((language) => language.code) ?? []
  const twin = translatedSlugTarget(app.pages ?? [], c.req.path, codes)
  // The target is the page's own address from config, but its dynamic values
  // come from the request: the canonical same-origin check stands at the sink.
  const target =
    twin !== undefined && isPublicPage(twin.page)
      ? toSafeRedirectPath(`${twin.path}${new URL(c.req.url).search}`)
      : undefined
  if (target !== undefined) return c.redirect(target, 301)
  return c.html(await renderNotFoundPage(app, urlLanguage, requestedPath(c.req.url)), 404)
}
