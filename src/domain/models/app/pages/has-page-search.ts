/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

/**
 * `hasPageSearchComponent` — pure Domain predicate deciding whether the app
 * schema contains any `type: 'pageSearch'` component anywhere in its page
 * tree. This is the activation gate for the public-pages search feature: the
 * indexer runs only when this predicate is true. No env var, no top-level
 * config — the schema declares intent, the build/start path activates it.
 *
 * ## Traversal
 *
 * Visits, in order:
 *
 * 1. Each page in `app.pages[]`
 * 2. Each top-level component in `page.components[]`
 * 3. Each nested component in any container's `children[]` (recursive)
 * 4. `$ref` / `component` references: when a page-component entry is a
 *    reference (`{ $ref: 'name', vars }`, `{ component: 'name' }`, …) the
 *    matching definition in `app.components[]` is resolved and its subtree
 *    is searched as well.
 *
 * A `Set<string>` of already-resolved reference names guards against
 * cycles (a shared component referencing itself transitively).
 *
 * ## Why a predicate, not a flag
 *
 * Mirrors the existing component-tree predicates (e.g.
 * `componentTreeHasDataSource` in `src/domain/services/page-cacheability.ts`):
 * derived from the schema, never written to it. The schema author signals
 * intent by placing a `pageSearch` component; the build path observes that
 * intent through this predicate.
 *
 * @param app - Validated application schema.
 * @returns `true` when at least one `type: 'pageSearch'` component is reachable.
 *
 * @see src/domain/models/app/pages/components/component-types/content/page-search.ts
 */
export const hasPageSearchComponent = (app: App): boolean => {
  const sharedComponents = app.components ?? []
  const sharedByName = new Map<string, unknown>(
    sharedComponents.map((component) => [component.name, component])
  )

  return (app.pages ?? []).some((page) =>
    componentTreeHasPageSearch(page.components ?? [], sharedByName, new Set())
  )
}

/** Read the reference name from `{ $ref }` or `{ component }`, if present. */
const readRefName = (node: Readonly<Record<string, unknown>>): string | undefined => {
  if (typeof node.$ref === 'string') return node.$ref
  if (typeof node.component === 'string') return node.component
  return undefined
}

/** Recurse into `children` (when an array); otherwise the subtree is empty. */
const recurseChildren = (
  node: Readonly<Record<string, unknown>>,
  sharedByName: ReadonlyMap<string, unknown>,
  visiting: ReadonlySet<string>
): boolean => {
  const { children } = node
  return Array.isArray(children)
    ? componentTreeHasPageSearch(children, sharedByName, visiting)
    : false
}

/**
 * Resolve a `$ref` / `component` reference and search the referenced subtree.
 * Returns `false` on cycles or unresolvable references (defensive — the
 * predicate is a search, not a validator).
 */
const inspectReferencedComponent = (
  refName: string,
  sharedByName: ReadonlyMap<string, unknown>,
  visiting: ReadonlySet<string>
): boolean => {
  if (visiting.has(refName)) return false
  const target = sharedByName.get(refName)
  if (target === null || typeof target !== 'object') return false
  const targetNode = target as Record<string, unknown>
  if (targetNode.type === 'pageSearch') return true
  const nextVisiting = new Set([...visiting, refName])
  return recurseChildren(targetNode, sharedByName, nextVisiting)
}

/**
 * Inspect a single tree item:
 * - Primitive / non-object → no match.
 * - Reference form (`$ref` / `component`) → resolve + search the target subtree.
 * - Direct component → check `type` then recurse into `children`.
 */
const inspectNode = (
  item: unknown,
  sharedByName: ReadonlyMap<string, unknown>,
  visiting: ReadonlySet<string>
): boolean => {
  if (item === null || typeof item !== 'object') return false
  const node = item as Record<string, unknown>

  const refName = readRefName(node)
  if (refName !== undefined) {
    return inspectReferencedComponent(refName, sharedByName, visiting)
  }

  if (node.type === 'pageSearch') return true
  return recurseChildren(node, sharedByName, visiting)
}

/**
 * Walks a component tree depth-first looking for a `type: 'pageSearch'` node.
 *
 * Each item is one of:
 * - A direct component object — inspect its `type` and recurse into `children`.
 * - A `$ref` / `component` reference — resolve via `sharedByName` and recurse
 *   into the referenced component's subtree. `visiting` tracks the resolution
 *   chain to short-circuit cycles.
 * - Anything else (primitives, strings) — ignored.
 */
function componentTreeHasPageSearch(
  items: readonly unknown[],
  sharedByName: ReadonlyMap<string, unknown>,
  visiting: ReadonlySet<string>
): boolean {
  return items.some((item) => inspectNode(item, sharedByName, visiting))
}
