/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for read-only data-table **cell
 * affordances** — the per-field-type chrome that paints around a value when
 * it shows up inside a `<td>` ([internal ref], Phase 4 slice 3).
 *
 * Phase 4 slice 1 prestyled the form-control affordances (rating star row,
 * currency input chip, color swatch, attachment tile, …) that live inside the
 * CRUD form. Slice 2 traced the data-table read path and discovered that 9
 * field-types had no read-only cell renderer at all — TanStack Table fell
 * through to `String(value)`, so a user-field cell showed a raw user-id, a
 * status-field cell showed the raw option value (no color), a JSON cell
 * showed a stringified object.
 *
 * This slice fixes that: each helper produces the className for the chrome
 * around the read-only value (pill, badge, chip, mono preview, …) so a
 * read-only column of users / statuses / JSON / etc. reads as the
 * field-type it represents, not as a stringified opaque blob.
 *
 *   - user-pill         → small avatar circle + name (user / created-by / updated-by / deleted-by)
 *   - linked-record     → rounded pill for relational / lookup / rollup values
 *   - status-pill       → colored bg pill (tone-driven per status option)
 *   - formula-readonly  → mono-aware readout for computed values
 *   - geolocation       → pin glyph + lat/lng mono pair
 *   - count-badge       → small numeric badge (rounded, bg-bgSubtle, tabular-nums)
 *   - json-preview      → single-line truncated mono block
 *   - array-chips       → wrap of small neutral chips
 *   - code-inline       → inline mono code with bg-bgSubtle
 *
 * Recipe mirrors {@link ./field-affordances-default-classes}: layout / spacing
 * stay raw Tailwind utilities; color / radius / shadow / motion thread through
 * {@link withVarFallback} so `app.theme.*` overrides still win at the CSS
 * cascade. Helper file lives in `src/presentation/islands/` (alongside the
 * islands that consume it) so the affordances hydrate client-side inside the
 * data-table island. The `presentation-component → presentation-island` layer
 * boundary disallows island imports from `ui/sections/`.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/utils/design/css-var'
import { RADIUS_MD } from './shared-tokens-default-classes'

// ──────────────────────────────────────────────────────────────────────────────
// Shared building blocks
// ──────────────────────────────────────────────────────────────────────────────

type FormulaKind = 'number' | 'text' | 'date' | 'error'

const RADIUS_SM = `rounded-[${v('sv-radius-sm', T.radiusSm)}]`
const RADIUS_FULL = `rounded-[${v('sv-radius-full', T.radiusFull)}]`

const PILL_LAYOUT = 'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs max-w-full'

// ──────────────────────────────────────────────────────────────────────────────
// USER — pill container + avatar + name label
// ──────────────────────────────────────────────────────────────────────────────

const USER_PILL_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

/**
 * Compute the default className for the user-pill container — wraps the small
 * avatar circle plus the display name. Used for `user-field` and the three
 * audit aliases (`created-by`, `updated-by`, `deleted-by`) which share the
 * same visual since they all reference a user record. Subtle bg keeps the
 * pill quiet against the cell whitespace; the bordered chip reads as a
 * "person reference" without competing with stronger UI accents.
 */
export const computeUserPillClasses = (): string =>
  [PILL_LAYOUT, RADIUS_FULL, USER_PILL_SURFACE].join(' ')

const USER_AVATAR_LAYOUT =
  'inline-flex h-4 w-4 flex-shrink-0 items-center justify-center overflow-hidden text-[10px] leading-none font-medium uppercase'

const USER_AVATAR_SURFACE = [
  `bg-[${v('sv-primary', T.primary)}]`,
  `text-[${v('sv-primary-fg', T.primaryFg)}]`,
].join(' ')

/**
 * Compute the default className for the small avatar circle inside a user
 * pill — `h-4 w-4` matches `text-xs` line height so the pill stays compact
 * inside a data-table row. Strong primary bg gives the avatar enough contrast
 * to read at small sizes even when the user has no image (initials fall back).
 */
export const computeUserAvatarClasses = (): string =>
  [USER_AVATAR_LAYOUT, RADIUS_FULL, USER_AVATAR_SURFACE].join(' ')

/**
 * Compute the default className for the user display name inside a pill.
 * `truncate` so a long full name collapses to ellipsis rather than stretching
 * the column; `min-w-0` lets flex children shrink past their intrinsic width
 * (the truncate without min-w-0 caveat).
 */
export const computeUserNameClasses = (): string => 'min-w-0 truncate'

// ──────────────────────────────────────────────────────────────────────────────
// LINKED-RECORD — rounded pill for relationship / lookup / rollup values
// ──────────────────────────────────────────────────────────────────────────────

