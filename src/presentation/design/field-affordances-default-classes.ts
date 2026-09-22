/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for field-type **affordances** — the
 * visuals that are unique to a specific field-type and have no Base UI / form
 * primitive to inherit from ([internal ref], Phase 4 slice 1).
 *
 * Phase 2 already prestyled the form-control primitives the bulk of the 49
 * field-types reuse (text → input, single-select/multi-select → select,
 * checkbox-field → checkbox, …). The five field-types covered here are the
 * ones whose visual identity is not just "an input box":
 *
 *   - rating-field       → row of star icons (filled ★ vs empty ☆)
 *   - currency-field     → leading currency-symbol prefix + display readout
 *   - percentage-field   → trailing % suffix + display readout
 *   - color-field        → circular swatch trigger + popover-anchored picker
 *   - single-attachment + multiple-attachments → thumbnail tile + filename +
 *                                                remove × overlay
 *
 * The recipe mirrors the rest of the prestyled-default islands
 * (date-default-classes, disclosure-default-classes, etc.): layout / spacing
 * stay raw Tailwind utilities; only color / radius / shadow / motion / focus
 * classes thread through {@link withVarFallback} so `app.design.*` overrides
 * still win at the CSS cascade (var lookups resolve `--sv-*` first, fall back
 * to the inline OKLCH literal).
 *
 * Helper file lives in `src/presentation/islands/` (alongside the islands that
 * consume it) because the affordances hydrate client-side inside CRUD form +
 * data-table islands. The `presentation-component → presentation-island` layer
 * boundary disallows island imports from `ui/sections/`. Mirrors the location
 * chosen for the sibling `*-default-classes` helpers.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import { FOCUS_VISIBLE_RING, MOTION_COLORS, RADIUS_MD } from './shared-tokens-default-classes'

// ──────────────────────────────────────────────────────────────────────────────
// Shared building blocks
// ──────────────────────────────────────────────────────────────────────────────

type Size = 'sm' | 'md' | 'lg'
type AttachmentTileState = 'default' | 'uploading' | 'error'

const RADIUS_SM = `rounded-[${v('radius-sm', T.radiusSm)}]`
const RADIUS_LG = `rounded-[${v('radius-lg', T.radiusLg)}]`
const RADIUS_FULL = `rounded-[${v('radius-full', T.radiusFull)}]`

const DISABLED = 'disabled:cursor-not-allowed disabled:opacity-50'

// ──────────────────────────────────────────────────────────────────────────────
// RATING — star row container
// ──────────────────────────────────────────────────────────────────────────────

const RATING_SIZE_GAP: Record<Size, string> = {
  sm: 'gap-0.5',
  md: 'gap-1',
  lg: 'gap-1.5',
}

/**
 * Compute the default className for the rating-field outer container —
 * a horizontal flex row that holds N star buttons. The `size` axis lets a
 * compact data-table cell render `sm` while a tall CRUD form input renders
 * `md` / `lg`. Layout only; foreground tone comes from the per-star helper.
 */
export const computeRatingContainerClasses = ({ size = 'md' }: { size?: Size } = {}): string =>
  ['inline-flex items-center', RATING_SIZE_GAP[size]].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// RATING — single star (filled / empty, interactive / static)
// ──────────────────────────────────────────────────────────────────────────────

const STAR_LAYOUT = 'inline-flex items-center justify-center'
const STAR_SIZE = 'h-5 w-5 text-lg leading-none'

const STAR_FILLED = `text-[${v('sv-warning-solid', T.warningSolid)}]`
const STAR_EMPTY = `text-[${v('sv-fg-disabled', T.fgDisabled)}]`

const STAR_INTERACTIVE_HOVER = [
  `hover:text-[${v('sv-warning-solid', T.warningSolid)}]`,
  'cursor-pointer',
].join(' ')

const STAR_STATIC = 'cursor-default'

/**
 * Compute the default className for a single rating star — `filled` paints
 * with the semantic warning tone (warm amber that matches the conventional
 * "favourited" affordance across SaaS UIs); `empty` falls back to the
 * disabled-fg tone so the outline reads as low-emphasis. `interactive`
 * unlocks the hover preview + cursor for editable form contexts; static
 * cells (data-table readonly) suppress both.
 */
