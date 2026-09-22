/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure page-resolution predicate shared by the renderer and the URL
 * canonicalization routes.
 *
 * `findDeclaredPage` is the single definition of "which page declaration would
 * answer this request path": the page-pattern match first, then the
 * `contentDir.index` collection BASE PATH fallback. The presentation
 * renderer delegates to it, so a canonicalization handler and the renderer can
 * never disagree about whether a path is answerable — a 301 or 302 into a 404
 * is strictly worse than the honest 404 it replaces.
 *
 * ## Why this is not `renderWithCache`
 *
 * The obvious predicate — "call the renderer and see whether it 404s" — is
 * unusable here. `renderWithCache` runs the shared-view anti-enumeration gate,
 * consults the page cache, and WRITES a cache entry on a miss. A routing-layer
 * guard must be pure: it runs on paths that will never be rendered, and it must
 * not observe a session, populate a cache, or read the filesystem.
 *
 * ## Why two passes
 *
 * Both authoring styles ship and neither can be dropped:
 *
 *  - locale-agnostic authoring — `pages: [{ path: '/about' }]` served at
 *    `/about`, `/en/about` and `/fr/about`, because `handleLanguagePageRoute`
 *    strips the prefix at request time before rendering;
 *  - explicitly locale-scoped authoring — `apps/website` declares
 *    `/${lang}/docs/:slug` literally, once per configured locale, because each
 *    binds a different `contentDir.directory`.
 *
 * A direct-only predicate misses the first; a strip-only predicate misses the
 * second. Both predicates below therefore try the path as given and then, only
 * when it carries a configured language prefix, the stripped form.
 *
 * ## Two predicates, because "declared" and "may I say so" differ
 *
 * {@link resolvesToDeclaredPage} answers only "would a page declaration answer
 * this path". It is the right question for a guard that emits NO redirect —
 * the normalizer's pass-through for a path authored WITH its slash — because
 * such a guard discloses nothing, and gating it would strip an author's own
 * gated `/docs/` page toward a path they never declared.
 *
 * It is the wrong question for a REDIRECT. A 301 or 302 toward a role-gated
 * page, where an undeclared path gets a 404, tells an anonymous prober the page
 * exists — and unlike the gated content itself, that bit is not recoverable by
 * requesting the canonical path directly, which 404s. That violates standing
 * rule S1 (404 for unauthorized, anti-enumeration), so every canonicalizing
 * redirect gates on {@link resolvesToPublicDeclaredPage} instead: the same two
 * passes, plus `isPublicPage` on whichever declaration matched.
 *
 * An earlier revision of this file claimed the disclosure was "bounded by what
 * `/sitemap.xml` already publishes from the same page list". That was measured
 * false and is retracted: the sitemap filters its page list through
 * `getPublicPagePaths`, which applies the very `isPublicPage` predicate this
 * module previously did not, so a gated page appears in no sitemap while the
 * redirect announced it to anyone who typed a trailing slash.
 *
 * ## What neither predicate decides
 *
 * The per-VISITOR access decision. `isPublicPage` is a property of the
 * declaration — "is this anonymously readable" — not of the session, so the
 * routing layer never grows a second copy of `checkPageAccess`. A page using
 * `access: { require, redirectTo }` still discloses its own declaredness
 * through the login bounce it was configured to perform; the gate stays uniform
 * rather than reasoning about denial modes.
 */

import { findMatchingRoute, type RouteParams } from '@/domain/kernel/matching/route-matcher'
import { matchContentDirIndexBasePath } from '@/domain/models/app/pages/content-dir-index-match'
import { isPublicPage } from '@/domain/models/app/pages/is-public'
import { stripLanguagePrefix } from '@/domain/models/app/redirects'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

/** A request path resolved to the page declaration that would answer it. */
export interface DeclaredPageMatch {
  /** The matched page declaration. */
  readonly page: Page
  /** Route parameters extracted from the page pattern's dynamic segments. */
  readonly params: RouteParams
  /**
   * Set only when the path matched a `contentDir.index` collection BASE PATH
   * rather than the page pattern itself — the base-path PATTERN, so
   * the caller can synthesise canonical / hreflang SEO at the base path rather
   * than at the slugged URL.
   */
  readonly indexBasePathPattern?: string
}

/**
 * Locate the page declaration matching `path`, together with the route
 * parameters extracted from its dynamic segments. Returns `undefined` when no
 * page matches — the caller then 404s.
 *
 * When no page pattern matches directly, the path is retried against the BASE
 * PATH of every index-bearing collection (`contentDir.index`, [internal ref]): a
 * request for `/docs` resolves to the `/docs/:slug` page with the index slug
 * pre-filled.
 *
 * @param app - The application schema.
 * @param path - The request path.
 */
export function findDeclaredPage(app: App, path: string): DeclaredPageMatch | undefined {
  if (!app.pages || app.pages.length === 0) return undefined
  const match = findMatchingRoute(
    app.pages.map((page) => page.path),
    path
  )
  if (match) {
    const page = app.pages[match.index]
    return page ? { page, params: match.params } : undefined
  }
  // Fallback: the base path of an index-bearing collection serves its index
  // article.
  const indexMatch = matchContentDirIndexBasePath(app.pages, path)
  return indexMatch
    ? {
        page: indexMatch.page,
        params: indexMatch.routeParams,
        indexBasePathPattern: indexMatch.basePathPattern,
      }
    : undefined
}

/**
 * The declaration that would answer `path` — directly, or after stripping a
 * configured language prefix the request-time router would strip anyway.
 *
 * The direct pass SHORT-CIRCUITS: when it matches, the stripped pass is never
 * consulted, mirroring the order the request-time router resolves in. Falling
 * through from a gated direct match to a public stripped one would authorise a
 * redirect toward a path that then renders the gated page — the leak, restored
 * through the back door.
 */
function findDeclaredPageAcrossLanguagePasses(
  app: App,
  path: string
): DeclaredPageMatch | undefined {
  const direct = findDeclaredPage(app, path)
  if (direct !== undefined) return direct
  const languageCodes = app.languages?.supported.map((language) => language.code) ?? []
  const stripped = stripLanguagePrefix(path, languageCodes)
  if (stripped.language === undefined) return undefined
  return findDeclaredPage(app, stripped.path)
}

/**
 * Whether `path` would resolve to a declared page — regardless of who may read
 * it.
 *
 * Use this ONLY for a guard that emits no redirect. Every canonicalizing
 * redirect must gate on {@link resolvesToPublicDeclaredPage} instead; see this
 * module's header for why the two questions are not interchangeable.
 *
 * @param app - The application schema.
 * @param path - The candidate request path.
 */
export function resolvesToDeclaredPage(app: App, path: string): boolean {
  return findDeclaredPageAcrossLanguagePasses(app, path) !== undefined
}

/**
 * Whether `path` would resolve to a declared page that is ALSO anonymously
 * readable.
 *
 * This is the gate every canonicalizing redirect passes before it fires. It
 * carries both obligations at once: a redirect is emitted only toward a path
 * that resolves, so the engine never answers with a redirect landing on a 404;
 * and only toward a page an anonymous visitor may read, so a redirect never
 * discloses the existence of a page whose 404 was written to hide it (S1).
 *
 * @param app - The application schema.
 * @param path - The candidate request path (a redirect SOURCE or TARGET).
 */
export function resolvesToPublicDeclaredPage(app: App, path: string): boolean {
  const match = findDeclaredPageAcrossLanguagePasses(app, path)
  return match !== undefined && isPublicPage(match.page)
}
