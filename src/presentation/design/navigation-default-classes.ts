/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Class computers for two navigation parts with no shadcn/ui counterpart: the
 * `toc` link and the label trigger of a menu. `breadcrumb` and `pagination`
 * moved onto shadcn/ui's anatomy in `breadcrumb-default-classes.ts` and
 * `pagination-default-classes.ts`; the sidebar's half lives in
 * `sidebar-default-classes.ts`.
 *
 * The TOC reads shadcn's role utilities straight off the theme
 * (`text-muted-foreground`, `text-foreground`), so an app's `design.colors`
 * repaints it without a `--sv-*` hook.
 */

import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { MENU_TRIGGER_LAYOUT_CLASSES } from '@/presentation/design/nav-menu-parts'
import { resolveClasses } from '@/presentation/design/resolve-classes'

// ──────────────────────────────────────────────────────────────────────────────
// TOC — the "On this page" column of shadcn/ui's documentation
// ──────────────────────────────────────────────────────────────────────────────

/** The `toc-list`: one link per heading, stacked, at the small size. */
export const computeTocListClasses = (): string => 'm-0 flex list-none flex-col gap-2 p-0 text-sm'

/**
 * A `toc-link`: the muted foreground, lifting to the foreground on hover and
 * when it is marked `data-active="true"`.
 */
export const computeTocLinkClasses = (): string =>
  'text-muted-foreground transition-colors hover:text-foreground data-[active=true]:text-foreground'

const TOC_DEPTH_INDENT: readonly string[] = ['', 'pl-3', 'pl-6', 'pl-9', 'pl-12']

/**
 * The indent of a TOC row by its heading level: an `h1` or `h2` sits flush, and
 * each deeper level moves `pl-3` in under the one above it.
 */
export const computeTocItemIndentClasses = (level: number): string =>
  TOC_DEPTH_INDENT[Math.min(Math.max(level - 2, 0), TOC_DEPTH_INDENT.length - 1)] ?? ''

/**
 * The classes of a LABEL trigger — a `dropdown-menu` whose trigger is its
 * `triggerLabel` plus the chevron, as opposed to one composing its own
 * children — before the author's `className` is merged over them.
 *
 * A label trigger is a button in a row of buttons (a page heading's "More",
 * a card's actions), so it starts from the outline button recipe at the
 * default size and is exactly as tall as the default buttons beside it. It
 * used to start from nothing but `MENU_TRIGGER_LAYOUT_CLASSES`: the
 * placeholder drew a hand-written pill and the mounted trigger drew bare
 * text, and neither matched the button next to it.
 *
 * The author's class is merged, not substituted, by both the placeholder and
 * the island (`resolveClasses` drops the recipe's class on a same-property
 * conflict), so a marker class keeps the button and a styled CTA
 * (`bg-primary rounded-full px-5`) still wins where it speaks. The layout
 * comes LAST so its `gap-2` spaces the label from the chevron.
 */
export function computeMenuLabelTriggerClasses(authored?: string): string {
  return resolveClasses(
    `group ${resolveClasses(computeButtonDefaultClasses({ variant: 'outline' }), MENU_TRIGGER_LAYOUT_CLASSES)}`,
    authored
  )
}

/**
 * A menu trigger's class list. A LABEL trigger — its `triggerLabel` plus the
 * chevron, and nothing composed — is a button in a row of buttons and starts
 * from {@link computeMenuLabelTriggerClasses}; a composed or rich trigger draws
 * what its author composed, over the trigger layout alone.
 */
export function computeMenuTriggerClasses(trigger: {
  readonly triggerLabel: string | undefined
  readonly triggerContent: unknown
  readonly triggerHtml: string | undefined
  readonly triggerChildrenHtml: string | undefined
  readonly authored: string | undefined
}): string {
  const isLabelTrigger =
    trigger.triggerLabel !== undefined &&
    trigger.triggerContent === undefined &&
    trigger.triggerHtml === undefined &&
    trigger.triggerChildrenHtml === undefined
  return isLabelTrigger
    ? computeMenuLabelTriggerClasses(trigger.authored)
    : resolveClasses(`group ${MENU_TRIGGER_LAYOUT_CLASSES}`, trigger.authored)
}

/**
 * The `context-menu-trigger` region: base-nova's `select-none`, so a long press
 * on touch opens the menu rather than starting a text selection, merged under
 * the author's own class. Read by the SSR host and the island alike, so the
 * region does not restyle when it hydrates.
 */
export function computeContextMenuTriggerClasses(authored?: string): string {
  return resolveClasses('select-none', authored)
}
