/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Mark the tab sets whose panels are an ADDRESS, so the unopened ones need not
 * travel.
 *
 * ## The cost that was refused, and why this shape does not pay it
 *
 * `[internal ref]` left the second half of its contract deferred and
 * costed: a panel nobody addressed is carried once rather than not at all, and
 * getting to "not at all" was priced at three permanent costs — a RESERVED
 * query parameter on every page URL, a page-cache rule for that undeclared
 * parameter, and a round trip on every tab activation everywhere.
 *
 * None of the three is paid here, because the deferral is not applied to every
 * tab set. It is applied to the ones that ALREADY declared themselves
 * addressable — `defaultTab: '$query.tab'` over a `page.query` property the
 * author declared, which is the operator console's own shape and the shape the
 * criterion's fixture is written in. That single condition answers all three:
 *
 *  1. The parameter is the author's own DECLARED one, so nothing is reserved
 *     and nothing can collide — the collision is a decode error today.
 *  2. `buildPageCacheKey` already keys off the resolved values of DECLARED
 *     query properties (`pageQueryVariantKey`), so the per-panel address is in
 *     the cache key before this file exists. There is no rule to add.
 *  3. The round trip is paid only by a tab set the author made an address.
 *     Every tab set whose `defaultTab` is a literal keeps today's behaviour to
 *     the byte: all panels serialised, switching instant and offline-safe.
 *
 * ## Why the annotation, rather than reading `defaultTab` in the renderer
 *
 * By the time any renderer runs, `resolvePageQueryProps` has already replaced
 * `'$query.tab'` with the resolved value (`'summary'`), so the binding is gone
 * and the renderer cannot tell an addressed tab set from a hard-coded one. This
 * pass therefore runs BEFORE that substitution and plumbs the parameter NAME
 * back onto the node as a render-time-only field, exactly as `resolvePageToc`
 * attaches `tocHeadings` and `resolvePageCodeHighlight` attaches
 * `codeHighlight`. The schema author never writes `lazyPanelParam`, and no
 * `AppSchema` key is added — an opt-in `lazy: true` would have been new public
 * config surface for something the author has already said.
 *
 * A page declaring no `query` is returned by reference, so a tree with no
 * addressable tab set pays one `Object.keys` and nothing else.
 */

import type { Page } from '@/domain/models/app/pages'

/**
 * The render-time-only field this pass attaches: the DECLARED `page.query`
 * property name a tab set's `defaultTab` reads its address from.
 */
export const LAZY_PANEL_PARAM_KEY = 'lazyPanelParam'

/**
 * A whole-string `$query.<name>` binding, by the same lowercase kebab-case name
 * grammar `query-props-resolver.ts` enforces. Anchored at both ends: a
 * `defaultTab` that merely CONTAINS a reference (`'lens-$query.tab'`) is not an
 * address for a panel and must keep today's behaviour. A single static literal,
 * never built from input (`sovrium/no-dynamic-regexp`).
 */
const WHOLE_QUERY_BINDING = /^\$query\.([a-z][a-z0-9-]*)$/

/** Read `children` off a node, or `undefined` — the tolerant shape-read the sibling walkers use. */
function childrenOf(node: Record<string, unknown>): readonly unknown[] | undefined {
  const { children } = node
  return Array.isArray(children) ? (children as readonly unknown[]) : undefined
}

/** The declared query property a node's `defaultTab` binds to, if it binds to one at all. */
function boundParam(
  node: Record<string, unknown>,
  declared: ReadonlySet<string>
): string | undefined {
  if (node['type'] !== 'tabs') return undefined
  const { defaultTab } = node
  if (typeof defaultTab !== 'string') return undefined
  const match = WHOLE_QUERY_BINDING.exec(defaultTab)
  const name = match?.[1]
  // An UNDECLARED name is left alone for the same reason the substitution pass
  // leaves it verbatim: declaration is what bounds the value, and deferring
  // panels behind an unbounded parameter would open exactly the response space
  // `page.query` exists to close.
  return name !== undefined && declared.has(name) ? name : undefined
}

/** Annotate one node and, whatever it is, its children. */
function annotate(node: unknown, declared: ReadonlySet<string>): unknown {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) return node
  const record = node as Record<string, unknown>
  // A `$ref` placeholder is not a component yet; expansion happens downstream.
  if ('$ref' in record) return node
  const children = childrenOf(record)
  const walked =
    children === undefined ? undefined : children.map((child) => annotate(child, declared))
  const param = boundParam(record, declared)
  if (param === undefined && walked === undefined) return node
  return {
    ...record,
    ...(walked === undefined ? {} : { children: walked }),
    ...(param === undefined ? {} : { [LAZY_PANEL_PARAM_KEY]: param }),
  }
}

/**
 * Attach {@link LAZY_PANEL_PARAM_KEY} to every tab set addressed by a declared
 * query property. Pure; runs BEFORE `resolvePageQueryProps`.
 */
export function resolveTabsLazyPanels(page: Page): Page {
  const declared = new Set(Object.keys(page.query ?? {}))
  if (declared.size === 0 || page.components === undefined) return page
  return {
    ...page,
    components: page.components.map((component) =>
      annotate(component, declared)
    ) as Page['components'],
  }
}
