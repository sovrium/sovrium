/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The second navigation column: the kit's own contents, beside its content.
//
// ─── WHY THE KIT GETS A COLUMN AND NO OTHER CONSOLE PAGE DOES ──────────────
//
// The UI kit is a docs-shaped surface — one index over ninety-odd pages — and a
// navigation that size belongs beside the content it indexes rather than inside
// the console sidebar, where it would be part of the chrome of every unrelated
// page. Putting it in the sidebar was the previous answer (a third level under
// `UI kit`, scoped by `showWhen`), and it split one navigation in two: the
// categories in the chrome, the types on the page.
//
// One column, one navigation. The console sidebar keeps the six console pages;
// this column keeps the kit.
//
// ─── IT SPEAKS THE SIDEBAR'S VOCABULARY, NOT ITS OWN ───────────────────────
//
// The rows, the group labels and the spacing are the console sidebar's, because
// a reader crossing from one column to the next is still in one product. That is
// why the column is a real `sidebar` component rather than a hand-built list:
// the group label, the row geometry, the current mark and the `aria-current` all
// come from the same recipe the chrome uses, and they cannot drift from it.
//
// The ONE row this file draws by hand is `Overview`, and only because the
// component renders its `groups` before its authored `children` and a group must
// carry a label — so a labelled group is the only way a `sidebar` can put a row
// ABOVE the first heading, and this row has no heading over it. Its classes are
// the entry recipe's geometry and tone in the semantic spelling the rest of this
// console's config uses.
//
// ─── THE CURRENT MARK IS TWO MECHANISMS, DELIBERATELY ──────────────────────
//
// A TYPE row is marked by the component, server-side, from the request path —
// nothing here says which one. `Overview` is marked from a build-time flag
// instead, because it is authored rather than fetched and there is no request
// state a config page could read to decide it. Each page knows at authoring time
// whether it IS the index, so it says so.
//
// ─── AND WHY IT IS NOT `trackNavigation` ───────────────────────────────────
//
// The console sidebar needs that flag because it lives OUTSIDE
// `#admin-surface-content` and survives the SPA content swap with a stale
// `aria-current`. This column is page content: the swap re-renders it, so the
// server-resolved mark is the right one.

import { COMPONENT_TYPES_ENDPOINT } from '../../system-sources'
import { KIT_CATEGORIES, KIT_TYPES } from './types/catalogue'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * One group of the column: a heading over its entries.
 *
 * AUTHORED, and for now only authored.
 *
 * ─── WHY NOT FETCHED, WHICH IS WHAT THE SHAPE INVITES ─────────────────────
 *
 * A `sidebar` group can read its entries from an endpoint, and two of the three
 * columns this file will eventually build want exactly that. Neither can have
 * it yet, for two separate reasons measured on 2026-09-11:
 *
 *   - the kit's twelve groups would each need `?category=`, and
 *     `GET /api/admin/schema/component-types` declares no query validator, so
 *     every group would list the whole catalogue;
 *   - the Components column's one group would need `?subject=component`, and
 *     `SidebarGroupSource` ACCEPTS a `query` (it spreads the system-source
 *     fields) and does not forward it — the fetch goes out bare, and the usage
 *     endpoint's default subject is the component-type catalogue. Built that
 *     way the column listed 87 component types under a heading reading
 *     `Templates`, each linking to a `/design-system/components/<type>` route
 *     that 404s. Schema-clean, decode-clean, and completely wrong.
 *
 * So the entries are authored and the drift is asserted, which is the same
 * bargain `sidebar.ts` and `ui-kit.ts` already strike for the category list.
 */
export interface DocsNavGroup {
  readonly label: string
  /** The group's own address, where it has one — a disclosure row links to it. */
  readonly href?: string
  /** Dotted path to this group's live count, where the endpoint publishes one. */
  readonly countPath?: string
  readonly items: readonly (readonly [label: string, href: string])[]
}

