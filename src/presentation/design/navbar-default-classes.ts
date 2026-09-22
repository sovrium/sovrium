/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared navbar recipe — the ONE source of truth for the badge chip and the
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

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// BADGE (default variants) — tag-shaped label with variant tones
// ──────────────────────────────────────────────────────────────────────────────

/** Schema-aligned vocabulary for `BadgeVariantSchema`. */
export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

/**
 * The leading class sits AFTER the font-size class, and the order is now
 * load-bearing rather than merely intentional.
 *
 * tailwind-merge puts `text-*` and `leading-*` in conflicting groups — correctly,
 * because a Tailwind v4 type rung sets BOTH font-size and line-height — so
 * whichever comes last wins and the other is dropped. With the leading first,
 * routing this recipe through `resolveClasses` silently deleted it and the badge
 * fell back to the inherited line-height.
 *
 * That conflict used to be a FALSE POSITIVE, because the size was spelled
 * `text-[0.6875rem]`, an arbitrary value that sets font-size only. It is real
 * now: `text-xs` is a named rung of the platform ladder and carries
 * `--text-xs--line-height` with it, so `leading-[1.3]` genuinely has to come
 * after to win. The ordering did not change; what it protects did.
 *
 * This is the ONLY recipe in `src/presentation/` that carried a same-property
 * duplicate; every other `compute*` recipe is already merge-stable.
 */
const BADGE_LAYOUT = [
  // The horizontal padding reads `--sv-density-gap`, whose default is the `7px`
  // that used to be typed here — so the shipped badge is unchanged and an
  // authored `design.density` now reaches it. The type step deliberately does
  // NOT move to `--sv-density-text`: that token is the dense SECONDARY text of
  // a data row, and a nav badge is chrome with a step of its own.
  'inline-flex items-center gap-1 px-(--sv-density-gap) py-0.5 font-medium whitespace-nowrap',
  // 11px on a 1.3 leading — the canvas `.badge`. `leading-none` clipped
  // descenders on the one rung small enough for it to show.
  `text-xs leading-[1.3]`,
].join(' ')

/**
 * Chip radius shared by the badge and the status-badge wrapper.
 *
 * A badge is a LABEL, not a control: `radius-sm` (2px) keeps it reading as
 * a tag clipped to the type it carries. The former `sv-radius-full` pill made
 * every status read as a button affordance it does not have.
 */
export const BADGE_RADIUS = `rounded-[${v('radius-sm', T.radiusSm)}]`

/** Per-variant surface tone for the badge chip; also drives the status-badge wrapper. */
export const BADGE_VARIANT_CLASS: Record<BadgeVariant, string> = {
  default: [
    `bg-[${v('sv-primary', T.primary)}]`,
    `text-[${v('sv-primary-fg', T.primaryFg)}]`,
    'border border-transparent',
  ].join(' '),
  secondary: [
    `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
    `text-[${v('sv-fg-muted', T.fgMuted)}]`,
    'border border-transparent',
  ].join(' '),
  // `.b-err` carries a REAL border (`error-border`), not a transparent one. It
  // is the only badge tone whose fill is close enough to the page ground to
  // dissolve into it without one, which is why the canvas draws it and the
  // three neutral tones without.
  destructive: [
    `bg-[${v('sv-error-bg', T.errorBg)}]`,
    `text-[${v('sv-error-fg', T.errorFg)}]`,
    'border',
    `border-[${v('sv-error-border', T.errorBorder)}]`,
  ].join(' '),
  outline: [
    'bg-transparent',
    `text-[${v('sv-fg-muted', T.fgMuted)}]`,
    'border',
    `border-[${v('sv-border-strong', T.borderStrong)}]`,
  ].join(' '),
}

/**
 * Compute the default className for a `<span>`-rendered `badge`. The
 * `variant` axis flips the surface tone:
 *   - `default`   — solid primary tone (filled chip)
 *   - `secondary` — bg-subtle surface on muted-fg, borderless (neutral chip)
 *   - `destructive` — the SOFT error pair: `error-bg` fill under `error-fg`
 *                     text. Deliberately not a solid red — a status label is
 *                     read, not actioned, so it states its tone without
 *                     claiming the emphasis a destructive BUTTON needs.
 *   - `outline`   — transparent fill with strong-border outline (ghost chip)
 * The radius is fixed at `radius-sm` (2px) so all four variants read as the
 * same physical shape regardless of tone — a tag clipped to its text, not a
 * pill, which would read as a control the badge is not.
 */
export const computeBadgeClasses = ({
  variant = 'default',
}: {
  variant?: BadgeVariant
} = {}): string => [BADGE_LAYOUT, BADGE_RADIUS, BADGE_VARIANT_CLASS[variant]].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// NAV-MENU TRIGGER (link-style with hover highlight)
// ──────────────────────────────────────────────────────────────────────────────

const NAV_MENU_RADIUS_MD = `rounded-[${v('radius-md', T.radiusMd)}]`

const NAV_MENU_TRIGGER = [
  'inline-flex items-center gap-1 px-3 py-2 text-md font-medium transition-colors',
  `text-[${v('sv-fg', T.fg)}]`,
  `hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

/**
 * Compute the className for a navigation-menu trigger — used by both
 * `nav-menu-island.tsx` (the hydrated mega-menu trigger AND the simple `<a>`
 * link branch) and the navigation-menu SSR placeholder. Rendering the SSR
 * placeholder trigger with this SAME recipe is what keeps the trigger box a
 * fixed size across hydration — the trigger already carries
 * the `text-md` / `font-medium` / `px-3 py-2` chrome server-side, so the header
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
