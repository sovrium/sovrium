/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computer for the `toggle`, `toggle-group`, and
 * `switch` components.
 *
 * Schema authors who write the bare `{ type: 'toggle' }`, `{ type: 'switch' }`,
 * or `{ type: 'toggle-group', options: [...] }` get a complete, opinionated
 * pressable surface — rounded button, focus ring, primary-subtle pressed state,
 * smooth thumb animation on the switch — with zero theme-layer dependency.
 *
 * The recipe mirrors the buttons + inputs + selects slices (commits 02b2f35f3 +
 * 571ae53ce + 5527660bc): layout / spacing classes stay as raw Tailwind utilities;
 * only color / radius / shadow / motion / focus classes go through
 * {@link withVarFallback} so `app.design.*` overrides still win at the CSS cascade
 * layer (var lookups resolve `--sv-*` first, fall back to the inline OKLCH
 * literal).
 *
 * Base UI exposes interactive state via data attributes (`data-[pressed]`,
 * `data-[disabled]`, `data-[checked]`). Rather than branching on a `state` enum
 * at call time, the recipe bakes the data-attr Tailwind variants directly into
 * the returned class string so a single className covers every interactive state
 * the primitive can enter. The `variant` and `size` axes — schema-level fields
 * authors can set — remain parameters because they pick a different shape, not
 * a different runtime state.
 *
 * Helper file lives in `src/presentation/islands/` (alongside the islands that
 * consume it) because toggle/switch wiring runs inside the client island, not in
 * the server-side dispatcher — the layer-boundaries ESLint rule disallows
 * `ui/sections/` imports from `islands/`. Mirrors the location chosen for
 * `select-default-classes.ts`.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import {
  FOCUS_VISIBLE_RING,
  MOTION_COLORS as MOTION,
  RADIUS_MD,
} from '../../design/shared-tokens-default-classes'

// ──────────────────────────────────────────────────────────────────────────────
// Shared building blocks
// ──────────────────────────────────────────────────────────────────────────────

type ToggleVariant = 'default' | 'outline'
type ComponentSize = 'sm' | 'md' | 'lg'
type SwitchState = 'default' | 'checked' | 'disabled'

const DISABLED = 'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50'

// ──────────────────────────────────────────────────────────────────────────────
// TOGGLE (single pressable button)
// ──────────────────────────────────────────────────────────────────────────────

const TOGGLE_LAYOUT = 'inline-flex items-center justify-center font-medium'

const TOGGLE_SIZE: Record<ComponentSize, string> = {
  sm: 'h-8 px-2 text-sm',
  md: 'h-9 px-3 text-base',
  lg: 'h-10 px-4 text-md',
}

const TOGGLE_VARIANT_DEFAULT = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `data-[pressed]:bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  `data-[pressed]:text-[${v('sv-primary-subtle-fg', T.primarySubtleFg)}]`,
].join(' ')

const TOGGLE_VARIANT_OUTLINE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `data-[pressed]:bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  `data-[pressed]:border-[${v('sv-border-strong', T.borderStrong)}]`,
  `data-[pressed]:text-[${v('sv-primary-subtle-fg', T.primarySubtleFg)}]`,
].join(' ')

/**
 * Compute the default className for a single Base UI Toggle button. Composes
 * layout → radius → size → variant surface → motion → focus → data-state.
 * `variant === 'outline'` switches to a bordered-card recipe; otherwise the
 * default fills with the muted body-subtle surface.
 */