/**
 * The entry recipe's geometry and tone, in the semantic spelling.
 *
 * The shipped recipe writes these as arbitrary-variable classes
 * (`text-[var(--sv-fg,…)]`) that a config file cannot reproduce; the semantic
 * utilities resolve to the same tokens through the compiled theme, which is the
 * spelling every other page in this console already uses.
 */
export const NAV_ROW_CLASS =
  'flex items-center gap-2 rounded-md px-2 py-1.5 text-md transition-colors text-foreground hover:bg-background-subtle'

/** The same row, marked as the page being read. */
export const NAV_ROW_CURRENT_CLASS = `${NAV_ROW_CLASS} bg-background-subtle font-medium`

/**
 * The column's own root entry, linking back to the index it sits beside.
 *
 * A full navigation contains its own root: a reader deep in one type has no
 * other way back to the index but the breadcrumb, which names the section rather
 * than this column's top.
 */
export const docsNavOverviewRow = (input: {
  readonly label: string
  readonly href: string
  readonly current: boolean
}): PageComponent =>
  ({
    type: 'link',
    props: {
      href: input.href,
      className: input.current ? NAV_ROW_CURRENT_CLASS : NAV_ROW_CLASS,
      'data-testid': `design-system-nav-column-${input.label.toLowerCase()}`,
      ...(input.current ? { 'aria-current': 'page' } : {}),
    },
    content: input.label,
  }) as PageComponent

/**
 * The column, as the shell's `navColumn` slot takes it.
 *
 * ─── TWO MODES, AND THEY ARE THE SAME CONTENT ─────────────────────────────
 *
 * `open` is what an index wants: every group a heading over its flat list, the
 * whole population scannable, nothing to click before you can read it.
 *
 * `collapsed` is what a page you arrived at from ONE group wants: twelve
 * disclosure rows, and only the one you are inside opens. The other eleven are
 * real controls rather than markers, so a reader can cross to another category
 * without going back to the index first.
 *
 * The auto-expand costs nothing to declare: `SidebarNavItemSchema` documents
 * that expanding the entry containing the current page "is not a default but the
 * navigation answering 'where am I', and it happens whatever this says". So the
 * twelve rows are identical and the component opens the right one.
 *
 * ─── THE COLLAPSED GROUP CARRIES A LABEL, AND THE REFERENCE DRAWS NONE ────
 *
 * `SidebarGroupSchema` has `label`, `landmark`, `headingLevel`, `items` and
 * `source` — no `props`, no class seam, and `label` is required. So a group
 * always draws one, and twelve disclosures under nothing at all is not a shape
 * this primitive can make. Using the primitive is the point (one navigation
 * language across the console), so the label stays and says `Categories`, which
 * is what the twelve are and the word this console's own kit rail already used
 * for them.
 */
