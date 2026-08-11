/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Redirect cross-validation.
 *
 * A redirect is evaluated BEFORE page resolution, so a rule whose `from` equals
 * a live page's `path` makes that page permanently unreachable — the page still
 * exists in the config, renders in no browser, and nothing says why. That is
 * exactly the class of silent shadowing a config-as-code platform should refuse
 * to boot with, so it is rejected at decode time by `sovrium validate`.
 *
 * Scope of the check — EXACT static path equality only, after stripping any
 * language prefix from both sides. A dynamic page pattern (`/blog/:slug`) is
 * deliberately NOT treated as a collision: retiring one article out of a
 * dynamic collection (`from: '/blog/old-post'`) is a legitimate, common
 * migration, and the redirect correctly wins because it is registered first.
 *
 * Static files cannot be checked here — the public directory is a runtime/CLI
 * concern the schema has no view of. That half of the problem is solved by
 * ORDERING instead: redirects mount AFTER the public-directory route, so a real
 * file always wins. What the schema can know it rejects loudly; what only the
 * runtime knows, the mount order makes safe.
 *
 * Extracted into a standalone module (mirroring `validateAllSystemSourceReferences`)
 * so the `AppSchema` `Schema.filter` chain stays shallow — every additional
 * filter pushes TypeScript's inference depth over the limit and collapses the
 * derived `App` type to `never`.
 */

import { stripLanguagePrefix } from './redirects'

/** Minimal shape needed to validate redirect rules against pages. */
interface AppForRedirectValidation {
  readonly redirects?: ReadonlyArray<{ readonly from: string; readonly to: string }>
  readonly pages?: ReadonlyArray<{ readonly name: string; readonly path: string }>
  readonly languages?: { readonly supported: ReadonlyArray<{ readonly code: string }> }
}

/**
 * Validate that no redirect `from` shadows a declared page path.
 *
 * @returns `true` when valid, or an error message describing the collision.
 */
export const validateAllRedirectRules = (app: AppForRedirectValidation): true | string => {
  const { redirects, pages } = app
  if (!redirects || !pages) return true

  const languageCodes = app.languages?.supported.map((language) => language.code) ?? []
  const normalize = (path: string): string => stripLanguagePrefix(path, languageCodes).path

  // Only STATIC page paths participate — a path carrying a `:param` segment is a
  // pattern, not an address, and retiring one member of it is legitimate.
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