export const computeToggleClasses = ({
  variant = 'default',
  size = 'md',
}: {
  variant?: ToggleVariant
  size?: ComponentSize
} = {}): string =>
  [
    TOGGLE_LAYOUT,
    RADIUS_MD,
    TOGGLE_SIZE[size],
    variant === 'outline' ? TOGGLE_VARIANT_OUTLINE : TOGGLE_VARIANT_DEFAULT,
    MOTION,
    FOCUS_VISIBLE_RING,
    DISABLED,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// TOGGLE-GROUP (wrapper + child items)
// ──────────────────────────────────────────────────────────────────────────────

const TOGGLE_GROUP_LAYOUT = 'inline-flex'

const TOGGLE_GROUP_SURFACE = ['border', `border-[${v('sv-border', T.border)}]`].join(' ')

/**
 * Compute the default className for the Base UI ToggleGroup wrapper — the
 * rounded container that holds child Toggle items. Mirrors the toggle outline
 * variant border so the group reads as a single cohesive surface, with item
 * dividers handled by `computeToggleGroupItemClasses` (border-r per item).
 */
export const computeToggleGroupClasses = (): string =>
  [TOGGLE_GROUP_LAYOUT, RADIUS_MD, TOGGLE_GROUP_SURFACE, 'overflow-hidden'].join(' ')

const TOGGLE_GROUP_ITEM_LAYOUT = 'px-3 py-2 text-sm font-medium'

const TOGGLE_GROUP_ITEM_SURFACE = [
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  `data-[pressed]:bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  `data-[pressed]:text-[${v('sv-fg', T.fg)}]`,
].join(' ')

const TOGGLE_GROUP_ITEM_DIVIDER = [
  'border-r last:border-r-0',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

/**
 * Compute the default className for an individual item inside a ToggleGroup.
 * Items share a horizontal layout with right-border dividers (last item drops
 * its divider); pressed state lights up with the primary-subtle background so
 * selection is unambiguous against the muted default tone.
 */
export const computeToggleGroupItemClasses = (): string =>
  [
    TOGGLE_GROUP_ITEM_LAYOUT,
    TOGGLE_GROUP_ITEM_SURFACE,
    TOGGLE_GROUP_ITEM_DIVIDER,
    MOTION,
    FOCUS_VISIBLE_RING,
    DISABLED,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// SWITCH (track + thumb)
// ──────────────────────────────────────────────────────────────────────────────

const SWITCH_TRACK_LAYOUT = 'relative inline-flex shrink-0 items-center border-2 border-transparent'

const SWITCH_TRACK_SIZE: Record<ComponentSize, string> = {
  sm: 'h-4 w-7',
  md: 'h-5 w-9',
  lg: 'h-6 w-11',
}

const SWITCH_TRACK_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  'data-[checked]:bg-primary',
].join(' ')

/**
 * Compute the default className for the Switch track (the outer rounded pill).
 * Off state uses the muted body-subtle surface; checked state fills with the
 * canonical `bg-primary` role utility (always minted by the default theme layer,
 * resolving `--color-primary` which the author `theme.colors.primary` bridge
 * recolors) so the on/off cue is unmistakable and the checked track is
 * addressable as `.bg-primary`. Size axis matches the toggle's size scale so a
 * `size: 'lg'` switch lines up visually with a `size: 'lg'` toggle in the same
 * form row.
 */
export const computeSwitchTrackClasses = ({
  size = 'md',
}: {
  size?: ComponentSize
  /** Reserved for future use — Base UI handles state via data attributes baked into the returned class string. */
  state?: SwitchState
} = {}): string =>
  [
    SWITCH_TRACK_LAYOUT,
    'rounded-full',
    SWITCH_TRACK_SIZE[size],
    SWITCH_TRACK_SURFACE,
    MOTION,
    FOCUS_VISIBLE_RING,
    DISABLED,
  ].join(' ')

const SWITCH_THUMB_LAYOUT = 'pointer-events-none block'

const SWITCH_THUMB_SIZE: Record<ComponentSize, string> = {
  sm: 'h-3 w-3 data-[checked]:translate-x-3',
  md: 'h-4 w-4 data-[checked]:translate-x-4',
  lg: 'h-5 w-5 data-[checked]:translate-x-5',
}

const SWITCH_THUMB_SURFACE = `bg-[${v('sv-bg-raised', T.bgRaised)}]`

const SWITCH_THUMB_SHADOW = `shadow-[${v('shadow-sm', T.shadowSm)}]`

/**
 * Compute the default className for the Switch thumb (the circle that slides
 * inside the track). Size + translate distance scale together so the thumb
 * lands flush against the opposite edge of the track at every size. Transform
 * motion uses the same 150ms ease as colour transitions for a coherent feel.
 */
export const computeSwitchThumbClasses = ({
  size = 'md',
}: {
  size?: ComponentSize
  /** Reserved for future use — checked state is expressed via data-[checked]: variants in the size map. */
  state?: SwitchState
} = {}): string =>
  [
    SWITCH_THUMB_LAYOUT,
    'rounded-full',
    SWITCH_THUMB_SIZE[size],
    SWITCH_THUMB_SURFACE,
    SWITCH_THUMB_SHADOW,
    'transition-transform duration-150',
  ].join(' ')
