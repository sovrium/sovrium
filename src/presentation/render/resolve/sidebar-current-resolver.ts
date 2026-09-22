/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  normalizeSidebarPath,
  sidebarEntryMatches,
  sidebarRequestAddress,
} from '@/domain/models/app/pages/sidebar-active-match'
import type { Page } from '@/domain/models/app/pages'

/**
 * The render-time-only marker a matched sidebar entry carries out of this pass.
 *
 * Private to the renderer, exactly like `_openDrawerDispatchedById`: it is not a
 * schema key, nothing may author it, and the only reader is
 * `renderSidebarGroups`, which turns it into `aria-current="page"`.
 */
export const CURRENT_ENTRY_KEY = '_isCurrentEntry'

/**
 * The render-time-only marker saying the reader is somewhere INSIDE this
 * entry's section — on the entry itself, or on one of its authored children.
 *
 * Private to the renderer exactly like {@link CURRENT_ENTRY_KEY}. Its one
 * reader turns it into a disclosure that is already open on arrival.
 */
export const CURRENT_SECTION_KEY = '_isCurrentSection'

/**
 * Mark the sidebar entry that matches the REQUEST path.
 *
 * Resolved here rather than in the renderer for the same reason a derived
 * breadcrumb is: the request path is in hand in `renderPageByPath`, and
 * threading it down the `render-page → DynamicPage → PageMain → SectionRenderer
 * → ComponentRenderer` chain would add a prop to six files, inert for every
 * component but this one.
 *
 * Server-side and not client-side, because "where am I" must be answerable
 * before — and without — JavaScript, and because the mark is `aria-current`
 * rather than a colour: a nav that only highlights after hydration has told a
 * screen-reader user nothing.
 *
 * Pure, and a page with no marked entry is returned by reference.
 */
export function resolveSidebarCurrentEntries(
  page: Page,
  requestPath: string,
  basePath?: string,
  requestQuery?: Readonly<Record<string, string>>
): Page {
  if (!hasSidebarGroups(page.components) && !hasSidebarGroups(page.layout)) return page
  // Item hrefs were rewritten onto the mount at boot, while the path this
  // function receives has had that base stripped — so the two are compared in
  // the mount's own space.
  //
  // The QUERY travels beside the path for the same reason the path itself does:
  // an entry whose href declares one is current only when the request carries
  // it, and `renderPageByPath` is the last place holding the raw request query
  // before the component dispatcher — which never sees either.
  const fullPath = sidebarRequestAddress(
    normalizeSidebarPath(`${basePath ?? ''}${requestPath}`),
    requestQuery
  )
  return {
    ...page,
    ...(page.components !== undefined
      ? { components: transform(page.components, fullPath) as Page['components'] }
      : {}),
    ...(page.layout !== undefined
      ? { layout: transform(page.layout, fullPath) as Page['layout'] }
      : {}),
  }
}

/** Cheap pre-check so a page with no grouped sidebar is never deep-copied. */
function hasSidebarGroups(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasSidebarGroups)
  if (!isRecord(value)) return false
  if (value['type'] === 'sidebar' && Array.isArray(value['groups'])) return true
  return Object.values(value).some(hasSidebarGroups)
}

function transform(value: unknown, fullPath: string): unknown {
  if (Array.isArray(value)) return value.map((entry) => transform(entry, fullPath))
  if (!isRecord(value)) return value

  const mapped = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, transform(child, fullPath)])
  )
  if (value['type'] !== 'sidebar' || !Array.isArray(value['groups'])) return mapped

  return { ...mapped, groups: markGroups(value['groups'], fullPath) }
}

function markGroups(groups: readonly unknown[], fullPath: string): readonly unknown[] {
  return groups.map((group) => {
    if (!isRecord(group) || !Array.isArray(group['items'])) return group
    return { ...group, items: markItems(group['items'], fullPath) }
  })
}

