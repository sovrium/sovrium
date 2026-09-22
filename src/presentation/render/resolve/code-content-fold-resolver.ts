/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Fold a system endpoint's ROWS into ONE `code` block's content
 * (`code.contentFrom`, [internal ref]).
 *
 * ─── WHY THIS IS NOT A ROW TEMPLATE ────────────────────────────────────────
 *
 * `expandSystemRowTemplates` next door already clones an arbitrary child
 * template once per row, and it is what let `/env` become config. It cannot
 * serve a code block, for two measured reasons:
 *
 *  1. `expandDataSourceChildren` wraps every row's clone in a SYNTHESIZED
 *     `{ type: 'li' }`. Inside a `<pre>` that is invalid markup, and it renders
 *     as a bulleted list wearing a code frame.
 *  2. `resolvePageCodeHighlights` reads `component.content` and nothing else,
 *     so a children-based block loses Shiki attribution entirely — and the copy
 *     affordance, which resolves its payload from the command `<pre>`, would be
 *     copying list items.
 *
 * `renderCode` DOES fall back to `content ?? renderedChildren`, so the
 * workaround typechecks and renders garbage. That is precisely why this is a
 * field and a pass rather than a note telling authors to use `children`.
 *
 * ─── WHERE IT RUNS, AND WHY THAT IS THE ONLY PLACE ─────────────────────────
 *
 * Between `expandSystemRowTemplates` and `resolvePageCodeHighlights`:
 *
 *   applyPageLevelRecordBinding → expandSystemRowTemplates → THIS PASS
 *     → … → resolvePageCodeHighlights
 *
 * After the row expansion, because the nesting refusal
 * (`component-rule-validation.ts`) rules a `contentFrom` inside a row template
 * out at DECODE, so nothing this pass sees was minted by that one. And strictly
 * BEFORE the highlight pass, because the highlighter reads `content`: a fold
 * that ran later would produce an unattributed block, which is exactly the
 * failure a children-based workaround already has.
 *
 * ─── THE TWO `$record` NAMESPACES DO NOT COLLIDE ───────────────────────────
 *
 * A page may carry BOTH a page-level `{ system }` record and a fold.
 * `substituteRecordInComponent` walks `content`, `props`, `dataSource` and
 * `children` — never `contentFrom` — so the page record cannot reach a fold's
 * `template`, and the fold's rows cannot reach the page's own `content`. The
 * `/api` console page depends on exactly that separation: its curl blocks name
 * `$record.origin` from the page record while its example block folds
 * `$record.name` over the same endpoint's `tables` rows.
 *
 * ─── IDENTITY: THE CALLER'S, NOT THE SERVER'S ──────────────────────────────
 *
 * The read goes through the injected {@link SystemRowsFetcher} — the same seam
 * `page.redirectToFirst`, the `select` option source and the row-template
 * expansion already share, which forwards the caller's own identity headers. A
 * render-path read on the SERVER's authority would hand every visitor whatever
 * the endpoint shows an administrator (rule S1), and a page carrying a fold may
 * be public.
 *
 * ─── FAIL-CLOSED, AND NEVER THE TEMPLATE ───────────────────────────────────
 *
 * No fetcher (a static build, a unit test), a read that throws, an endpoint the
 * caller may not see, a non-array payload: every one of them is ZERO ROWS, and
 * zero rows render `empty` when the author declared one and an empty block
 * otherwise. The template is never rendered — a leaked `$record.name` in a
 * block an operator is invited to paste into a shell is worse than silence.
 *
 * @see src/domain/models/app/pages/components/component-types/content/code-content-from.ts
 */

import { flattenRecordFields } from '@/domain/models/app/pages/record-envelope'
import { substituteRecordVars } from '@/presentation/render/resolve/data-source-contracts'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { CodeContentFrom } from '@/domain/models/app/pages/components/component-types/content/code-content-from'
import type { SystemRowsFetcher } from '@/presentation/render/resolve/first-object-redirect-resolver'

/** Envelope default, shared with every other rows consumer. */
const DEFAULT_ROWS_KEY = 'items'

/**
 * What joins the per-row lines when the author declares no `separator`.
 *
 * A newline, because a code block is line-per-row in every case this field was
 * designed for. The schema documents the default rather than DECODING it: the
 * domain layer may not name `Effect`, and every `withDecodingDefault*` spelling
 * takes one — so the default lives here, at the single point that reads it.
 */
const DEFAULT_SEPARATOR = '\n'

/**
 * Hard ceiling on the rows one fold may consume.
 *
 * The result is server-rendered INTO the page, so an unbounded read inlines the
 * endpoint's whole corpus into the HTML — a page-weight cliff an author cannot
 * see coming from the config. Mirrors the row-template expansion's own ceiling.
 */
