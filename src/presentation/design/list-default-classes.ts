/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui item, separator and empty (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `list` on shadcn/ui's anatomy: an `ItemGroup` in one outlined shell,
 * each row an `Item` at its small size with `ItemMedia`, `ItemContent`
 * (`ItemTitle` over `ItemDescription`) and `ItemActions`, and an
 * `ItemSeparator` between two rows.
 *
 * Drawn by the list island and, for its loading frame, by the SSR host
 * (`render/registry/list-island-host.tsx`), so both read this module. Every
 * colour is a role utility (`border-border`, `bg-muted`,
 * `text-muted-foreground`), which an app's `design` repaints.
 *
 * Two departures from base-nova, both for a list of records in one shell:
 *
 * - **The group has no gap and its rows no radius.** base-nova spaces free
 *   items apart; here the rows touch inside one outline and the separator is
 *   the rule between them.
 * - **The separator sits at the foot of the row above it**, absolutely
 *   positioned, rather than between two rows: the shell is a real `<ul>`,
 *   whose only children may be its items.
 */

import { computeBadgeClasses } from '@/presentation/design/badge-default-classes'

/**
 * Compute the className for the list shell — the `<ul>` that is the item
 * group (`data-slot="item-group"`): one outline in the border colour, clipped
 * to its radius, with the browser's list affordances reset.
 */
export const computeListShellClasses = (): string =>
  'group/item-group m-0 flex w-full list-none flex-col overflow-hidden rounded-lg border border-border p-0'

/**
 * Compute the className for one row — base-nova's `Item` at its small size
 * (`data-slot="item"`, `data-size="sm"`), painted the muted surface under the
 * pointer. `relative` anchors the separator drawn at its foot.
 */
export const computeListItemClasses = (): string =>
  'group/item relative flex min-w-0 flex-wrap items-center gap-2.5 px-3 py-2.5 text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset'

/**
 * Compute the className for the item separator at the foot of a row
 * (`data-slot="item-separator"`): base-nova's horizontal `Separator`, laid
 * across the row's bottom edge.
 */
export const computeListSeparatorClasses = (): string =>
  'absolute inset-x-0 bottom-0 h-px bg-border'

/**
 * Compute the className for a rule under a row drawn without the item
 * anatomy (the search list's free-form rows), dropped on the last one.
 */
export const computeListDividerClasses = (): string => 'border-b border-border last:border-b-0'

/**
 * Compute the className for the row's media (`data-slot="item-media"`,
 * `data-variant="image"`): base-nova's image media at the small item's
 * 32px, on the muted surface while the image loads or if it fails.
 */
export const computeListThumbClasses = (): string =>
  'flex size-8 shrink-0 overflow-hidden rounded-sm bg-muted group-has-data-[slot=item-description]/item:self-start [&_img]:size-full [&_img]:object-cover'

/**
 * The row's content (`data-slot="item-content"`): base-nova's `ItemContent`,
 * which takes the row's free width; `min-w-0` lets the title truncate.
 */
export const LIST_TEXT_COLUMN_CLASSES = 'flex min-w-0 flex-1 flex-col gap-1'

/**
 * Compute the className for the title (`data-slot="item-title"`): base-nova's
 * `ItemTitle` type, truncated to one line — its length is the record's.
 */
export const computeListTitleClasses = (): string => 'truncate text-sm leading-snug font-medium'

/**
 * Compute the className for the description (`data-slot="item-description"`):
 * base-nova's `ItemDescription` type in the muted foreground, one line.
 */
export const computeListSubtitleClasses = (): string => 'truncate text-sm text-muted-foreground'

/** The row's actions (`data-slot="item-actions"`): the badge and the metadata. */
export const LIST_ACTIONS_CLASSES = 'flex shrink-0 items-center gap-2'

/**
 * Compute the className for the row's badge: the shared badge recipe at its
 * `secondary` tone — a row badge is read, never actioned.
 */
export const computeListBadgeClasses = (): string =>
  `${computeBadgeClasses({ variant: 'secondary' })} shrink-0`

/** Compute the className for the metadata group inside the actions, in the muted foreground. */
export const computeListMetaClasses = (): string =>
  'flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground'

/**
 * Compute the className for the `<mark>` around a matched search term: the
 * muted surface under the foreground, displacing both browser defaults.
 */
export const computeListHighlightClasses = (): string =>
  'rounded-sm bg-muted px-0.5 text-foreground'

/**
 * Compute the className for an empty list's message: base-nova's `Empty`
 * root, its message the empty title.
 *
 * The three empty strings repeat `display-default-classes.ts`'s, which the
 * unit test holds equal: importing that module costs the list island a
 * shared chunk of server-side display recipes it never draws.
 */
export const computeListEmptyClasses = (): string =>
  'flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border-dashed p-6 text-center text-balance'

/** The empty's header and title, base-nova's `EmptyHeader` and `EmptyTitle`. */
export const LIST_EMPTY_PART_CLASSES = {
  header: 'flex max-w-sm flex-col items-center gap-2',
  title: 'text-sm font-medium tracking-tight',
} as const

/**
 * Compute the className for the footer holding the "Load more" control:
 * centred, attached to the list above by a rule in the border colour.
 */
export const computeListLoadMoreClasses = (): string =>
  'flex items-center justify-center border-t border-border p-2'

/** A loading row — base-nova's `Skeleton`. */
export const LIST_SKELETON_CLASSES = 'h-6 w-full animate-pulse rounded-md bg-muted'
