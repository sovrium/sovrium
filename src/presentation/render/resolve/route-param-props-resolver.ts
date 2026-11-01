/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { substituteTemplatesDeep, type ValueEncoder } from './html-template-values'
import type { Page } from '@/domain/models/app/pages'

/**
 * Every `$param.<name>` reference reachable in a page.
 *
 * The grammar is COPIED, deliberately, from `PARAM_REFERENCE` in
 * `page-binding-validation.ts` — the rule that refuses an undeclared reference
 * at decode time. Declaration and use must agree on what a reference IS, or a
 * spelling one half accepts and the other ignores becomes a literal shipped to
 * the client. A single STATIC literal, never built from input
 * (`sovrium/no-dynamic-regexp`).
 */
const PARAM_REFERENCE = /\$param\.([A-Za-z_][A-Za-z0-9_]*)/g

/**
 * Replace every `$param.<name>` in one string with its matched segment, leaving
 * a name the route did not capture VERBATIM. Shared by the page-tree pass below
 * and the document head (`head-references.ts`).
 *
 * `encode` is applied to each substituted segment — `escapeHtml` for a raw HTML
 * template, nothing for text that React escapes on output. The head passes
 * none: its title is text, and an escape there would print `&lt;` in the tab.
 */
export const substituteRouteParams = (
  str: string,
  routeParams: Readonly<Record<string, string>>,
  encode: ValueEncoder = (value) => value
): string =>
  str.includes('$param.')
    ? str.replaceAll(PARAM_REFERENCE, (match, name: string) => {
        const value = routeParams[name]
        return value === undefined ? match : encode(value)
      })
    : str

/**
 * Substitute the matched route segments into every `$param.<name>` reference on
 * the page.
 *
 * ─── WHY EVERY STRING, AND NOT A LIST OF KEYS ──────────────────────────────
 *
 * `$param` shipped bound to two places: a rows endpoint's `:placeholder` and a
 * `dataSource.filter[].value`. That covers READING and nothing else. An
 * object-scoped surface also WRITES — it interpolates its selection into an
 * upload target and into per-row action URLs — and it hands that selection to
 * an island through serialised props. None of those is a data source, so all
 * three carried the literal text and the browser sent `$param.bucket` back to
 * the server as a path segment.
 *
 * Enumerating the keys a route value is useful in means the pass silently stops
 * covering each new one, which is a gap that fails exactly the way the thing it
 * guards does: in silence. So it walks string LEAVES, at parity with the
 * `$query` and `$app` passes, and with the decode rule that policed it.
 *
 * ─── WHAT IS DELIBERATELY OUT OF REACH ─────────────────────────────────────
 *
 *  - `page.meta`, from THIS pass. Its title and description may name a `$t:`
 *    key that is translated only when the head is built, per language, so a
 *    substitution here would miss every translated title. The head resolves
 *    `$param` (and `$app`) after that translation instead — see
 *    `head-references.ts`, which reuses {@link substituteRouteParams}. `$query`
 *    stays out of the head: a title is what a shared link and a search engine
 *    show, and must not be written by whoever crafts the query string.
 *  - `app.systemSources[]`. A catalogue entry has no host page whose `path`
 *    could declare the segment — the same reason `param` is absent from that
 *    schema.
 *  - The endpoint `:placeholder` grammar (`dataSource.system.param`). A
 *    different spelling with its own resolver in `bindRouteParams`, mirroring
 *    the client's `buildDetailEndpointUrl`. This regex cannot match it.
 *
 * ─── ORDERING ──────────────────────────────────────────────────────────────
 *
 * Runs on the render path BEFORE data-source resolution, and therefore before
 * `resolveIslandShortCircuit` serialises a component into `data-island-props`.
 * A substitution made later would arrive after the island had already been
 * handed the literal.
 *
 * A reference the route cannot answer is left VERBATIM, matching `$app.*`: the
 * decode rule guarantees the name is a declared segment, and a matched route
 * always captures a non-empty one, so this is unreachable from a booted app —
 * but a blank would be indistinguishable from a formatting bug.
 *
 * ─── A SEGMENT IS ALWAYS TEXT ─────────────────────────────────────────────
 *
 * A segment is whatever the visitor typed, decoded. Inside an author HTML
 * template it is HTML-escaped, and a text template it would flip onto the
 * raw-HTML branch is pinned to text — `substituteTemplatesDeep`, the rule the
 * `$app` and `$query` passes share.
 *
 * Pure, and a page carrying no reference is returned by reference.
 */
export function resolvePageRouteParams(
  page: Page,
  routeParams: Readonly<Record<string, string>>
): Page {
  const fill = (str: string, encode: ValueEncoder | undefined): string =>
    substituteRouteParams(str, routeParams, encode)

  return {
    ...page,
    ...(page.components !== undefined
      ? { components: substituteTemplatesDeep(page.components, fill) as Page['components'] }
      : {}),
    ...(page.layout !== undefined
      ? { layout: substituteTemplatesDeep(page.layout, fill) as Page['layout'] }
      : {}),
  }
}