/**
 * Mark the entry, its authored sub-entries, and whether its SECTION is current.
 *
 * "Section is current" is a separate question from "this entry is current", and
 * it is the one a disclosure asks: a reader sitting on `/tables/clients` is
 * inside the Records section whether the mark landed on Records itself (via
 * `prefix`) or on the Clients child. The disclosure opens on either, which is
 * what lets an operator deep-link into an object and see its siblings without a
 * second click — resolved HERE so it holds before, and without, JavaScript.
 *
 * A FETCHED disclosure has no children to test at render time, so its section
 * is current only when the entry's own `activeMatch` says so.
 *
 * ─── WHY THE HREF GUARD SITS ON THE MATCH AND NOT ON THE WALK ──────────────
 *
 * A top-level entry may omit `href`, which is what makes the whole row a TOGGLE
 * rather than a link. Such a row can never be the page being viewed, so it never
 * takes {@link CURRENT_ENTRY_KEY} — and that omission is the whole invariant,
 * not an oversight to be patched later.
 *
 * Its CHILDREN are pages, though. Returning the entry untouched — which this did
 * for as long as `href` was required at every level — left the child the reader
 * is actually on with no `aria-current` anywhere in the navigation, and left
 * {@link CURRENT_SECTION_KEY} unset, so the list they arrived through was shut
 * on arrival. The walk therefore runs for every entry and only the entry's OWN
 * match is gated.
 */
function markItems(items: readonly unknown[], fullPath: string): readonly unknown[] {
  return items.map((item) => {
    if (!isRecord(item)) return item
    const isCurrent =
      typeof item['href'] === 'string' &&
      sidebarEntryMatches(item['href'], item['activeMatch'], fullPath)
    const children = Array.isArray(item['children'])
      ? markChildren(item['children'], fullPath)
      : undefined
    const childCurrent = children?.some(marksCurrent) ?? false
    return {
      ...item,
      ...(children === undefined ? {} : { children }),
      ...(isCurrent ? { [CURRENT_ENTRY_KEY]: true } : {}),
      ...(isCurrent || childCurrent ? { [CURRENT_SECTION_KEY]: true } : {}),
    }
  })
}

/**
 * Mark the sub-entries, and the LEAVES beneath any of them.
 *
 * Recursive rather than one level deep, because the third level is where the
 * reader most often is: a kit category is a filter of one page, so an operator
 * arriving on `/design-system/ui-kit?category=interactive` is sitting on a leaf
 * and nothing above it matches exactly. Marking only sub-entries would leave
 * that page with no `aria-current` anywhere in its navigation.
 *
 * The recursion terminates on the schema rather than on a depth counter: a leaf
 * is `SidebarLeafItemSchema`, which declares no `children`, so a third call is
 * unreachable for a decoded config. Written generally anyway, since this walks
 * `unknown` and a guard that depends on a shape it does not check is a guard
 * waiting to be wrong.
 */
function markChildren(children: readonly unknown[], fullPath: string): readonly unknown[] {
  return children.map((child) => {
    if (!isRecord(child) || typeof child['href'] !== 'string') return child
    const nested = Array.isArray(child['children'])
      ? markChildren(child['children'], fullPath)
      : undefined
    return {
      ...child,
      ...(nested === undefined ? {} : { children: nested }),
      ...(sidebarEntryMatches(child['href'], child['activeMatch'], fullPath)
        ? { [CURRENT_ENTRY_KEY]: true }
        : {}),
    }
  })
}

/**
 * Whether this node, or anything under it, came out of the walk marked.
 *
 * What a DISCLOSURE asks, and it has to see all the way down: a reader on a
 * third-level leaf is inside the section its grandparent opens, so a check that
 * stopped at the sub-entries would leave the list shut on exactly the page the
 * reader arrived at through it.
 */
function marksCurrent(node: unknown): boolean {
  if (!isRecord(node)) return false
  if (node[CURRENT_ENTRY_KEY] === true) return true
  return Array.isArray(node['children']) && node['children'].some(marksCurrent)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
