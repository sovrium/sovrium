/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

/**
 * A question asked of one component node.
 *
 * Receives the raw node rather than a decoded component: the walk runs over
 * `$ref`-resolved plain objects, and a predicate that needed a decoded shape
 * could not be asked about a shared component reached by name.
 */
export type ComponentMatcher = (node: Readonly<Record<string, unknown>>) => boolean

/**
 * `componentTreeHasType` — the shared component-tree search behind every
 * "does this app place a component of kind X anywhere?" predicate.
 *
 * Extracted from `has-page-search.ts`, which asked exactly this question for a
 * single literal and grew the traversal that answers it. A second caller
 * (`appRequiresAi`, which has to find an `ai-chat` under the
 * same nesting and the same `$ref` indirection) made a private copy of that
 * walk the wrong shape: two walks that must agree about references and cycles
 * cannot be kept in step by review.
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
 *    matching definition in `app.components[]` is resolved and its subtree is
 *    searched as well.
 *
 * A `Set<string>` of already-resolved reference names guards against cycles (a
 * shared component referencing itself transitively).
 *
 * ## Why a predicate, not a flag
 *
 * Mirrors the existing component-tree predicates (e.g.
 * `componentTreeHasDataSource` in `src/domain/models/app/pages/page-cacheability.ts`):
 * derived from the schema, never written to it. The schema author signals
 * intent by placing a component; the boot path observes that intent here.
 *
 * ## Why the caller supplies a PREDICATE, not a set of type names
 *
 * It used to take a `ReadonlySet<string>` of `type` literals, which was enough
 * while every question was "is this type anywhere in the tree". The catalogue
 * reshape ended that: merging two component types into one leaves questions
 * that are about a FIELD VALUE, not a name. `hasPageSearchComponent` has to
 * find a `search-input` whose `scope` is `page` and ignore one whose scope is
 * `subscribers` — the same type, and only one of them should make the boot path
 * build a search index.
 *
 * A set could not express that, and the alternative — matching the type and
 * re-walking the tree to check the field — would be a second walk that has to
 * agree with this one about `$ref` resolution and cycles. `componentTreeHasType`
 * builds the name-matching predicate for the callers that still want one.
 *
 * @param app - Validated application schema.
 * @param matches - Predicate over a component node; ANY match answers `true`.
 * @returns `true` when at least one matching component is reachable.
 */
export const componentTreeHasMatch = (app: App, matches: ComponentMatcher): boolean => {
  const sharedComponents = app.components ?? []
  const sharedByName = new Map<string, unknown>(
    sharedComponents.map((component) => [component.name, component])
  )

  return (app.pages ?? []).some((page) =>
    searchItems(page.components ?? [], matches, sharedByName, new Set())
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
  matches: ComponentMatcher,
  sharedByName: ReadonlyMap<string, unknown>,
  visiting: ReadonlySet<string>
): boolean => {
  const { children } = node
  return Array.isArray(children) ? searchItems(children, matches, sharedByName, visiting) : false
}

/**
 * Resolve a `$ref` / `component` reference and search the referenced subtree.
 * Returns `false` on cycles or unresolvable references (defensive — the
 * predicate is a search, not a validator).
 */
const inspectReferencedComponent = (
  refName: string,
  matches: ComponentMatcher,
  sharedByName: ReadonlyMap<string, unknown>,
  visiting: ReadonlySet<string>
): boolean => {
  if (visiting.has(refName)) return false
  const target = sharedByName.get(refName)
  if (target === null || typeof target !== 'object') return false
  const targetNode = target as Record<string, unknown>
  if (matches(targetNode)) return true
  const nextVisiting = new Set([...visiting, refName])
  return recurseChildren(targetNode, matches, sharedByName, nextVisiting)
}

/**
 * Inspect a single tree item:
 * - Primitive / non-object → no match.
 * - Reference form (`$ref` / `component`) → resolve + search the target subtree.
 * - Direct component → check `type` then recurse into `children`.
 */
const inspectNode = (
  item: unknown,
  matches: ComponentMatcher,
  sharedByName: ReadonlyMap<string, unknown>,
  visiting: ReadonlySet<string>
): boolean => {
  if (item === null || typeof item !== 'object') return false
  const node = item as Record<string, unknown>

  const refName = readRefName(node)
  if (refName !== undefined) {
    return inspectReferencedComponent(refName, matches, sharedByName, visiting)
  }

  if (matches(node)) return true
  return recurseChildren(node, matches, sharedByName, visiting)
}

/**
 * Walks a component tree depth-first looking for a node the predicate accepts.
 *
 * Each item is one of:
 * - A direct component object — inspect its `type` and recurse into `children`.
 * - A `$ref` / `component` reference — resolve via `sharedByName` and recurse
 *   into the referenced component's subtree. `visiting` tracks the resolution
 *   chain to short-circuit cycles.
 * - Anything else (primitives, strings) — ignored.
 */
function searchItems(
  items: readonly unknown[],
  matches: ComponentMatcher,
  sharedByName: ReadonlyMap<string, unknown>,
  visiting: ReadonlySet<string>
): boolean {
  return items.some((item) => inspectNode(item, matches, sharedByName, visiting))
}

/**
 * `componentTreeHasMatch` for the common case: any component of one of `types`.
 *
 * Kept because most callers genuinely are asking about a name, and writing the
 * `typeof node.type === 'string'` guard at each of them is how one of them
 * eventually forgets it and matches a node with no `type` at all.
 *
 * @param app - Validated application schema.
 * @param types - The `type` literals to look for; ANY match answers `true`.
 * @returns `true` when at least one component of one of `types` is reachable.
 */
export const componentTreeHasType = (app: App, types: ReadonlySet<string>): boolean =>
  componentTreeHasMatch(
    app,
    (node) => typeof node['type'] === 'string' && types.has(node['type'] as string)
  )
