/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The vocabulary of a docs-shaped navigation column: the row recipe, its
// current mark, and the root row the Components index draws its own rows with.
//
// The column itself held the UI kit's index until the kit left the console —
// the kit documented the engine's component catalogue, which is shadcn's and
// ships in `sovrium docs`, and it never showed anything specific to the
// operator's app. Only the vocabulary outlived it.
//
// ─── IT SPEAKS THE SIDEBAR'S VOCABULARY, NOT ITS OWN ───────────────────────
//
// The row geometry, tone and current mark are the console sidebar's, because a
// reader crossing from the sidebar into page content is still in one product.
//
// ─── AND WHY IT IS NOT `trackNavigation` ───────────────────────────────────
//
// The console sidebar needs that flag because it lives OUTSIDE
// `#admin-surface-content` and survives the SPA content swap with a stale
// `aria-current`. These rows are page content: the swap re-renders them, so the
// server-resolved mark is the right one.

import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * The entry recipe's geometry and tone, in the semantic spelling.
 *
 * The shipped recipe writes these as arbitrary-variable classes
 * (`text-[var(--foreground,…)]`) that a config file cannot reproduce; the semantic
 * utilities resolve to the same tokens through the compiled theme, which is the
 * spelling every other page in this console already uses.
 */
export const NAV_ROW_CLASS =
  'flex items-center gap-2 rounded-md px-2 py-1.5 text-md transition-colors text-foreground hover:bg-muted'

/** The same row, marked as the page being read. */
export const NAV_ROW_CURRENT_CLASS = `${NAV_ROW_CLASS} bg-muted font-medium`

/**
 * A row's test hook, read off its translation key's last segment when the
 * label is a `$t:` key (`$t:admin.common.overview` → `overview`), so the hook
 * never carries a key and never moves with the language.
 */
const navRowSlug = (label: string): string =>
  label.startsWith('$t:') ? label.slice(label.lastIndexOf('.') + 1) : label.toLowerCase()

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
  /** Hide the row below `lg`, where the column has folded into a drawer. */
  readonly desktopOnly?: boolean
}): PageComponent =>
  ({
    type: 'link',
    props: {
      href: input.href,
      className: `${input.current ? NAV_ROW_CURRENT_CLASS : NAV_ROW_CLASS}${
        input.desktopOnly === true ? ' max-lg:hidden' : ''
      }`,
      'data-testid': `design-system-nav-column-${navRowSlug(input.label)}`,
      ...(input.current ? { 'aria-current': 'page' } : {}),
    },
    content: input.label,
  }) as PageComponent
