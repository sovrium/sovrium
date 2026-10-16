/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui breadcrumb (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `breadcrumb` on shadcn/ui's anatomy: base-nova's `ui/breadcrumb.tsx`
 * class strings, server-rendered, one `data-slot` per part.
 *
 *   nav[data-slot=breadcrumb]
 *     ol[data-slot=breadcrumb-list]
 *       li[data-slot=breadcrumb-item] > a[data-slot=breadcrumb-link]
 *       li[data-slot=breadcrumb-separator]
 *       li[data-slot=breadcrumb-item] > span[data-slot=breadcrumb-page]
 *
 * The list carries the muted ink and every crumb inherits it; a link lifts to
 * the foreground on hover and the current page IS the foreground. Two
 * departures, both written down in the type's fragment: the separator is the
 * schema's `separator` string (default `/`) rather than base-nova's chevron,
 * and the current crumb carries `aria-current="page"` without base-nova's
 * `role="link" aria-disabled="true"`, so it is not counted among the links.
 */

/** The `<ol>`: a wrapping row in the muted ink. */
export const BREADCRUMB_LIST_CLASSES =
  'flex flex-wrap items-center gap-1.5 text-sm wrap-break-word text-muted-foreground'

/** One crumb's `<li>`. */
export const BREADCRUMB_ITEM_CLASSES = 'inline-flex items-center gap-1'

/**
 * A prior crumb's `<a>`. Its muted ink is spelled out where base-nova lets it
 * inherit from the list: the base layer paints a bare link in the app's primary
 * colour, which an inherited ink loses to.
 */
export const BREADCRUMB_LINK_CLASSES =
  'text-muted-foreground transition-colors hover:text-foreground'

/** The current crumb's `<span aria-current="page">`. */
export const BREADCRUMB_PAGE_CLASSES = 'font-normal text-foreground'

/** The separator's `<li role="presentation">`. */
export const BREADCRUMB_SEPARATOR_CLASSES = '[&>svg]:size-3.5'

/** shadcn/ui `BreadcrumbEllipsis`: the mark standing for the collapsed crumbs. */
export const BREADCRUMB_ELLIPSIS_CLASSES = 'flex size-5 items-center justify-center [&>svg]:size-4'

/** The ellipsis as a menu trigger: shadcn's dropdown crumb, a quiet square control. */
export const BREADCRUMB_ELLIPSIS_TRIGGER_CLASSES =
  'flex size-5 items-center justify-center rounded-sm hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none [&_svg]:size-4'
