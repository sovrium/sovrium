/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Inlines every component reference of a page BEFORE the page passes run.
 *
 * ─── WHY ONE EXPANSION AND NOT A FIX PER PASS ──────────────────────────────
 *
 * A page names a reusable template by `{ component: 'name' }` or
 * `{ $ref: 'name', vars }`, and until this pass the RENDERER was the only thing
 * that ever looked inside one — long after every page pass had run. Each pass
 * that walks the tree (table of contents, drawer dispatch, data-bound islands,
 * derived breadcrumbs, form pre-fill, the `$query` / `$app` / route-param
 * substitutions) returned a reference untouched, so a template placed by name
 * silently behaved differently from the same markup written inline: a TOC that
 * listed nothing, a list with no island, a drawer the row click could not find.
 * Every new pass would have repeated it. Expanding the references once, at the
 * front of the pipeline, makes "placed by reference" and "written inline" the
 * same tree for every pass that exists and every one still to be written.
 *
 * ─── WHAT A REFERENCE STILL CARRIES ────────────────────────────────────────
 *
 * The template name names the rendered element (`data-component`, the
 * `component-<name>` test id, a template's Open Graph meta), so each expanded
 * root remembers it under {@link EXPANDED_REFERENCE_KEY}. The renderer reads it
 * back where it used to read the reference itself.
 *
 * ─── WHAT IS LEFT A REFERENCE ──────────────────────────────────────────────
 *
 * A reference to a template that does not exist (the renderer draws its error
 * box and lists the available names), and a reference that would recurse into
 * a template already being expanded on the same path. Both reach the renderer
 * exactly as before. Only `children` — a node's own, and each `responsive`
 * breakpoint's — is descended: a field that happens to hold a `{ component }`
 * shape elsewhere (a specimen's `subject`) is not a child. The breakpoint
 * children are rendered server-side like any other, so a reference left
 * unexpanded there would reach the renderer AFTER the visibility passes and
 * draw its template's gated blocks for every reader.
 */

import { extractComponentReference } from '@/presentation/render/registry/component-reference-handler'
import { resolveComponent } from '@/presentation/render/registry/component-resolution'
import {
  EXPANDED_REFERENCE_KEY,
  isComponentReferenceNode,
} from '@/presentation/render/resolve/component-reference'
import type { Components } from '@/domain/models/app/components'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

type Item = Component | SimpleComponentReference | ComponentReference | string

/** Expand one reference, or hand it back when it cannot be expanded. */
function expandReference(
  item: SimpleComponentReference | ComponentReference,
  templates: Components,
  path: ReadonlySet<string>
): Item {
  const { refName, vars } = extractComponentReference(item)
  if (path.has(refName)) return item
  if (!templates.some((template) => template.name === refName)) return item
  const resolved = resolveComponent(refName, templates, vars)
  if (resolved === undefined) return item
  const expanded = expandNode(resolved.component, templates, new Set([...path, refName]))
  return {
    ...(expanded as Component),
    [EXPANDED_REFERENCE_KEY]: { name: resolved.name, vars },
  } as unknown as Component
}

/** Expand a node and, recursively, every reference among its `children`. */
function expandNode(item: Item, templates: Components, path: ReadonlySet<string>): Item {
  if (typeof item !== 'object' || item === null) return item
  if (isComponentReferenceNode(item)) {
    return expandReference(item as SimpleComponentReference | ComponentReference, templates, path)
  }
  return expandResponsiveChildren(expandOwnChildren(item, templates, path), templates, path)
}

/** Expand the references among a node's own `children`. */
function expandOwnChildren(item: object, templates: Components, path: ReadonlySet<string>): object {
  const { children } = item as { readonly children?: unknown }
  if (!Array.isArray(children) || children.length === 0) return item
  const expandedChildren = expandItems(children as readonly Item[], templates, path)
  return expandedChildren === children ? item : { ...item, children: expandedChildren }
}

/** Expand the references among every `responsive.<bp>.children`. */
function expandResponsiveChildren(
  item: object,
  templates: Components,
  path: ReadonlySet<string>
): Item {
  const { responsive } = item as { readonly responsive?: unknown }
  if (typeof responsive !== 'object' || responsive === null) return item as Item
  const entries = Object.entries(responsive as Record<string, unknown>)
  const expanded = entries.map(([, variant]) => {
    const { children } = (variant ?? {}) as { readonly children?: unknown }
    if (!Array.isArray(children) || children.length === 0) return variant
    const expandedChildren = expandItems(children as readonly Item[], templates, path)
    return expandedChildren === children
      ? variant
      : { ...(variant as Record<string, unknown>), children: expandedChildren }
  })
  if (expanded.every((variant, i) => variant === entries[i]?.[1])) return item as Item
  const next = Object.fromEntries(entries.map(([breakpoint], i) => [breakpoint, expanded[i]]))
  return { ...item, responsive: next } as unknown as Component
}

/** Identity-preserving map: an unchanged list comes back by reference. */
function expandItems(
  items: readonly Item[],
  templates: Components,
  path: ReadonlySet<string>
): readonly Item[] {
  const expanded = items.map((item) => expandNode(item, templates, path))
  return expanded.some((item, index) => item !== items[index]) ? expanded : items
}

/**
 * Inline every resolvable component reference in a component list.
 *
 * @param components - A page's component list (or any subtree of one)
 * @param templates - `app.components`, the templates references name
 * @returns The list with each reference replaced by its expanded template; the
 *   same array when there was nothing to expand
 */
function expandComponentReferences(
  components: Page['components'],
  templates: Components | undefined
): Page['components'] {
  if (!components || !templates || templates.length === 0) return components
  return expandItems(
    components as readonly Item[],
    templates,
    new Set<string>()
  ) as Page['components']
}

/**
 * The page with its references expanded — see the module note. Returns the
 * same page object when it names no template.
 */
function expandPageReferences(page: Page, templates: Components | undefined): Page {
  const components = expandComponentReferences(page.components, templates)
  return components === page.components ? page : { ...page, components }
}

/**
 * {@link expandPageReferences} over a route match, passing a miss through —
 * the shape `renderPageByPath` holds at the point the page is first read.
 */
export function expandMatchedPageReferences<T extends { readonly page: Page }>(
  match: T | undefined,
  templates: Components | undefined
): T | undefined {
  if (match === undefined) return undefined
  const page = expandPageReferences(match.page, templates)
  return page === match.page ? match : { ...match, page }
}
