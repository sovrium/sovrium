/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui navigation-menu (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `navigation-menu` trigger and panel on shadcn/ui's anatomy, read by
 * both the server's placeholder (`render/registry/island-nav-ssr.tsx`) and the
 * hydrated island (`islands/overlays/nav-menu-island.tsx`), so the two emit
 * byte-identical class lists and the header does not reflow on hydration.
 *
 * Its own module so the islands that read the badge recipe in
 * `navbar-default-classes.ts` do not pay for these strings.
 */

// ──────────────────────────────────────────────────────────────────────────────
// NAV-MENU TRIGGER — shadcn/ui's `navigationMenuTriggerStyle`
// ──────────────────────────────────────────────────────────────────────────────

/**
 * base-nova's `navigationMenuTriggerStyle`, with `gap-1` so a badge and the
 * chevron sit beside the label, and without its `disabled:` dimming: the
 * server's placeholder trigger is a disabled button until the island mounts,
 * and it must not flash at half opacity on every page load.
 */
const NAV_MENU_TRIGGER =
  'group/navigation-menu-trigger inline-flex h-9 w-max items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all outline-none hover:bg-muted focus:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 data-popup-open:bg-muted/50 data-popup-open:hover:bg-muted data-open:bg-muted/50 data-open:hover:bg-muted data-open:focus:bg-muted'

/**
 * Compute the className for a navigation-menu trigger — used by both
 * `nav-menu-island.tsx` (the hydrated mega-menu trigger AND the simple `<a>`
 * link branch) and the navigation-menu SSR placeholder. Rendering the SSR
 * placeholder trigger with this SAME recipe is what keeps the trigger box a
 * fixed size across hydration — the trigger already carries its height and
 * padding server-side, so the header row does not reflow when the island
 * mounts.
 *
 * The leading `group` marker is ALWAYS present (independent of any override) so
 * the shared `NavChevronDown`'s `group-data-[popup-open]:rotate-180` flips when
 * Base UI stamps `data-popup-open` on the open trigger.
 *
 * When `override` is supplied (the schema `triggerClassName`), it REPLACES the
 * default chrome recipe — but only the recipe body, not the `group` marker — so
 * an authored trigger styles the SSR placeholder AND the hydrated island with an
 * identical class list and hydration does not reflow the header.
 * Both surfaces MUST call this with the same `override` to stay byte-identical.
 */
export const computeNavMenuTriggerClasses = (override?: string): string =>
  `group ${override ?? NAV_MENU_TRIGGER}`

/**
 * The panel a `navigation-menu` entry opens (`navigation-menu-content`):
 * base-nova's navigation-menu popup — the popover colours under a faint ring
 * and a shadow, scaling in from its trigger. The surface sits on the content
 * itself (base-nova's `viewport=false` drawing), so the panel a reader sees is
 * the element named `navigation-menu-content`; the popup around it only sizes.
 * It holds links, not menu items: no `menu` role (see the type's fragment).
 */
export const computeNavMenuContentClasses = (): string =>
  'z-50 min-w-48 origin-(--transform-origin) rounded-lg bg-popover p-1 text-popover-foreground shadow ring-1 ring-foreground/10 outline-none transition-[opacity,transform,scale] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-starting-style:scale-90 data-starting-style:opacity-0 data-ending-style:scale-90 data-ending-style:opacity-0 data-ending-style:duration-150'

/**
 * The Base UI popup the open content is moved into: it takes the content's
 * measured size (`--popup-width` / `--popup-height`) and paints nothing of its
 * own, so the content's ring and shadow are the panel's only edge.
 */
export const computeNavMenuPopupClasses = (): string =>
  'relative h-(--popup-height) w-(--popup-width) origin-(--transform-origin) outline-none'

/**
 * A row inside an open panel (`navigation-menu-link`): the label over its
 * description, taking the `muted` ground while hovered or focused.
 */
export const computeNavMenuChildLinkClasses = (): string =>
  'hover:bg-muted focus:bg-muted flex flex-col gap-1 rounded-md p-2 text-sm transition-all outline-none'