export const docsNavColumn = (input: {
  readonly ariaLabel: string
  /**
   * The rows ABOVE the first group heading.
   *
   * More than one, because the kit indexes two catalogues rather than one: the
   * component types the groups below list, and the field types, which answer a
   * different question and live on a page of their own. A reader who has to
   * find the second through the first has been told it is a subsection of it.
   */
  readonly overview: readonly {
    readonly label: string
    readonly href: string
    readonly current: boolean
  }[]
  readonly groups: readonly DocsNavGroup[]
  readonly mode?: 'open' | 'collapsed'
}): readonly PageComponent[] => [
  ...input.overview.map((row) => docsNavOverviewRow(row)),
  ...(input.mode === 'collapsed'
    ? [
        {
          type: 'sidebar',
          props: { className: 'flex flex-col gap-4' },
          groups: [
            {
              label: 'Categories',
              landmark: input.ariaLabel,
              items: input.groups.map((group) => ({
                label: group.label,
                // The group's own filtered view of the index. The SLUG, never
                // the title: the index clamps `?category=` to a declared enum of
                // slugs and resolves anything else to `unknown`, which draws no
                // grid and says so — so a title here would send every one of
                // these twelve rows to a page reporting no such category.
                ...(group.href === undefined ? {} : { href: group.href }),
                // ─── THE COUNT IS READ, AND IT ONLY READS ON THIS ROW ───────
                //
                // `categoryCounts` is keyed BY SLUG precisely so a badge can
                // reach one figure: `valuePath` walks a dotted path, and a
                // dotted path cannot pick a list entry out by one of its fields.
                // The sibling list `categories[]` carries the same numbers and
                // none of them is addressable.
                //
                // It works HERE and not one level down. A disclosure's children
                // are projected for the island by `toIslandChild`
                // (`sidebar-entry.tsx`), which does not carry `badge` through —
                // so a badge on a child is accepted, stored and silently inert.
                // These twelve are disclosure ROWS, rendered by `renderEntry`,
                // which does.
                ...(group.countPath === undefined
                  ? {}
                  : {
                      badge: {
                        endpoint: COMPONENT_TYPES_ENDPOINT,
                        valuePath: group.countPath,
                      },
                    }),
                childrenProps: { 'data-testid': `design-system-nav-group-${group.label}` },
                children: group.items.map(([label, href]) => ({
                  label,
                  href,
                  props: { 'data-testid': `design-system-nav-type-${label}` },
                })),
              })),
            },
          ],
        } as PageComponent,
      ]
    : [openGroups(input)]),
]

/** Every group as a heading over its list — the index's own reading. */
const openGroups = (input: {
  readonly ariaLabel: string
  readonly groups: readonly DocsNavGroup[]
}): PageComponent =>
  ({
    type: 'sidebar',
    props: { className: 'flex flex-col gap-4' },
    // ─── ONE LANDMARK, TWELVE HEADINGS ────────────────────────────────────
    //
    // A `sidebar` group is a navigation LANDMARK named by its own label unless
    // it says otherwise, and the console sidebar next door already publishes a
    // landmark called `Data`. Twelve unqualified groups here therefore minted a
    // thirteenth navigation — one of them named `Data` too — and the schema
    // refused the config outright rather than shipping two landmarks a screen
    // reader cannot tell apart. It was right to: these twelve are subdivisions
    // of ONE navigation, not twelve navigations. `landmark` says which one they
    // belong to and `headingLevel` turns each label into a real heading inside
    // it.
    groups: input.groups.map((group) => ({
      label: group.label,
      landmark: input.ariaLabel,
      headingLevel: 2 as const,
      items: group.items.map(([label, href]) => ({
        label,
        href,
        props: { 'data-testid': `design-system-nav-type-${label}` },
      })),
    })),
  }) as PageComponent

/** Every catalogued type, grouped the way the registry groups them. */
export const kitNavGroups = (): readonly DocsNavGroup[] =>
  KIT_CATEGORIES.map(([slug, title]) => ({
    label: title,
    href: `/design-system/ui-kit?category=${slug}`,
    countPath: `categoryCounts.${slug}`,
    items: (KIT_TYPES[slug] ?? []).map((type) => [type, `/design-system/ui-kit/${type}`] as const),
  }))

/** The kit's column: its root, then its twelve categories. */
export const kitNavColumn = (input: { readonly onIndex: boolean }): readonly PageComponent[] =>
  docsNavColumn({
    ariaLabel: 'UI kit',
    overview: [{ label: 'Overview', href: '/design-system/ui-kit', current: input.onIndex }],
    groups: kitNavGroups(),
    // ─── ONE RENDERING, INDEX INCLUDED ──────────────────────────────────
    //
    // The index used to take open mode and its 88 children collapsed, which
    // made one surface two navigations: a reader who opened a type from the
    // flat list met a different column on arrival. Collapsed everywhere.
    //
    // No special case was needed for the index. A group opens because it
    // contains the current page, and the index is in no group — so all twelve
    // start closed there and exactly one opens on every type page.
    mode: 'collapsed',
  })