const MAX_FOLDED_ROWS = 1000

/** A `code` node carrying a fold binding, as the walk recognises it. */
type FoldNode = Component & { readonly contentFrom: CodeContentFrom }

function isFoldNode(node: unknown): node is FoldNode {
  if (typeof node !== 'object' || node === null) return false
  const component = node as { readonly type?: unknown; readonly contentFrom?: unknown }
  if (component.type !== 'code') return false
  const binding = component.contentFrom
  if (typeof binding !== 'object' || binding === null) return false
  return typeof (binding as { endpoint?: unknown }).endpoint === 'string'
}

/**
 * Append a binding's STATIC query parameters to its endpoint.
 *
 * Values are percent-encoded, so a parameter carrying an `&` cannot inject a
 * second one. Mirrors `system-rows-template-resolver.ts` rather than sharing
 * its private helper, so neither module reaches into the other's internals for
 * a six-line string build.
 */
function withStaticQuery(endpoint: string, query: CodeContentFrom['query']): string {
  if (query === undefined) return endpoint
  const entries = Object.entries(query)
  if (entries.length === 0) return endpoint
  const search = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}${search}`
}

/**
 * Fetch a fold's rows and turn them into the node's `content`.
 *
 * `contentFrom` is REMOVED from the resolved node. The binding has been spent,
 * and a stale one left behind would be re-read by any later pass that grew the
 * same recognition — the same discipline the row-template expansion applies to
 * `dataSource` for a much louder reason.
 *
 * The joined result is plain TEXT by construction: `codeBlockComponent` renders
 * `content` through React children (or through Shiki's own escaped, sanitized
 * fragment when a `language` is declared), never through the
 * `dangerouslySetInnerHTML` sink that `renderHTMLElement` reaches when a
 * content string starts with `<`. So a row value beginning with `<` is
 * displayed, not executed, and no plain-text pin is needed here.
 */
async function foldNode(
  node: FoldNode,
  fetchSystemRows: SystemRowsFetcher | undefined
): Promise<Component> {
  const binding = node.contentFrom
  const rows =
    fetchSystemRows === undefined
      ? []
      : await fetchSystemRows(
          withStaticQuery(binding.endpoint, binding.query),
          binding.rowsKey ?? DEFAULT_ROWS_KEY
        ).catch(() => [])

  const { contentFrom: _spent, ...rest } = node as Component & { contentFrom?: unknown }

  const content =
    rows.length === 0
      ? (binding.empty ?? '')
      : [...rows]
          .slice(0, MAX_FOLDED_ROWS)
          // A row from `/api/tables/:t/records` arrives as `{ id, fields: {…} }`
          // while every admin read endpoint answers flat rows. Lifting the bag
          // through the SHARED helper is what lets one template name
          // `$record.label` whichever endpoint it was pointed at — and the
          // helper's discriminator is plain-OBJECT rather than presence, so a
          // row whose `fields` is an array of field DEFINITIONS
          // (`/api/admin/tables`) is left alone.
          .map((row) => substituteRecordVars(binding.template, flattenRecordFields(row)))
          .join(binding.separator ?? DEFAULT_SEPARATOR)

  return { ...(rest as Component), content }
}

/**
 * Walk one node, folding any binding found at or below it.
 *
 * A folded node is not recursed into: a `code` block's children are not a place
 * a second fold can live, and the decode refusals already forbid declaring
 * `children` beside a `contentFrom` at all.
 */
async function mapNode(
  node: unknown,
  fetchSystemRows: SystemRowsFetcher | undefined
): Promise<unknown> {
  if (Array.isArray(node)) {
    const mapped = await Promise.all(node.map((child) => mapNode(child, fetchSystemRows)))
    return mapped.every((child, index) => child === node[index]) ? node : mapped
  }
  if (typeof node !== 'object' || node === null) return node
  if (isFoldNode(node)) return foldNode(node, fetchSystemRows)

  const { children } = node as { readonly children?: unknown }
  if (children === undefined) return node
  const mappedChildren = await mapNode(children, fetchSystemRows)
  if (mappedChildren === children) return node
  return { ...(node as Record<string, unknown>), children: mappedChildren }
}

/**
 * Resolve every `code.contentFrom` fold on a page.
 *
 * Returns the SAME page when nothing matched, so a page with no fold — which is
 * nearly every page — pays one walk and no copy.
 */
export async function foldCodeContentFrom(
  page: Page,
  fetchSystemRows: SystemRowsFetcher | undefined
): Promise<Page> {
  if (page.components === undefined) return page
  const components = await mapNode(page.components, fetchSystemRows)
  if (components === page.components) return page
  return { ...page, components: components as Page['components'] }
}
