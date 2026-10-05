/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeHtml } from '@/domain/kernel/markdown/markdown-renderer'
import { resolveAppVarValues, type AppVarName } from '@/domain/models/app/pages/app-vars'
import { withPlainTextPin } from './record-substitution'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Every `$app.<name>` reference reachable in a page. A single STATIC literal —
 * the capture is what decides whether a match is substituted, so no regular
 * expression is ever built from input (`sovrium/no-dynamic-regexp`).
 *
 * The name grammar is deliberately WIDER than the closed set: matching
 * `$app.description` is what lets the substitution decide to leave it alone,
 * where a regex that only matched the four known names would have skipped it
 * silently and made "left verbatim" an accident rather than a decision.
 */
const APP_REFERENCE = /\$app\.([a-zA-Z][a-zA-Z0-9]*)/g

/**
 * Substitute the serving app's own facts into every `$app.<name>` reference on
 * the page.
 *
 * Runs BEFORE data-source resolution and before breadcrumb derivation, so a
 * token is usable anywhere a string is — component content, a prop, an `href`,
 * a breadcrumb's root label — rather than in the handful of places a renderer
 * happens to walk.
 *
 * A reference the app cannot answer is left VERBATIM: any name outside the
 * closed set, and `$app.origin` outside a request. A blank would be
 * indistinguishable from a formatting bug, and the surviving literal is how an
 * author notices.
 *
 * `$app.version` is the ONE name that always resolves — to the EMPTY STRING when
 * the app declares none. That is not an exception to the rule above so much as a
 * case where its premise fails: an absent version is a permanent, legal property
 * of a valid config, so a surviving literal would fire on CORRECT configs and
 * teach nobody anything. `resolveAppVarValues` carries the full argument,
 * including why it is deliberately not generalised to the other three.
 *
 * ─── WHY `basePath` IS FORWARDED RATHER THAN DEFAULTED HERE ────────────────
 *
 * `resolveAppVarValues` treats an ABSENT base as unanswerable and leaves the
 * token verbatim, so a caller that was never threaded the value cannot make a
 * MOUNTED page print a root-relative address — a well-formed path into the
 * operator's own app, which 404s, and is the failure mode that looks most like
 * success. This resolver keeps that contract and forwards what it was given.
 *
 * The `?? ''` that turns "not mounted" into the empty base belongs one frame up,
 * in `renderPageByPath`, because that is the first place absence has a MEANING:
 * every mount passes its base explicitly, so an absent one there is a standalone
 * app at the site root, whose base is `''` as an ANSWER rather than as a guess.
 *
 * ─── AND `engineVersion` IS FORWARDED THE SAME WAY, WITH NO DEFAULT ────────
 *
 * The engine always HAS a version, so an absent one here never means "correctly
 * undeclared" — it means this render was never handed one, which is a wiring
 * fault only a developer can fix. The surviving `$app.engineVersion` literal is
 * the loud signal that says so; blanking it would ship `(Sovrium v)` to an
 * operator, which reads as a product that forgot its own name.
 *
 * Pure, and a page carrying no reference is returned by reference.
 *
 * @param serving - the two facts about this render that neither the page nor
 *   the config carries: where the app is MOUNTED and which engine is running
 *   it. Grouped rather than passed loose because they share one rule — an
 *   absent member is unanswerable, never a default — and because `origin` above
 *   would otherwise be the only one of three siblings with its own parameter.
 */
export function resolvePageAppVars(
  page: Page,
  app: App,
  origin: string | undefined,
  serving?: {
    readonly basePath?: string
    readonly engineVersion?: string
    readonly path?: string
  }
): Page {
  const values = resolveAppVarValues(app, origin, serving)

  const substitute = (str: string): string => {
    if (!str.includes('$app.')) return str
    // An author HTML template (`<p>Nothing at $app.path</p>`) reaches the raw
    // HTML sink, so each value it takes is escaped: `$app.path` is whatever
    // address a visitor typed, decoded, and `$app.origin` can come from a
    // request header. A text template is escaped by React on output instead,
    // and escaping it here would print the entities.
    const encode = str.trim().startsWith('<') ? escapeHtml : (value: string) => value
    return str.replaceAll(APP_REFERENCE, (match, name: string) => {
      const value = values[name as AppVarName]
      return value === undefined ? match : encode(value)
    })
  }

  return {
    ...page,
    ...(page.components !== undefined
      ? { components: substituteDeep(page.components, substitute) as Page['components'] }
      : {}),
    ...(page.layout !== undefined
      ? { layout: substituteDeep(page.layout, substitute) as Page['layout'] }
      : {}),
  }
}

/** Does a `content` string start with markup — the renderer's raw-HTML test? */
const startsAsMarkup = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().startsWith('<')

/**
 * {@link mapStringsDeep}, plus the one decision a string-level walk cannot
 * take: whether a substituted value turned an author TEXT template into markup.
 *
 * `renderHTMLElement` renders `content` as raw HTML when it starts with `<`, and
 * `$app.origin` and `$app.path` are built from the request — a header, an
 * address a visitor typed. A bare `$app.origin` template does not start with
 * `<`, so it is left unescaped for React to escape; a value that starts with `<`
 * would then flip the element onto the raw-HTML branch and build whatever it
 * spelled. The branch is decided by what the AUTHOR wrote: when the author's
 * template is text and the substituted result would read as markup, the
 * content is pinned to text — the same pin `$record.*` substitution sets.
 */
const substituteDeep = (value: unknown, substitute: (str: string) => string): unknown => {
  if (typeof value === 'string') return substitute(value)
  if (Array.isArray(value)) return value.map((item) => substituteDeep(item, substitute))
  if (value === null || typeof value !== 'object') return value
  const node = value as Readonly<Record<string, unknown>>
  const mapped = Object.fromEntries(
    Object.entries(node).map(([key, entry]) => [key, substituteDeep(entry, substitute)])
  )
  const flipped = !startsAsMarkup(node['content']) && startsAsMarkup(mapped['content'])
  return flipped
    ? { ...mapped, props: withPlainTextPin(mapped['props'] as Component['props'], true) }
    : mapped
}
