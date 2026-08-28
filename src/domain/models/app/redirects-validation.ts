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

import { isAbsoluteRedirectTarget, stripLanguagePrefix } from './redirects'

/** A single redirect rule, in the shape this cross-validation needs. */
interface RedirectRuleForValidation {
  readonly from: string
  readonly to: string
  /** Whether a root-relative target inherits the matched language prefix (default: true). */
  readonly localizeTarget?: boolean
}

/** Minimal shape needed to validate redirect rules against pages. */
interface AppForRedirectValidation {
  readonly redirects?: ReadonlyArray<RedirectRuleForValidation>
  readonly pages?: ReadonlyArray<{ readonly name: string; readonly path: string }>
  readonly languages?: { readonly supported: ReadonlyArray<{ readonly code: string }> }
}

/**
 * True when `from` is matched LOCALE-AGNOSTICALLY at runtime — i.e. it does not
 * itself begin with a configured language segment, so it matches the bare path
 * AND every language-prefixed variant (`/docs`, `/en/docs`, `/fr/docs`).
 *
 * This is the precondition of both locale checks below: a `from` that already
 * carries a locale is matched literally, so neither the double prefix nor the
 * opt-out self-loop can arise from it.
 */
const isLocaleAgnosticFrom = (from: string, languageCodes: ReadonlyArray<string>): boolean =>
  stripLanguagePrefix(from, languageCodes).language === undefined

/**
 * Validate that no redirect `from` shadows a declared page path.
 *
 * The redirect is evaluated BEFORE page resolution, so a rule whose `from`
 * equals a live page's `path` makes that page permanently unreachable.
 */
const validateNoPageShadowing = (
  redirects: ReadonlyArray<RedirectRuleForValidation>,
  pages: ReadonlyArray<{ readonly name: string; readonly path: string }> | undefined,
  languageCodes: ReadonlyArray<string>
): true | string => {
  if (!pages) return true
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

/**
 * L1 — reject a locale-agnostic `from` whose root-relative `to`
 * already begins with a configured language code.
 *
 * This is the rule an author reaches for when a bare `/docs` 404s while
 * `/en/docs` serves, and it is destructive: `from` is matched
 * locale-agnostically, so the LIVE `/en/docs` matches it too and the target is
 * prefixed a SECOND time — English docs go to `/en/en/docs`, French to
 * `/fr/en/docs`, and both 404.
 *
 * Invisible to the decode-time filters: the self-redirect filter compares
 * AUTHORED STRINGS (`/docs` ≠ `/en/docs`) and the cycle detector never applies
 * locale prefixing, so a collision that exists only at request time reaches
 * neither. It also cannot live on `RedirectsSchema`, which is a bare
 * `Schema.Array` decoded with no app context and structurally cannot know
 * whether `en` is a configured locale or an ordinary path segment.
 */
const validateNoDoubleLocalePrefix = (
  redirects: ReadonlyArray<RedirectRuleForValidation>,
  languageCodes: ReadonlyArray<string>
): true | string => {
  const offender = redirects.find(
    (rule) =>
      // An absolute target leaves the app and is emitted verbatim — nothing
      // ever prefixes it, so it cannot be double-prefixed.
      !isAbsoluteRedirectTarget(rule.to) &&
      // The opt-out emits the target verbatim, so it produces no double prefix.
      // Its own failure mode is L2 below.
      rule.localizeTarget !== false &&
      isLocaleAgnosticFrom(rule.from, languageCodes) &&
      stripLanguagePrefix(rule.to, languageCodes).language !== undefined
  )
  if (offender === undefined) return true
  return `Redirect '${offender.from}' targets '${offender.to}', which already begins with a configured language code — but '${offender.from}' is matched locale-agnostically, so the live '${offender.to}' matches it too and the target is prefixed a second time (e.g. '/en${offender.to}'), which 404s. Point 'to' at a locale-agnostic path so the engine prefixes it exactly once.`
}

/**
 * L2 — reject a `localizeTarget: false` rule whose verbatim target
 * equals its own `from` under some configured language code.
 *
 * Adding the opt-out to the L1 shape fixes the double prefix and creates
 * something worse: `from` still matches every locale variant, so a request to
 * `/en/docs` matches and the verbatim target sends it straight back to
 * `/en/docs` — an infinite browser loop that `sovrium validate` approves.
 *
 * Deliberately NARROW. `{ from: '/login', to: '/_admin/login',
 * localizeTarget: false }` is live in `apps/website` and is the entire reason
 * `localizeTarget` exists; `{ from: '/legacy', to: '/en/docs',
 * localizeTarget: false }` is odd taste but does not loop. Neither is caught.
 */
const validateNoOptOutSelfLoop = (
  redirects: ReadonlyArray<RedirectRuleForValidation>,
  languageCodes: ReadonlyArray<string>
): true | string => {
  const offender = redirects.find(
    (rule) =>
      rule.localizeTarget === false &&
      !isAbsoluteRedirectTarget(rule.to) &&
      isLocaleAgnosticFrom(rule.from, languageCodes) &&
      languageCodes.some((code) => rule.to === `/${code}${rule.from}`)
  )
  if (offender === undefined) return true
  return `Redirect '${offender.from}' sets 'localizeTarget: false' on the target '${offender.to}', which is '${offender.from}' under a configured language code — but 'from' still matches every locale variant, so a request to '${offender.to}' matches this rule and is sent back to itself, looping the browser forever. Remove the rule: the engine already resolves an unprefixed path to its localized page.`
}

/**
 * Validate every cross-block redirect rule: page shadowing, the double locale
 * prefix (L1), and the localize-target opt-out self-loop (L2).
 *
 * Signature deliberately unchanged so the existing `AppSchema` call picks the
 * new checks up for free — every additional top-level `Schema.filter` pushes
 * TypeScript's inference depth over the limit and collapses the derived `App`
 * type to `never`.
 *
 * @returns `true` when valid, or an error message describing the first problem.
 */
export const validateAllRedirectRules = (app: AppForRedirectValidation): true | string => {
  const { redirects } = app
  if (!redirects) return true

  const languageCodes = app.languages?.supported.map((language) => language.code) ?? []

  // The two loop checks run FIRST. A rule can trip both a loop check and the
  // shadowing check at once — `{ from: '/docs', to: '/en/docs' }` beside a live
  // `/en/docs` page does exactly that — and the loop is the more severe of the
  // two: shadowing makes one page unreachable, a loop breaks the browser. The
  // message the author reads should name the failure that will actually bite.
  const doublePrefix = validateNoDoubleLocalePrefix(redirects, languageCodes)
  if (doublePrefix !== true) return doublePrefix

  const selfLoop = validateNoOptOutSelfLoop(redirects, languageCodes)
  if (selfLoop !== true) return selfLoop

  return validateNoPageShadowing(redirects, app.pages, languageCodes)
}