const LINKED_RECORD_SURFACE = [
  `bg-[${v('sv-info-bg', T.infoBg)}]`,
  `text-[${v('sv-info-fg', T.infoFg)}]`,
  'border',
  `border-[${v('sv-info-border', T.infoBorder)}]`,
].join(' ')

/**
 * Compute the default className for a single linked-record pill. Covers the
 * three relational field-types (`relationship-field`, `lookup-field`,
 * `rollup-field`) — all three render as a reference to another record, so a
 * shared "info-tone" pill telegraphs "this points elsewhere". `info-bg` reads
 * as a cool reference cue distinct from the warm status-pill palette.
 */
export const computeLinkedRecordPillClasses = (): string =>
  [PILL_LAYOUT, RADIUS_FULL, LINKED_RECORD_SURFACE, 'truncate'].join(' ')

/**
 * Compute the default className for the wrap container that holds multiple
 * linked-record pills (lookup / rollup that resolves to N values).
 * `flex-wrap` so a row of many references wraps within the column rather than
 * forcing horizontal scroll; `gap-1` matches the pill-to-pill rhythm.
 */
export const computeLinkedRecordWrapClasses = (): string =>
  'inline-flex flex-wrap items-center gap-1'

// ──────────────────────────────────────────────────────────────────────────────
// STATUS — colored bg pill (tone-driven per status option)
// ──────────────────────────────────────────────────────────────────────────────

const STATUS_PILL_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

/**
 * Compute the default className for a status pill — the QUIET chrome a
 * `status` / `single-select` chip wears when its option declares no colour.
 *
 * There is deliberately no tone axis. This recipe used to take one of five
 * semantic tones (`neutral`, `info`, `success`, `warning`, `error`) and paint
 * the pill from a matching bg/fg/border triple. [internal ref] A7 retired that
 * vocabulary: an option's colour is now the author's DECLARED hex, and the
 * foreground and border are DERIVED from it (`resolveChipPaint`) rather than
 * guessed from what the option is called. The four semantic arms outlived the
 * guessing by one refactor — every production caller passed `'neutral'`, and
 * only the unit test ever reached the rest.
 *
 * Keeping them would have been worse than dead weight: an unused-but-callable
 * `tone: 'success'` is a working entrance for exactly the ramp A7 removed, and
 * Knip cannot flag it because the arms are object properties rather than
 * exports. Restoring tone-guessing should have to be a deliberate change, not a
 * one-word argument that already type-checks.
 */
