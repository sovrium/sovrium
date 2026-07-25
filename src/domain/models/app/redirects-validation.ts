/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { stripLanguagePrefix } from './redirects'

interface AppForRedirectValidation {
  readonly redirects?: ReadonlyArray<{ readonly from: string; readonly to: string }>
  readonly pages?: ReadonlyArray<{ readonly name: string; readonly path: string }>
  readonly languages?: { readonly supported: ReadonlyArray<{ readonly code: string }> }
}

export const validateAllRedirectRules = (app: AppForRedirectValidation): true | string => {
  const { redirects, pages } = app
  if (!redirects || !pages) return true

  const languageCodes = app.languages?.supported.map((language) => language.code) ?? []
  const normalize = (path: string): string => stripLanguagePrefix(path, languageCodes).path

  const staticPagePaths = new Map(
    pages
      .filter((page) => !page.path.includes(':'))
      .map((page) => [normalize(page.path), page.name])
  )

  const collision = redirects.find((rule) => staticPagePaths.has(normalize(rule.from)))
  if (collision === undefined) return true

  const pageName = staticPagePaths.get(normalize(collision.from))
  return `Redirect 'from' path '${collision.from}' collides with page '${pageName}' — the redirect is evaluated first, so that page would be unreachable. Delete the page or choose a different 'from'.`
}
