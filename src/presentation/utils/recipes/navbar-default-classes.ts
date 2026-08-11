/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared navbar recipe — the ONE source of truth for the badge-pill and the
 * navigation-menu trigger class strings, reachable by BOTH the client-hydrated
 * islands (`src/presentation/islands/`) AND the SSR hosts
 * (`src/presentation/ui/sections/`).
 *
 * ## Why it lives in `presentation/utils`
 * The navbar dropdown surfaces render TWICE: once as an SSR placeholder (in
 * `ui/sections/…` — a `presentation-component`) and once as the hydrated island
 * (in `islands/…` — a `presentation-island`). `eslint-plugin-boundaries` forbids
 * BOTH directions across that seam — an island can't import from `ui/sections`
 * AND a `ui/sections` component can't import from `islands`. The only layer both
 * are allowed to import is `presentation-util` (`src/presentation/utils/**`),
 * where `css-var.ts` already lives. Keeping the recipe here (instead of forking
 * a copy into each side) guarantees the SSR placeholder and the hydrated island
 * emit byte-identical class strings, which is exactly what stops the trigger box
 * from reflowing on hydration.
 *
 * ## Safelist
 * This file ends in `-default-classes.ts` and its directory
 * (`src/presentation/utils/recipes`) is registered in
 * `src/infrastructure/css/arbitrary-var-safelist.ts` (`RECIPE_DIRS`), so the
 * runtime `v('sv-X', T.Y)` template literals below are resolved and emitted to
 * the compiler's `@source inline(...)` safelist — same treatment as the island
 * and element-renderer recipes.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// BADGE (default variants) — pill-rounded label with variant tones
// ──────────────────────────────────────────────────────────────────────────────

/** Schema-aligned vocabulary for `BadgeVariantSchema`. */
export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const BADGE_LAYOUT =
  'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium leading-none whitespace-nowrap'

/** Pill radius shared by the badge chip and the status-badge wrapper. */
export const BADGE_RADIUS = `rounded-[${v('sv-radius-full', T.radiusFull)}]`

/** Per-variant surface tone for the badge chip; also drives the status-badge wrapper. */
export const BADGE_VARIANT_CLASS: Record<BadgeVariant, string> = {
  default: [
    `bg-[${v('sv-primary', T.primary)}]`,
    `text-[${v('sv-primary-fg', T.primaryFg)}]`,
    'border border-transparent',
  ].join(' '),
  secondary: [
    `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    `text-[${v('sv-fg', T.fg)}]`,
    'border',
    `border-[${v('sv-border', T.border)}]`,
  ].join(' '),
  destructive: [
    `bg-[${v('sv-error-solid', T.errorSolid)}]`,
    `text-[${v('sv-error-solid-fg', T.errorSolidFg)}]`,
    'border border-transparent',
  ].join(' '),
  outline: [
    'bg-transparent',
    `text-[${v('sv-fg', T.fg)}]`,
    'border',
    `border-[${v('sv-border-strong', T.borderStrong)}]`,
  ].join(' '),
}

/**
 * Compute the default className for a `<span>`-rendered `badge`. The
 * `variant` axis flips the surface tone:
 *   - `default`   — solid primary tone (filled chip)
 *   - `secondary` — bg-subtle surface + bordered chrome (neutral chip)
 *   - `destructive` — solid error tone (filled red chip, mirrors `default`)
 *   - `outline`   — transparent fill with strong-border outline (ghost chip)
 * The pill radius is fixed at `radius-full` so all four variants read as the
 * same physical shape regardless of tone.
 */
export const computeBadgeClasses = ({
  variant = 'default',
}: {
  variant?: BadgeVariant
} = {}): string => [BADGE_LAYOUT, BADGE_RADIUS, BADGE_VARIANT_CLASS[variant]].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// NAV-MENU TRIGGER (link-style with hover highlight)
// ──────────────────────────────────────────────────────────────────────────────

const NAV_MENU_RADIUS_MD = `rounded-[${v('sv-radius-md', T.radiusMd)}]`

const NAV_MENU_TRIGGER = [
  'inline-flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors',
  `text-[${v('sv-fg', T.fg)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

/**
 * Compute the className for a navigation-menu trigger — used by both
 * `nav-menu-island.tsx` (the hydrated mega-menu trigger AND the simple `<a>`
 * link branch) and the navigation-menu SSR placeholder. Rendering the SSR
 * placeholder trigger with this SAME recipe is what keeps the trigger box a
 * fixed size across hydration — the trigger already carries
 * the `text-sm` / `font-medium` / `px-3 py-2` chrome server-side, so the header
 * row does not reflow when the island mounts.
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
  `group ${override ?? [NAV_MENU_TRIGGER, NAV_MENU_RADIUS_MD].join(' ')}`