export const computeStatusPillClasses = (): string =>
  [PILL_LAYOUT, RADIUS_FULL, 'border font-medium', STATUS_PILL_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// FORMULA — read-only formatted value (kind-dispatched)
// ──────────────────────────────────────────────────────────────────────────────

const FORMULA_KIND_MAP: Record<FormulaKind, string> = {
  number: ['tabular-nums', `text-[${v('sv-fg', T.fg)}]`].join(' '),
  text: `text-[${v('sv-fg', T.fg)}]`,
  date: `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  error: ['italic', `text-[${v('sv-error-fg', T.errorFg)}]`].join(' '),
}

/**
 * Compute the default className for a read-only formula-field cell. The
 * `kind` axis dispatches on the formula's computed result shape:
 *   - `number` → `tabular-nums` so a column of computed totals aligns
 *   - `text`   → strong fg (computed text reads as primary content)
 *   - `date`   → muted fg (computed dates are secondary metadata)
 *   - `error`  → italic + error-fg so `#REF!`-style failures pop visibly
 * Pure typography helper; no chrome — formula values feel native, the kind
 * just calibrates the tone.
 */
export const computeFormulaReadonlyClasses = ({
  kind = 'text',
}: { kind?: FormulaKind } = {}): string =>
  ['inline-block max-w-full truncate', FORMULA_KIND_MAP[kind]].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// GEOLOCATION — pin icon + lat/lng mono pair
// ──────────────────────────────────────────────────────────────────────────────

const GEOLOC_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

/**
 * Compute the default className for a geolocation cell — bordered chip that
 * holds a pin glyph plus the lat/lng pair. The lat/lng numerics render
 * inside the chip with `tabular-nums + font-mono` (via the dedicated coord
 * helper) so a column of coordinates aligns at the decimal.
 */
export const computeGeolocationClasses = (): string =>
  ['inline-flex items-center gap-1.5 px-2 py-0.5 text-xs', RADIUS_MD, GEOLOC_SURFACE].join(' ')

/**
 * Compute the default className for the lat/lng numeric pair inside a
 * geolocation cell. Mono + tabular-nums lock digit widths so the comma-
 * separated pair reads as scannable coordinates rather than free-flowing
 * prose; `text-[11px]` keeps the readout compact inside a data-table row.
 */
export const computeGeolocationCoordClasses = (): string =>
  ['font-mono tabular-nums text-[11px]', `text-[${v('sv-fg', T.fg)}]`].join(' ')

/**
 * Compute the default className for the small pin glyph that prefixes the
 * lat/lng pair. Muted tone so the icon reads as a label rather than
 * competing with the coordinate readout it precedes.
 */
export const computeGeolocationPinClasses = (): string =>
  ['inline-flex items-center text-xs leading-none', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(
    ' '
  )

// ──────────────────────────────────────────────────────────────────────────────
// COUNT — small numeric badge
// ──────────────────────────────────────────────────────────────────────────────

const COUNT_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

/**
 * Compute the default className for a count-field badge — small rounded chip
 * holding an integer. Used when a relational field aggregates the linked-
 * record count (e.g., "5 tasks", "12 attachments"). `tabular-nums` so a
 * column of counts aligns at the digit; `min-w-[1.5rem]` keeps single-digit
 * badges from collapsing to a sliver.
 */
export const computeCountBadgeClasses = (): string =>
  [
    'inline-flex min-w-[1.5rem] items-center justify-center px-1.5 py-0.5 text-xs font-medium tabular-nums',
    RADIUS_FULL,
    COUNT_SURFACE,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// JSON — single-line truncated mono preview
// ──────────────────────────────────────────────────────────────────────────────

const JSON_PREVIEW_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
].join(' ')

/**
 * Compute the default className for a json-field readout — a single-line
 * mono block that previews the first ~50 chars of the stringified JSON.
 * `font-mono` telegraphs "this is structured data, not free prose";
 * `truncate` so a large JSON blob collapses to ellipsis rather than blowing
 * out the column; `bg-bg-subtle` echoes the count badge / code-inline
 * surface so the three "raw data" cell types share a visual family.
 */
export const computeJsonPreviewClasses = (): string =>
  [
    'inline-block max-w-full truncate px-1.5 py-0.5 font-mono text-[11px]',
    RADIUS_SM,
    JSON_PREVIEW_SURFACE,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// ARRAY — wrap of small neutral chips
// ──────────────────────────────────────────────────────────────────────────────

const ARRAY_CHIP_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

/**
 * Compute the default className for the wrap container that holds multiple
 * array-value chips. Mirrors the linked-record wrap recipe so a column of
 * "list of values" cells (array of strings, array of numbers, …) has a
 * consistent visual rhythm with relational cells.
 */
export const computeArrayChipsWrapClasses = (): string =>
  'inline-flex flex-wrap items-center gap-1 max-w-full'

/**
 * Compute the default className for a single chip inside an array-value
 * cell. Smaller / quieter than a status-pill (no border tone, muted fg) —
 * array values are usually opaque labels (tags / keywords / categories) so
 * the visual stays low-emphasis to keep a column of arrays scannable.
 */
export const computeArrayChipClasses = (): string =>
  ['inline-flex items-center px-1.5 py-0 text-[11px]', RADIUS_SM, ARRAY_CHIP_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// CODE — inline mono code with bg-bgSubtle
// ──────────────────────────────────────────────────────────────────────────────

const CODE_INLINE_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
].join(' ')

/**
 * Compute the default className for a code-field cell — inline mono code
 * with a subtle bg so the code reads as a distinct content type without
 * the heavyweight chrome of a full code-block. Maps directly to Sovrium's
 * `code` field-type (lang-aware editor in CRUD form, single-line preview
 * in the data-table cell).
 */
export const computeCodeInlineClasses = (): string =>
  [
    'inline-block max-w-full truncate px-1 py-0.5 font-mono text-[11px]',
    RADIUS_SM,
    CODE_INLINE_SURFACE,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// SCALAR AFFORDANCES — the field types that fell through to `String(value)`
//
// Eight field types had no read-only cell renderer at all, so a rating showed
// a bare `3`, a progress field a bare `72`, a color field the literal text
// `#3B82F6`, and an attachment `[object Object]`.
//
// [internal ref] A7 decides which of these may carry colour, and they do not all fall
// the same way. The operational test is WHO CHOSE THE VOCABULARY: a hue the app
// author declared to describe their own data is record data and paints; a hue
// Sovrium picked for itself is chrome and stays monochrome. So a `color` field
// paints always (its value IS a colour the record declares), a `progress` bar
// paints only the hex its field declared, and a `rating` never paints —
// `RatingFieldSchema` has `max` and `style` and no `color` at all, so
// `style: 'stars'` selects a GLYPH and says nothing about hue. Gold stars would
// be the platform inventing a vocabulary and attributing it to the author.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the className for the rating row — the `role="img"` container that
 * holds one glyph per point of the declared `max`.
 */
export const computeRatingRowClasses = (): string =>
  'inline-flex items-center gap-0.5 text-xs leading-none'

/**
 * Compute the className for one rating glyph. `filled` selects between the
 * strong and the disabled FOREGROUND token — both neutral, per A7. The glyph
 * itself also differs (a solid vs a hollow shape), so the score reads without
 * colour doing any of the work.
 */
export const computeRatingGlyphClasses = ({ filled = false }: { filled?: boolean } = {}): string =>
  filled ? `text-[${v('sv-fg', T.fg)}]` : `text-[${v('sv-fg-disabled', T.fgDisabled)}]`

/**
 * Compute the className for the progress TRACK — the `role="progressbar"` box
 * the fill is measured against. Fixed width so a column of bars is comparable
 * at a glance, `overflow-hidden` so the fill's corners follow the track's.
 *
 * No padding and no border: the fill's width is a percentage of this box, and
 * either would make the painted proportion disagree with the stored value.
 */
export const computeProgressTrackClasses = (): string =>
  [
    'inline-block h-1.5 w-24 max-w-full overflow-hidden align-middle',
    RADIUS_FULL,
    `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  ].join(' ')

/**
 * Compute the className for the progress FILL. The width is an inline style
 * (it is the datum), and so is the author's declared `color` when present.
 * With no declared colour the fill takes the muted foreground token — a
 * neutral, not a hue the platform picked (A7 ruling 5: the amendment is an
 * opt-in, never a repaint).
 */
export const computeProgressFillClasses = (): string =>
  ['block h-full', `bg-[${v('sv-fg-muted', T.fgMuted)}]`].join(' ')

/**
 * Compute the className for a color cell — the swatch and its code sit side by
 * side, because painting the value must not cost the ability to read or copy it.
 */
export const computeColorCellClasses = (): string => 'inline-flex items-center gap-1.5'

/**
 * Compute the className for the painted swatch. The border is load-bearing: a
 * white or near-white stored value would otherwise vanish against a white
 * surface with nothing to show it had rendered at all.
 */
export const computeColorSwatchClasses = (): string =>
  [
    'inline-block h-3.5 w-3.5 flex-shrink-0 border',
    RADIUS_SM,
    `border-[${v('sv-border', T.border)}]`,
  ].join(' ')

/**
 * Compute the className for the readable hex beside the swatch. Mono +
 * tabular so a column of codes aligns character for character.
 */
export const computeColorCodeClasses = (): string =>
  ['font-mono text-[11px] tabular-nums', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(' ')

/**
 * Compute the className for a barcode readout. A fixed-advance face is the
 * whole point: a column of codes is scanned by eye for a differing digit, and
 * proportional digits defeat that.
 */
export const computeBarcodeClasses = (): string =>
  ['font-mono text-[11px] tabular-nums', `text-[${v('sv-fg', T.fg)}]`].join(' ')

/**
 * Compute the className for a formatted duration. `tabular-nums` so a column
 * of `h:mm` readouts aligns at the colon.
 */
export const computeDurationClasses = (): string =>
  ['tabular-nums', `text-[${v('sv-fg', T.fg)}]`].join(' ')

/**
 * Compute the className for a boolean check / cross glyph. Neutral on both
 * arms: a green tick and a red cross would be Sovrium choosing a vocabulary
 * the `checkbox` schema never declares, and colour alone would carry the
 * meaning for anyone who cannot separate the two hues.
 */
export const computeCheckboxGlyphClasses = ({
  checked = false,
}: { checked?: boolean } = {}): string =>
  [
    'inline-flex items-center text-xs leading-none',
    checked ? `text-[${v('sv-fg', T.fg)}]` : `text-[${v('sv-fg-disabled', T.fgDisabled)}]`,
  ].join(' ')

/**
 * Compute the className for the wrap holding one link per attached file.
 */
export const computeAttachmentListClasses = (): string =>
  'inline-flex flex-wrap items-center gap-1.5 max-w-full'

/**
 * Compute the className for one attachment link. Renders the file's NAME, not
 * its storage key — the key is a path the reader never chose and cannot use.
 */
export const computeAttachmentLinkClasses = (): string =>
  [
    'inline-block max-w-full truncate underline underline-offset-2',
    `text-[${v('sv-fg', T.fg)}]`,
  ].join(' ')
