/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether a page node NAMES a component template rather than being a component.
 *
 * ─── WHY THE VALUE AND NOT THE KEY ─────────────────────────────────────────
 *
 * Every pass over a page's component list has to skip the two reference forms,
 * `{ component: 'name' }` and `{ $ref: 'name' }`, and each did so by testing
 * `'component' in node`. That was sound while no component type declared a
 * field of that name.
 *
 * `specimen` does: it draws the component held in its `component` field, and
 * that field holds a COMPONENT, not a name. Under the key test every specimen
 * read as a reference to a template called `[object Object]` — it rendered a
 * red "Component not found" box, and it took its `data-testid` from the
 * template-name path rather than from its own `props`, which is how the defect
 * surfaced.
 *
 * The discriminant is therefore the VALUE's type. Both reference schemas type
 * their field as `Schema.String`, so a string means a name and anything else
 * means a component — decidable from the node alone, with no schema lookup.
 *
 * ─── WHERE THIS IS USED, AND WHERE IT IS DELIBERATELY NOT ──────────────────
 *
 * At the four sites where a wrong answer is user-visible: the renderer's own
 * dispatch, the `componentName` / `data-testid` derivation, the visibility
 * filter, and the Open Graph meta extraction.
 *
 * A fifth joined them: the data-source resolver's island-stamping walk. It was
 * left on the key test with the reasoning that a specimen "draws a literal,
 * never a bound record", so skipping it cost nothing. That premise expired the
 * day the catalogue drew a client-fetching `list` specimen — the key test read
 * it as a reference, the walk handed it back untouched, and it rendered a bare
 * empty `<ul>` on the kit page while its six sibling data types fetched
 * normally. An admin design system spec is the coverage the narrowing was waiting
 * for.
 *
 * The remaining `'component' in item` tests — in the TOC, collection and
 * record-binding resolvers — all RETURN THE ITEM UNCHANGED on a match, so a
 * specimen is merely skipped by passes it has no use for. Narrowing them would
 * be correct and is worth doing, but it changes what those passes descend into,
 * which is a behaviour change owed its own coverage rather than a fix owed to
 * this one. The data-source site is the precedent for how: narrow it when a
 * spec needs the descent, not before.
 */

/** The two shapes that name a template. */
interface ReferenceShape {
  readonly component?: unknown
  readonly $ref?: unknown
}

/**
 * Whether this node is a component REFERENCE.
 *
 * @param node - Any page-component-list entry.
 * @returns `true` when it names a template, `false` when it is a component.
 */
export const isComponentReferenceNode = (node: unknown): boolean => {
  if (typeof node !== 'object' || node === null) return false
  const candidate = node as ReferenceShape
  return typeof candidate.component === 'string' || typeof candidate.$ref === 'string'
}

/**
 * The render-time field an EXPANDED reference carries: the template name and
 * the variables it was placed with.
 *
 * `expandPageReferences` inlines every `{ component: name }` / `{ $ref: name }`
 * of a page before the page passes run, so the node the renderer finally draws
 * is no longer a reference — but the template name is still what the rendered
 * element is NAMED by (`data-component`, the `component-<name>` test id, the
 * Open Graph meta a template declares). It travels here, beside `props`, where
 * nothing is spread into the DOM.
 */
export const EXPANDED_REFERENCE_KEY = '_expandedReference'

/** What an expanded reference remembers about the reference it replaced. */
export interface ExpandedReference {
  readonly name: string
  readonly vars: Readonly<Record<string, unknown>> | undefined
}

/**
 * The template an expanded node was placed from, or `undefined` for a node
 * that was written inline.
 */
export const expandedReferenceOf = (node: unknown): ExpandedReference | undefined => {
  if (typeof node !== 'object' || node === null) return undefined
  const marker = (node as Record<string, unknown>)[EXPANDED_REFERENCE_KEY]
  if (typeof marker !== 'object' || marker === null) return undefined
  const { name } = marker as { readonly name?: unknown }
  return typeof name === 'string' ? (marker as ExpandedReference) : undefined
}

/**
 * The template name a node stands for — a reference's own name, or the name
 * an expanded reference remembers. `undefined` for an inline component.
 */
export const referenceNameOf = (node: unknown): string | undefined => {
  if (isComponentReferenceNode(node)) {
    const candidate = node as { readonly component?: unknown; readonly $ref?: unknown }
    return typeof candidate.component === 'string'
      ? candidate.component
      : (candidate.$ref as string)
  }
  return expandedReferenceOf(node)?.name
}