export const computeRatingStarClasses = ({
  filled,
  interactive = true,
}: {
  filled: boolean
  interactive?: boolean
}): string =>
  [
    STAR_LAYOUT,
    STAR_SIZE,
    filled ? STAR_FILLED : STAR_EMPTY,
    RADIUS_SM,
    interactive ? STAR_INTERACTIVE_HOVER : STAR_STATIC,
    interactive ? MOTION_COLORS : '',
    interactive ? FOCUS_VISIBLE_RING : '',
    interactive ? DISABLED : '',
  ]
    .filter(Boolean)
    .join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// RATING — half star (forward-compat: rating schemas may support 0.5 steps)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for a half-filled rating star — paints the
 * warning tone but at 50 % opacity so a `2.5/5` rating reads as "two solid,
 * one half-faded, two outlines". Used when the rating schema's value lands on
 * a 0.5 step. Static / non-interactive; consumers must wrap in a
 * non-interactive `<span>` so the half star never receives focus or hover.
 */
export const computeRatingHalfStarClasses = (): string =>
  [STAR_LAYOUT, STAR_SIZE, STAR_FILLED, 'opacity-50', RADIUS_SM].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// CURRENCY — input container + leading symbol
// ──────────────────────────────────────────────────────────────────────────────

const CURRENCY_CONTAINER_LAYOUT = 'relative inline-flex w-full items-center'

const CURRENCY_CONTAINER_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `focus-within:border-[${v('sv-focus-ring', T.focusRing)}]`,
  `focus-within:ring-1`,
  `focus-within:ring-[${v('sv-focus-ring', T.focusRing)}]`,
].join(' ')

/**
 * Compute the default className for the currency-field outer wrapper — a
 * positioned flex shell that hosts the leading currency-symbol element and
 * the actual `<input type="number">`. Border / focus-within ring stay on the
 * wrapper so the symbol + input read as one chip (the inner input itself
 * gets `border-0 bg-transparent`).
 */
