/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Link cross-validation — the reserved `/l` namespace, and the fallback target.
 *
 * TWO RULES, both refusing a config that would fail at a VISITOR's request
 * rather than at decode time:
 *
 *  1. Nothing else in the config may claim a path under `/l` (below).
 *  2. A link may not predicate EVERY target with `when`. A visitor matching none
 *     of them has nowhere to go, and that visitor is exactly the one nobody
 *     tested — the author checks the mobile case and the iOS case, and never
 *     opens the link on a laptop.
 *
 * Rule 2 lives here rather than on `LinkSchema` for the same inference-depth
 * reason rule 1 does: this module is called from INSIDE the existing bundled
 * `Schema.check`, never as a new one.
 *
 * `/l` is a reserved namespace, and link routes are mounted BEFORE both the
 * redirect table and page resolution. So a page, form, or redirect declaring a
 * path under `/l` is not merely redundant — it is permanently unreachable, with
 * nothing in the config or the logs saying why. That is the same silent-shadowing
 * class `validateAllRedirectRules` refuses to boot with, and it is refused here
 * for the same reason.
 *
 * WHY THE NAMESPACE IS RESERVED WHOLESALE, including the bare `/l` segment: it
 * keeps the future open at zero cost. A link index, a QR landing page, or a
 * `/l/{slug}.png` raster can be added later without stranding a config that had
 * legitimately claimed the path in the meantime.
 *
 * WHAT THIS DOES **NOT** CHECK, and why:
 *
 *  - **The public directory.** A `public/l/` folder would shadow every short
 *    link, but the filesystem is a runtime concern the schema has no view of.
 *    That half is handled by ORDERING — links mount after static assets, so a
 *    real shipped file always wins — plus a mount-time warning. What the schema
 *    can know it rejects loudly; what only the runtime knows, the mount order
 *    makes safe.
 *  - **Slugs held by rows in `system.links`.** The database is likewise invisible
 *    to the schema, and a data row must never break a deploy. A config slug that
 *    collides with an existing row shadows it at boot with a warning, and the
 *    admin console refuses (409) to mint a row over a config-declared slug.
 *
 * Extracted into a standalone module, mirroring `redirects-validation.ts`, so the
 * `AppSchema` filter chain stays shallow — every additional top-level
 * `Schema.check` pushes TypeScript's inference depth over the limit and collapses
 * the derived `App` type to `never`. This module is called from INSIDE the
 * existing bundled filter, never as a new one.
 */

import { stripLanguagePrefix } from '../redirects'

/** The reserved namespace, as a bare segment and as a prefix. */
const LINK_NAMESPACE = '/l'
const LINK_NAMESPACE_PREFIX = '/l/'

/** Minimal shape needed to validate the reserved link namespace. */
interface AppForLinkValidation {
  readonly links?: ReadonlyArray<{
    readonly slug: string
    readonly targets?: ReadonlyArray<{ readonly when?: unknown }> | undefined
  }>
  readonly pages?: ReadonlyArray<{ readonly name: string; readonly path: string }>
  readonly forms?: ReadonlyArray<{ readonly name: string; readonly path?: string | undefined }>
  readonly redirects?: ReadonlyArray<{ readonly from: string }>
  readonly languages?: { readonly supported: ReadonlyArray<{ readonly code: string }> }
}

/**
 * Whether a declared path lands inside the reserved link namespace.
 *
 * The language prefix is stripped first, using the SAME helper the redirect
 * matcher uses. That matters: a French page declared at `/fr/l/offres` resolves
 * to `/l/offres` once the locale segment is removed, which is exactly the path
 * the link route would answer — so checking the raw string would miss it.
 */
const claimsLinkNamespace = (path: string, languageCodes: ReadonlyArray<string>): boolean => {
  const { path: bare } = stripLanguagePrefix(path, languageCodes)
  return bare === LINK_NAMESPACE || bare.startsWith(LINK_NAMESPACE_PREFIX)
}

/**
 * Validate that nothing else in the config claims a path under `/l`.
 *
 * Runs unconditionally — NOT only when `app.links` is present. A path under `/l`
 * is unreachable whether or not any link happens to be declared today, because
 * the namespace is reserved by the product rather than by the presence of
 * config. Gating the check on `app.links` would let a config ship a `/l/pricing`
 * page that works right up until the first link is added, and then breaks for a
 * reason no diff explains.
 *
 * @returns `true` when valid, or an error message describing the first problem.
 */

/**
 * Whether a link leaves no target a predicate-free visitor can reach.
 *
 * A link with no `targets` is out of scope: its destination is `to`, which
 * carries no predicate and is therefore always the fallback.
 */
const hasNoFallbackTarget = (link: {
  readonly targets?: ReadonlyArray<{ readonly when?: unknown }> | undefined
}): boolean =>
  link.targets !== undefined &&
  link.targets.length > 0 &&
  link.targets.every((target) => target.when !== undefined)

/**
 * Rule 2 — every target predicated leaves the unremarkable visitor stranded.
 *
 * Split out of `validateAllLinkRules` so that function's branch count stays
 * under the complexity ceiling: it already reads four collections, and each rule
 * added inline costs two more branches.
 */
const validateFallbackTargets = (app: AppForLinkValidation): true | string => {
  const orphaned = app.links?.find((link) => hasNoFallbackTarget(link))
  return orphaned === undefined
    ? true
    : `Link '${orphaned.slug}' predicates every target with 'when', so a visitor matching none of them has nowhere to go — and that visitor is exactly the one nobody tested. Leave at least one target without a 'when' as the fallback.`
}

/**
 * Rule 1 — nothing else in the config may claim a path under `/l`.
 *
 * Split from the entry point alongside rule 2, so adding a third rule later is
 * one more line in the chain rather than two more branches in one function.
 */
const validateReservedNamespace = (app: AppForLinkValidation): true | string => {
  const languageCodes = app.languages?.supported.map((language) => language.code) ?? []

  const page = app.pages?.find((candidate) => claimsLinkNamespace(candidate.path, languageCodes))
  if (page !== undefined) {
    return `Page '${page.name}' declares path '${page.path}', which is inside the reserved '/l' short-link namespace. Link routes are matched before page resolution, so this page would never render. Move it to another path.`
  }

  const form = app.forms?.find(
    (candidate) =>
      candidate.path !== undefined && claimsLinkNamespace(candidate.path, languageCodes)
  )
  if (form?.path !== undefined) {
    return `Form '${form.name}' declares path '${form.path}', which is inside the reserved '/l' short-link namespace. Link routes are matched first, so this form would be unreachable at that path.`
  }

  const redirect = app.redirects?.find((candidate) =>
    claimsLinkNamespace(candidate.from, languageCodes)
  )
  if (redirect !== undefined) {
    return `Redirect from '${redirect.from}' is inside the reserved '/l' short-link namespace. Link routes are matched before redirects, so this rule would never fire — express it as a link with that slug instead.`
  }

  return true
}

export const validateAllLinkRules = (app: AppForLinkValidation): true | string => {
  const fallbackError = validateFallbackTargets(app)
  return fallbackError === true ? validateReservedNamespace(app) : fallbackError
}
