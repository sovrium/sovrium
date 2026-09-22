/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Share-namespace cross-validation.
 *
 * `/s` is reserved for the anonymous design-system share reader ([internal ref]
 * amendment A3 Part 2), and that route is mounted BEFORE both the redirect
 * table and page resolution. So a page, form, or redirect declaring a path
 * under `/s` is not merely redundant — it is permanently unreachable, with
 * nothing in the config or the logs saying why. That is the identical
 * silent-shadowing class `validateAllLinkRules` refuses to boot with for `/l`,
 * and it is refused here for the identical reason.
 *
 * WHY THE NAMESPACE IS RESERVED WHOLESALE, including the bare `/s` segment and
 * every sibling of `/s/design-system`: it keeps the future open at zero cost. A
 * second shareable projection can be added later without stranding a config
 * that had legitimately claimed the path in the meantime — and the cost of
 * reserving one more two-character prefix is far below the cost of a config
 * that renders nothing and explains nothing.
 *
 * WHAT THIS DOES **NOT** CHECK, matching `links-validation.ts` clause for
 * clause:
 *
 *  - **The public directory.** A `public/s/` folder would shadow the reader,
 *    but the filesystem is a runtime concern the schema has no view of. That
 *    half is handled by ORDERING — the share route mounts after static assets,
 *    so a real shipped file always wins.
 *  - **Tokens held by rows in `system.design_system_shares`.** The database is
 *    likewise invisible to the schema, and here the question cannot even arise:
 *    there is no `design.shares[]` and there must not be one, so the share
 *    namespace is database-only and has no config namespace to shadow. That is
 *    the sense in which this feature is structurally simpler than `/l`, which
 *    needs a whole precedence rule.
 *
 * A standalone module, mirroring `links-validation.ts`, so the `AppSchema`
 * filter chain stays shallow — every additional top-level `Schema.check` pushes
 * TypeScript's inference depth over the limit and collapses the derived `App`
 * type to `never`. This module is called from INSIDE the existing bundled
 * filter, never as a new one.
 */

import { stripLanguagePrefix } from '../redirects'

/** The reserved namespace, as a bare segment and as a prefix. */
const SHARE_NAMESPACE = '/s'
const SHARE_NAMESPACE_PREFIX = '/s/'

/** Minimal shape needed to validate the reserved share namespace. */
interface AppForShareValidation {
  readonly pages?: ReadonlyArray<{ readonly name: string; readonly path: string }>
  readonly forms?: ReadonlyArray<{ readonly name: string; readonly path?: string | undefined }>
  readonly redirects?: ReadonlyArray<{ readonly from: string }>
  readonly languages?: { readonly supported: ReadonlyArray<{ readonly code: string }> }
}

/**
 * Whether a declared path lands inside the reserved share namespace.
 *
 * The language prefix is stripped first, using the SAME helper the redirect
 * matcher uses. That matters: a French page declared at `/fr/s/charte` resolves
 * to `/s/charte` once the locale segment is removed, which is exactly the path
 * the share route would answer — so comparing the raw string would miss it.
 *
 * The prefix test is `'/s/'` and not `'/s'`, which is why `/styleguide` is
 * accepted: a naive `startsWith('/s')` would reserve a fifth of the alphabet.
 */
const claimsShareNamespace = (path: string, languageCodes: ReadonlyArray<string>): boolean => {
  const { path: bare } = stripLanguagePrefix(path, languageCodes)
  return bare === SHARE_NAMESPACE || bare.startsWith(SHARE_NAMESPACE_PREFIX)
}

/**
 * Validate that nothing in the config claims a path under `/s`.
 *
 * Runs unconditionally — there is no `app.design.shares[]` to gate it on, and
 * there must not be one. The namespace is reserved by the product rather than
 * by the presence of config, so a `/s/pricing` page is unreachable on an
 * instance that has never minted a share and on one that mints daily.
 *
 * @returns `true` when valid, or an error message describing the first problem.
 */
export const validateAllShareRules = (app: AppForShareValidation): true | string => {
  const languageCodes = app.languages?.supported.map((language) => language.code) ?? []

  const page = app.pages?.find((candidate) => claimsShareNamespace(candidate.path, languageCodes))
  if (page !== undefined) {
    return `Page '${page.name}' declares path '${page.path}', which is inside the reserved '/s' design-system share namespace. Share routes are matched before page resolution, so this page would never render. Move it to another path.`
  }

  const form = app.forms?.find(
    (candidate) =>
      candidate.path !== undefined && claimsShareNamespace(candidate.path, languageCodes)
  )
  if (form?.path !== undefined) {
    return `Form '${form.name}' declares path '${form.path}', which is inside the reserved '/s' design-system share namespace. Share routes are matched first, so this form would be unreachable at that path.`
  }

  const redirect = app.redirects?.find((candidate) =>
    claimsShareNamespace(candidate.from, languageCodes)
  )
  if (redirect !== undefined) {
    return `Redirect from '${redirect.from}' is inside the reserved '/s' design-system share namespace. Share routes are matched before redirects, so this rule would never fire.`
  }

  return true
}
