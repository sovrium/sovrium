/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { slugifyTitle } from '@/domain/kernel/identity/slug'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * A single heading collected from a page's component tree, used to populate
 * any `{ type: 'toc' }` components on that page.
 */
export interface TocHeading {
  /** HTML heading level (1..6). */
  readonly level: 1 | 2 | 3 | 4 | 5 | 6
  /** Heading text content. */
  readonly text: string
  /** URL fragment id (slug) for `<a href="#id">` and `<h_ id="...">`. */
  readonly id: string
}

const HEADING_LEVEL_MAP: Record<string, 1 | 2 | 3 | 4 | 5 | 6> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
}

/**
 * Read the `element` field off a component without locking ourselves into a
 * particular discriminated-union shape — many text-like components carry
 * `element` as a top-level string sibling of `props`.
 */
function getElement(component: Component): string | undefined {
  const { element } = component as { readonly element?: unknown }
  return typeof element === 'string' ? element : undefined
}

/**
 * Read existing `props.id` off a component (so we don't overwrite an
 * author-supplied anchor id).
 */
function getPropsId(component: Component): string | undefined {
  const { props } = component as { readonly props?: Record<string, unknown> }
  const id = props?.['id']
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

/**
 * Read string `content` off a component (heading text source).
 */
function getContent(component: Component): string | undefined {
  const { content } = component as { readonly content?: unknown }
  return typeof content === 'string' ? content : undefined
}

/**
 * Read the `children` array off a component, returning `undefined` if absent
 * or non-array.
 */
function getChildren(
  component: Component
):
  | ReadonlyArray<Component | { readonly $ref: string } | { readonly component: unknown }>
  | undefined {
  const { children } = component as { readonly children?: unknown }
  if (!Array.isArray(children)) return undefined
  return children as ReadonlyArray<
    Component | { readonly $ref: string } | { readonly component: unknown }
  >
}

/**
 * Append `props.id` to a component (immutably).
 */
function withId(component: Component, id: string): Component {
  const props = (component as { readonly props?: Record<string, unknown> }).props ?? {}
  return {
    ...component,
    props: { ...props, id },
  } as Component
}

/**
 * Deduplicate slug ids in document order. When two headings collide on the
 * same slug ("Configuration" / "Configuration"), the second gets `-2`, the
 * third `-3`, etc. — matching what GitHub, MDN, and most documentation tools
 * do. Required so `<a href="#configuration">` and `<a href="#configuration-2">`
 * each scroll to a distinct heading.
 */
function uniqueSlug(base: string, seen: Map<string, number>): string {
  const count = seen.get(base) ?? 0
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- local mutation of a private accumulator scoped to walkAndAssignIds; no external escape
  seen.set(base, count + 1)
  return count === 0 ? base : `${base}-${count + 1}`
}

/**
 * Single-pass walker that:
 *  1. Assigns `props.id` to every heading-shaped `text` component that
 *     doesn't already have one (slug from `content`, deduped across the
 *     whole page).
 *  2. Collects an ordered `TocHeading[]` from those headings.
 *
 * Recurses into `children` so headings nested inside containers / flex /
 * sidebar layouts are also indexed. Component references (`{ component: ... }`
 * or `{ $ref: ... }`) are passed through unchanged — the section renderer
 * resolves those later.
 */
function walkAndAssignIds(
  components: Page['components'],
  seen: Map<string, number>,
  collected: TocHeading[]
): Page['components'] {
  if (!components) return components
  // eslint-disable-next-line complexity -- single-pass walker handles 4 branches (placeholder / ref / heading / container-recurse) + empty-text + empty-slug fallbacks; splitting would force multiple tree traversals.
  return components.map((item) => {
    // String children (text content like '$t:token' or plain text) pass
    // through untouched — the `in` operator below would throw on a primitive.
    if (typeof item !== 'object' || item === null) return item
    if ('component' in item || '$ref' in item) return item
    const component = item as Component
    const element = getElement(component)
    const level = element ? HEADING_LEVEL_MAP[element] : undefined

    // Heading branch: assign id (or reuse existing) + record the heading.
    if (component.type === 'text' && level !== undefined) {
      const text = getContent(component) ?? ''
      if (text.length === 0) return component
      const existing = getPropsId(component)
      const base = slugifyTitle(text)
      // Empty-slug fallback: text was nothing but punctuation. Skip the TOC
      // entry rather than emit `<a href="#">`.
      if (!existing && base.length === 0) return component
      const id = existing ?? uniqueSlug(base, seen)
      // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, no-restricted-syntax -- single-pass walker collects in document order; private accumulator never escapes
      collected.push({ level, text, id })
      return existing ? component : withId(component, id)
    }

    // Container branch: recurse into children, splice the result back.
    const children = getChildren(component)
    if (children && children.length > 0) {
      const newChildren = walkAndAssignIds(children as Page['components'], seen, collected)
      return { ...component, children: newChildren } as Component
    }
    return component
  })
}

/**
 * Second pass: attach the collected `headings` array to every
 * `{ type: 'toc' }` component in the tree (including ones nested inside
 * sidebar / flex containers). The `tocHeadings` field is a render-time-only
 * sibling of `props`; the schema author never writes it, the TOC renderer
 * reads it back off `config.component.tocHeadings`.
 */
function walkAndAttachHeadings(
  components: Page['components'],
  headings: readonly TocHeading[]
): Page['components'] {
  if (!components) return components
  return components.map((item) => {
    // String children (text content like '$t:token' or plain text) pass
    // through untouched — the `in` operator below would throw on a primitive.
    if (typeof item !== 'object' || item === null) return item
    if ('component' in item || '$ref' in item) return item
    const component = item as Component
    if (component.type === 'toc') {
      return { ...component, tocHeadings: headings } as Component
    }
    const children = getChildren(component)
    if (children && children.length > 0) {
      const newChildren = walkAndAttachHeadings(children as Page['components'], headings)
      return { ...component, children: newChildren } as Component
    }
    return component
  })
}

/**
 * Page-level TOC pass — for any page that contains a `{ type: 'toc' }`
 * component:
 *  - assigns deterministic anchor ids to every heading on the page,
 *  - collects them in document order, and
 *  - plumbs the resulting array onto each TOC component as a render-time
 *    `tocHeadings` field so the TOC renderer can emit `<nav>...</nav>`.
 *
 * The function is a no-op (returns `components` unchanged) when no TOC
 * component is present, so the cost is one extra tree-walk only when the
 * feature is actually used.
 *
 * Intentionally placed AFTER `expandFormRefs` in the filter pipeline so that
 * collection-page expansion + formRef expansion are visible. Placed BEFORE
 * `resolvePageDataSources` so heading ids stay deterministic regardless of
 * data-source resolution timing.
 */
export function resolvePageToc(components: Page['components']): Page['components'] {
  if (!components) return components
  if (!hasToc(components)) return components
  const seen = new Map<string, number>()
  const collected: TocHeading[] = []
  const withIds = walkAndAssignIds(components, seen, collected)
  return walkAndAttachHeadings(withIds, collected)
}

/**
 * Cheap precheck: returns true when any component in the tree (including
 * descendants) is a `{ type: 'toc' }` node. Lets us skip the (small) cost of
 * the double-walk when the page doesn't use the feature.
 */
function hasToc(
  components:
    | ReadonlyArray<Component | { readonly $ref: string } | { readonly component: unknown }>
    | undefined
): boolean {
  if (!components) return false
  return components.some((item) => {
    // String children (text content like '$t:token' or plain text) are not
    // components or refs — the `in` operator below would throw on a primitive.
    if (typeof item !== 'object' || item === null) return false
    if ('component' in item || '$ref' in item) return false
    const component = item as Component
    if (component.type === 'toc') return true
    const children = getChildren(component)
    return children ? hasToc(children) : false
  })
}
