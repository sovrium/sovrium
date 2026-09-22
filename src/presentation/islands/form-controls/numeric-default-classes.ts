/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computer for the `number-input` and `slider`
 * components.
 *
 * Schema authors who write the bare `{ type: 'number-input' }` or
 * `{ type: 'slider' }` get complete, opinionated numeric controls — bordered
 * input wrapper with focus-within ring, primary-tinted hover stepper buttons,
 * filled track with primary-bordered thumb that grows on focus — with zero
 * theme-layer dependency.
 *
 * The recipe mirrors the buttons + inputs + selects + toggles slices
 * (commits 02b2f35f3 + 571ae53ce + 5527660bc + 000f835d7): layout / spacing
 * classes stay as raw Tailwind utilities; only color / radius / shadow /
 * motion / focus classes go through {@link withVarFallback} so `app.design.*`
 * overrides still win at the CSS cascade layer (var lookups resolve `--sv-*`
 * first, fall back to the inline OKLCH literal).
 *
 * The `number-input` is composed of three subparts: an outer wrapper (border
 * + bg-raised + focus-within ring), the inner `<input>` field (transparent so
 * the wrapper's surface shows through), and stepper buttons that share a
 * divider with the input. The number-input island already houses its own
 * stepper sub-component (`StepperButton`); there is no separate stepper
 * island in this slice.
 *
 * The `slider` is composed of three subparts: the track (muted body-subtle
 * background pill), the range indicator (filled portion in primary), and the
 * thumb (primary-bordered circle with raised-surface fill, focus-visible
 * ring). Size axis on the thumb maps to a single size by default (md, h-4)
 * because Sovrium's slider schema does not currently expose a size prop —
 * but the function accepts `size` for forward compatibility.
 *
 * Helper file lives in `src/presentation/islands/` (alongside the islands that
 * consume it) because both `NumberInputIsland` and `SliderIsland` run as
 * client islands — the layer-boundaries ESLint rule disallows
 * `ui/sections/` imports from `islands/`. Mirrors the location chosen for
 * `select-default-classes.ts` and `toggle-default-classes.ts`.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import { MOTION_COLORS, RADIUS_MD } from '../../design/shared-tokens-default-classes'

// ──────────────────────────────────────────────────────────────────────────────
// Shared building blocks
// ──────────────────────────────────────────────────────────────────────────────

type FieldState = 'default' | 'disabled' | 'error'
type StepperDirection = 'increment' | 'decrement'
type ComponentSize = 'sm' | 'md' | 'lg'

const DISABLED_CURSOR =
  'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 disabled:cursor-not-allowed disabled:opacity-50'

// ──────────────────────────────────────────────────────────────────────────────
// NUMBER-INPUT WRAPPER (outer span with border + focus-within ring)
// ──────────────────────────────────────────────────────────────────────────────

const NUMBER_INPUT_WRAPPER_LAYOUT = 'inline-flex items-center overflow-hidden border'

const NUMBER_INPUT_WRAPPER_SURFACE_DEFAULT = [
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
].join(' ')

const NUMBER_INPUT_WRAPPER_SURFACE_ERROR = [
  `border-[${v('sv-error-border', T.errorBorder)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
].join(' ')

const NUMBER_INPUT_WRAPPER_FOCUS_WITHIN = [
  'focus-within:outline-none',
  'focus-within:ring-2',
  `focus-within:ring-[${v('sv-focus-ring', T.focusRing)}]`,
  `focus-within:border-[${v('sv-focus-ring', T.focusRing)}]`,
].join(' ')

/**
 * Compute the default className for the number-input outer wrapper span — the
 * bordered surface that hosts the inner `<input>` and the optional ±
 * stepper buttons. Renders a focus-within ring so keyboard focus on the inner
 * input lights up the whole control. Layout (`inline-flex`, `overflow-hidden`)
 * stays as raw Tailwind; only colour / border / focus ring tokens go through
 * the var-with-fallback recipe.
 */
export const computeNumberInputWrapperClasses = ({
  state = 'default',
}: {
  state?: FieldState
} = {}): string =>
  [
    NUMBER_INPUT_WRAPPER_LAYOUT,
    RADIUS_MD,
    state === 'error' ? NUMBER_INPUT_WRAPPER_SURFACE_ERROR : NUMBER_INPUT_WRAPPER_SURFACE_DEFAULT,
    MOTION_COLORS,
    NUMBER_INPUT_WRAPPER_FOCUS_WITHIN,
    DISABLED_CURSOR,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// NUMBER-INPUT FIELD (inner <input type="number">)
// ──────────────────────────────────────────────────────────────────────────────

const NUMBER_INPUT_FIELD_LAYOUT = 'h-9 w-20 border-0 bg-transparent px-3 text-base text-center'

const NUMBER_INPUT_FIELD_SURFACE = [
  `text-[${v('sv-fg', T.fg)}]`,
  `placeholder:text-[${v('sv-fg-muted', T.fgMuted)}]`,
  'focus:outline-none',
  'focus:ring-0',
].join(' ')

/**
 * Compute the default className for the inner `<input type="number">`. The
 * field itself is borderless / transparent so the wrapper's bordered surface
 * shows through; focus styling lives on the wrapper via `focus-within`. Size
 * defaults give a snug 80px field at h-9 (matches the toggle/select size:md
 * baseline). The `w-20` is wide enough for 4-5 digits — the common case for
 * quantities, percentages, zoom levels, etc.
 */
export const computeNumberInputFieldClasses = (): string =>
  [NUMBER_INPUT_FIELD_LAYOUT, NUMBER_INPUT_FIELD_SURFACE, DISABLED_CURSOR].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// NUMBER-INPUT STEPPER BUTTONS (± flanking buttons)
// ──────────────────────────────────────────────────────────────────────────────

const STEPPER_LAYOUT = 'inline-flex h-9 w-9 shrink-0 items-center justify-center text-base'

const STEPPER_SURFACE = [
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  `hover:bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  `hover:text-[${v('sv-primary-subtle-fg', T.primarySubtleFg)}]`,
].join(' ')

const STEPPER_DIVIDER_DECREMENT = ['border-r', `border-[${v('sv-border', T.border)}]`].join(' ')

const STEPPER_DIVIDER_INCREMENT = ['border-l', `border-[${v('sv-border', T.border)}]`].join(' ')

/**
 * Compute the default className for a number-input stepper button (the `−` /
 * `+` controls flanking the field). The decrement button carries a right
 * border (acts as divider between it and the input); the increment button
 * carries a left border. Hover state lights up with `primary-subtle` so the
 * affordance is unambiguous — matches the toggle pressed-state vocabulary so
 * a row of number-inputs + toggles reads as one design system.
 */
export const computeNumberInputStepperClasses = ({
  direction,
}: {
  direction: StepperDirection
}): string =>
  [
    STEPPER_LAYOUT,
    STEPPER_SURFACE,
    direction === 'decrement' ? STEPPER_DIVIDER_DECREMENT : STEPPER_DIVIDER_INCREMENT,
    MOTION_COLORS,
    DISABLED_CURSOR,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// SLIDER TRACK (outer rounded pill)
// ──────────────────────────────────────────────────────────────────────────────

const SLIDER_TRACK_LAYOUT = 'relative h-1.5 w-full grow rounded-full'

const SLIDER_TRACK_SURFACE = `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`

/**
 * Compute the default className for the Slider track (the outer rounded pill
 * that hosts the range indicator and thumb). Track height is 6px (h-1.5) and
 * the surface uses the muted body-subtle tone so the filled `Indicator`
 * (primary) reads with strong contrast. Orientation defaults to horizontal —
 * Sovrium's slider schema does not currently expose a vertical orientation.
 */
export const computeSliderTrackClasses = ({
  state = 'default',
}: {
  state?: FieldState
} = {}): string =>
  [
    SLIDER_TRACK_LAYOUT,
    SLIDER_TRACK_SURFACE,
    MOTION_COLORS,
    state === 'disabled' ? 'opacity-50' : '',
  ]
    .filter(Boolean)
    .join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// SLIDER RANGE (filled portion left of thumb)
// ──────────────────────────────────────────────────────────────────────────────

const SLIDER_RANGE_LAYOUT = 'absolute h-full rounded-full'

const SLIDER_RANGE_SURFACE = 'bg-primary'

/**
 * Compute the default className for the Slider range indicator (the filled
 * portion of the track between min and the thumb position). Uses the canonical
 * `bg-primary` role utility (always minted by the default theme layer, resolving
 * `--color-primary` which the author `theme.colors.primary` bridge recolors) to
 * match button + checked-switch surfaces — a single primary tone across all
 * interactive "active" affordances keeps the cluster cohesive, and the role
 * class stays addressable as `.bg-primary`.
 */
export const computeSliderRangeClasses = (): string =>
  [SLIDER_RANGE_LAYOUT, SLIDER_RANGE_SURFACE, MOTION_COLORS].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// SLIDER THUMB (draggable circle)
// ──────────────────────────────────────────────────────────────────────────────

const SLIDER_THUMB_LAYOUT = 'block shrink-0 rounded-full border-2'

const SLIDER_THUMB_SIZE: Record<ComponentSize, string> = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

const SLIDER_THUMB_SURFACE = [
  `border-[${v('sv-primary', T.primary)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `hover:bg-[${v('sv-primary-subtle', T.primarySubtle)}]`,
  `shadow-[${v('shadow-sm', T.shadowSm)}]`,
].join(' ')

const SLIDER_THUMB_FOCUS = [
  'focus-visible:outline-none',
  'focus-visible:ring-2',
  `focus-visible:ring-[${v('sv-focus-ring', T.focusRing)}]`,
].join(' ')

/**
 * Compute the default className for the Slider thumb (the draggable circle).
 * Carries a primary-coloured 2px border + raised-surface fill so the thumb
 * pops against the muted track. Hover lights up with the primary-subtle tone
 * (same vocabulary as the stepper). Size defaults to `md` (h-4 / 16px) which
 * matches Base UI Slider's default visual weight and reads well at the 6px
 * track height. `lg` is the touch-friendly size; `sm` is the dense-table
 * variant.
 */
export const computeSliderThumbClasses = ({
  size = 'md',
}: {
  size?: ComponentSize
} = {}): string =>
  [
    SLIDER_THUMB_LAYOUT,
    SLIDER_THUMB_SIZE[size],
    SLIDER_THUMB_SURFACE,
    MOTION_COLORS,
    SLIDER_THUMB_FOCUS,
    DISABLED_CURSOR,
  ].join(' ')