export const computeCurrencyInputContainerClasses = (): string =>
  [CURRENCY_CONTAINER_LAYOUT, RADIUS_MD, CURRENCY_CONTAINER_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// CURRENCY — leading symbol (€ / $ / ¥ / £)
// ──────────────────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOL_LAYOUT =
  'pointer-events-none inline-flex h-full items-center justify-center px-2 select-none'

const CURRENCY_SYMBOL_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

/**
 * Compute the default className for the leading currency symbol. Uses the
 * muted foreground tone so the `$` / `€` / `¥` / `£` reads as a label
 * rather than competing with the typed value. `pointer-events-none` so a
 * click on the symbol falls through to the input behind it; `select-none`
 * stops drag-selection from including the symbol character. Typography
 * stays raw Tailwind (font-sans is intentional — currency glyphs render
 * better in proportional fonts than mono).
 */
export const computeCurrencySymbolClasses = (): string =>
  [CURRENCY_SYMBOL_LAYOUT, CURRENCY_SYMBOL_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// CURRENCY — readonly display (data-table cell / detail view)
// ──────────────────────────────────────────────────────────────────────────────

const CURRENCY_DISPLAY_LAYOUT = 'inline-block tabular-nums'

const CURRENCY_DISPLAY_SURFACE = `text-[${v('sv-fg', T.fg)}]`

/**
 * Compute the default className for a readonly currency value rendering
 * (data-table cells, detail panels, kanban card content). `tabular-nums`
 * locks digit widths so a column of prices aligns at the decimal — critical
 * for scannable financial readouts. Strong foreground tone (no muting) so
 * monetary amounts read as primary content.
 */
export const computeCurrencyDisplayClasses = (): string =>
  [CURRENCY_DISPLAY_LAYOUT, CURRENCY_DISPLAY_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// PERCENTAGE — input container + trailing % suffix
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for the percentage-field outer wrapper.
 * Shares the same chip surface as `computeCurrencyInputContainerClasses` —
 * a row of currency + percentage inputs reads as one cohesive form (border,
 * focus-within ring, raised bg). The trailing `%` element lives inside this
 * shell.
 */
export const computePercentageInputContainerClasses = (): string =>
  [CURRENCY_CONTAINER_LAYOUT, RADIUS_MD, CURRENCY_CONTAINER_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// PERCENTAGE — trailing % suffix
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for the trailing percent suffix — the
 * non-typeable `%` glyph that sits after the numeric input. Mirrors the
 * currency-symbol recipe (muted tone, no pointer events, no text selection)
 * but lives after the input rather than before it.
 */
export const computePercentageSuffixClasses = (): string =>
  [CURRENCY_SYMBOL_LAYOUT, CURRENCY_SYMBOL_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// COLOR — circular swatch trigger
// ──────────────────────────────────────────────────────────────────────────────

const SWATCH_SIZE_MAP: Record<Size, string> = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-9 w-9',
}

const SWATCH_LAYOUT = 'inline-flex items-center justify-center'

// No resting shadow: the strong border already bounds the swatch, and the
// hover elevation below is what communicates that it is pressable.
const SWATCH_SURFACE = ['border', `border-[${v('sv-border-strong', T.borderStrong)}]`].join(' ')

const SWATCH_MOTION = 'transition-[box-shadow,border-color] duration-150'

// The border change is the whole hover affordance. A chip that also LIFTS on
// hover claims to float, and nothing in this system floats on hover — elevation
// is reserved for a surface that is genuinely above the page.
const SWATCH_INTERACTIVE = [
  'cursor-pointer',
  `hover:border-[${v('sv-focus-ring', T.focusRing)}]`,
].join(' ')

/**
 * Compute the default className for the color-field swatch button — the
 * circular trigger that opens the picker popup. Uses `rounded-full` for the
 * universal "color chip" affordance; the actual hex color paints via inline
 * `style={{ backgroundColor: value }}` (it varies per record, so it cannot
 * be baked into a CSS var). Strong-border ring keeps white / very-light
 * swatches visible against the bg-raised surface; hover moves that border to
 * the focus-ring tone, which is the whole affordance — see `SWATCH_INTERACTIVE`
 * for why the chip does not also lift.
 */
export const computeColorSwatchClasses = ({ size = 'md' }: { size?: Size } = {}): string =>
  [
    SWATCH_LAYOUT,
    SWATCH_SIZE_MAP[size],
    RADIUS_FULL,
    SWATCH_SURFACE,
    SWATCH_MOTION,
    SWATCH_INTERACTIVE,
    FOCUS_VISIBLE_RING,
    DISABLED,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// COLOR — picker popup (popover-anchored)
// ──────────────────────────────────────────────────────────────────────────────

const COLOR_POPUP_LAYOUT = 'absolute left-0 top-full z-50 mt-1 p-3 min-w-[12rem]'

const COLOR_POPUP_SURFACE = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-overlay', T.bgOverlay)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `shadow-[${v('shadow-lg', T.shadowLg)}]`,
].join(' ')

/**
 * Compute the default className for the color-picker popup — the floating
 * panel that hosts the grid of preset swatches plus an `#rrggbb` hex input.
 * Mirrors the date-picker popup surface (bg-overlay + shadow-lg) so the
 * floating layers across the design system feel like one elevation tier.
 */
export const computeColorPickerPopupClasses = (): string =>
  [COLOR_POPUP_LAYOUT, RADIUS_LG, COLOR_POPUP_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// ATTACHMENT — tile container (state: default | uploading | error)
// ──────────────────────────────────────────────────────────────────────────────

const TILE_LAYOUT = 'relative inline-flex h-24 w-24 flex-col items-stretch overflow-hidden'

// Bordered, unelevated: an attachment tile sits IN the form, not above it.
const TILE_DEFAULT = [
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
].join(' ')

const TILE_UPLOADING = [
  'border-2 border-dashed',
  `border-[${v('sv-border-strong', T.borderStrong)}]`,
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  'animate-pulse',
].join(' ')

const TILE_ERROR = [
  'border',
  `border-[${v('sv-error-border', T.errorBorder)}]`,
  `bg-[${v('sv-error-bg', T.errorBg)}]`,
  `text-[${v('sv-error-fg', T.errorFg)}]`,
].join(' ')

const TILE_STATE_MAP: Record<AttachmentTileState, string> = {
  default: TILE_DEFAULT,
  uploading: TILE_UPLOADING,
  error: TILE_ERROR,
}

/**
 * Compute the default className for a single attachment tile (image preview
 * thumbnail or file-icon fallback). Fixed `h-24 w-24` so a row of attachments
 * grids cleanly; `overflow-hidden` clips the image preview to the rounded
 * corners. The `state` axis covers the three live states the uploader exposes:
 * `default` (saved file), `uploading` (in-flight POST to `/api/buckets`), and
 * `error` (failed upload or validation rejection — painted with the semantic
 * error surface so it reads as a problem at a glance).
 */
export const computeAttachmentTileClasses = ({
  state = 'default',
}: {
  state?: AttachmentTileState
} = {}): string => [TILE_LAYOUT, RADIUS_MD, TILE_STATE_MAP[state]].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// ATTACHMENT — image preview inside the tile
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for the `<img>` preview that fills the
 * upper portion of an image-attachment tile. `object-cover` centres + crops
 * the preview so awkward aspect ratios (16:9 photo into a square tile) still
 * look intentional rather than letterboxed.
 */
export const computeAttachmentTileImageClasses = (): string => 'h-16 w-full object-cover'

// ──────────────────────────────────────────────────────────────────────────────
// ATTACHMENT — file-icon fallback (non-image attachments)
// ──────────────────────────────────────────────────────────────────────────────

const ATTACHMENT_ICON_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

/**
 * Compute the default className for the file-icon placeholder shown when an
 * attachment is not an image (PDF, DOCX, ZIP, …). Centred in the tile body,
 * muted tone so the filename below carries the identifying information.
 */
export const computeAttachmentTileFileIconClasses = (): string =>
  ['flex h-16 w-full items-center justify-center text-3xl', ATTACHMENT_ICON_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// ATTACHMENT — filename label (under the preview / icon)
// ──────────────────────────────────────────────────────────────────────────────

const FILENAME_LAYOUT = 'truncate px-1 py-0.5 text-center text-xs'

const FILENAME_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

/**
 * Compute the default className for the filename label that sits under the
 * preview / icon. `truncate` so a long filename collapses to ellipsis rather
 * than stretching the tile or wrapping awkwardly across multiple lines.
 * `text-xs` keeps the label legible without competing with the visual
 * thumbnail content above it.
 */
export const computeAttachmentTileFilenameClasses = (): string =>
  [FILENAME_LAYOUT, FILENAME_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// ATTACHMENT — remove (×) overlay button
// ──────────────────────────────────────────────────────────────────────────────

const REMOVE_LAYOUT =
  'absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center text-xs leading-none'

const REMOVE_SURFACE = [
  `bg-[${v('sv-bg-overlay', T.bgOverlay)}]`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

const REMOVE_HOVER = [
  `hover:bg-[${v('sv-error-bg', T.errorBg)}]`,
  `hover:text-[${v('sv-error-fg', T.errorFg)}]`,
  `hover:border-[${v('sv-error-border', T.errorBorder)}]`,
].join(' ')

/**
 * Compute the default className for the small "×" button overlaid on the
 * top-right of an attachment tile. Floats above the preview via absolute
 * positioning; muted default tone so it doesn't compete with the thumbnail,
 * lights up in the semantic error surface on hover to telegraph "this is a
 * destructive action" without committing until clicked.
 */
export const computeAttachmentRemoveButtonClasses = (): string =>
  [
    REMOVE_LAYOUT,
    RADIUS_FULL,
    REMOVE_SURFACE,
    REMOVE_HOVER,
    MOTION_COLORS,
    FOCUS_VISIBLE_RING,
    DISABLED,
  ].join(' ')
