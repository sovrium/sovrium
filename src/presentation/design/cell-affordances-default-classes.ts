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
 *   - linked-record     → neutral rounded pill for relational / lookup / rollup values
 *   - status-pill       → the shared outline badge, filled by the option's own hue
 *   - formula-readonly  → mono-aware readout for computed values
 *   - geolocation       → pin glyph + lat/lng mono pair, no chrome
 *   - count-badge       → the shared secondary badge, tabular
 *   - json-preview      → single-line truncated mono, no chrome
 *   - array-chips       → wrap of the same outline badge, one hue per option
 *   - code-inline       → inline mono, no chrome
 *
 * ## Chips route through the SHARED badge
 * Three of the computers above stopped owning a chip string and now compose
 * {@link computeBadgeClasses} instead. A cell chip, a nav badge and a status
 * label are the same object, and they had drifted into three shapes — a
 * `rounded-full` pill here, a 2px-radius tag there, three different paddings —
 * so a reader who saw a status in a table and the same status in a page section
 * saw two different things. What stays local is the AUTHOR's paint: an option's
 * declared colour is an inline `style` computed per value, and no shared recipe
 * ever sees it.
 *
 * Recipe mirrors {@link ./field-affordances-default-classes}: layout / spacing
 * stay raw Tailwind utilities; color / radius / shadow / motion thread through
 * {@link withVarFallback} so `app.design.*` overrides still win at the CSS
 * cascade. Helper file lives in `src/presentation/islands/` (alongside the
 * islands that consume it) so the affordances hydrate client-side inside the
 * data-table island. The `presentation-component → presentation-island` layer
 * boundary disallows island imports from `ui/sections/`.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import { computeBadgeClasses } from '@/presentation/design/navbar-default-classes'

// ──────────────────────────────────────────────────────────────────────────────
// Shared building blocks
// ──────────────────────────────────────────────────────────────────────────────

type FormulaKind = 'number' | 'text' | 'date' | 'error'

const RADIUS_SM = `rounded-[${v('radius-sm', T.radiusSm)}]`
const RADIUS_FULL = `rounded-[${v('radius-full', T.radiusFull)}]`

const PILL_LAYOUT = 'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs max-w-full'

// ──────────────────────────────────────────────────────────────────────────────
// USER — pill container + avatar + name label
// ──────────────────────────────────────────────────────────────────────────────

// The drawings give the person pill `background:#fefefe; border:1px solid
// #d3d3d3` — RAISED on the row's own surface, not pressed into it. A reference
// to a record elsewhere is a thing the reader can follow, and a well says the
// opposite: that it is set into the cell and part of it.
const REFERENCE_PILL_SURFACE = [
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  'border',
  `border-[${v('sv-border-strong', T.borderStrong)}]`,
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
  [PILL_LAYOUT, RADIUS_FULL, REFERENCE_PILL_SURFACE].join(' ')

const USER_AVATAR_LAYOUT =
  'inline-flex h-4 w-4 flex-shrink-0 items-center justify-center overflow-hidden text-2xs leading-none font-medium uppercase'

// A QUIET disc, where this took the primary fill. The initials are already
// legible at this size on a light well, and the primary token belongs to
// controls: an app that overrides it to a saturated brand hue got a column of
// coloured dots down a table whose loudest element should be the data.
const USER_AVATAR_SURFACE = [
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
].join(' ')

/**
 * Compute the default className for the small avatar circle inside a user
 * pill — `h-4 w-4` matches `text-xs` line height so the pill stays compact
 * inside a data-table row.
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

/**
 * Compute the default className for a single linked-record pill. Covers the
 * three relational field-types (`relationship-field`, `lookup-field`,
 * `rollup-field`) — all three render as a reference to another record, so they
 * share one shape with the person pill, which is the same statement about a
 * different table.
 *
 * NEUTRAL, where this wore the `info` tone. The drawings give a reference no
 * hue at all: the semantic tones are reserved for a condition the reader has to
 * act on, and "this value lives in another table" is a fact about the schema
 * rather than a warning. A column of blue pills also collided with the author's
 * own option colours two columns over, which ARE meaningful — so the platform
 * was spending the reader's attention on the one that is not.
 */
export const computeLinkedRecordPillClasses = (): string =>
  [PILL_LAYOUT, RADIUS_FULL, REFERENCE_PILL_SURFACE, 'truncate'].join(' ')

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
 *
 * ## The shape is the shared badge now, and the fill is still the author's
 * A chip is a chip: this is {@link computeBadgeClasses} at `outline`, which is
 * the drawings' `.b-out` exactly — 11px on a 1.3 leading, `radius-sm`, a strong
 * border, no fill. What it stops being is a `rounded-full` PILL, which reads as
 * a control the reader could press rather than a label the row carries.
 *
 * The declared option colour is UNCHANGED and still arrives as an inline
 * `style` from `resolveChipPaint`, filling the whole chip under an AA-paired
 * foreground. The drawings put a status hue in a leading dot on an outline
 * badge; Sovrium fills instead, and that is a specified contract rather than
 * drift — `option-colors.spec.ts` reads the resolved pixel and holds it. An
 * option that declares no colour falls through to the bare outline badge, which
 * IS the drawing.
 */
export const computeStatusPillClasses = (): string =>
  [computeBadgeClasses({ variant: 'outline' }), 'max-w-full'].join(' ')

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

/**
 * Compute the default className for a geolocation cell — the pin glyph and the
 * lat/lng pair, side by side. The numerics render `tabular-nums + font-mono`
 * (via the dedicated coord helper) so a column of coordinates aligns at the
 * decimal.
 *
 * NO chip. The drawings render a coordinate as bare mono text, and they are
 * right to: a chip is drawn around a value that is a token in a vocabulary — an
 * option, a reference, a count — and a latitude is a number. Boxing it made a
 * geolocation column the loudest one on a screen for no reason a reader could
 * name.
 */
export const computeGeolocationClasses = (): string => 'inline-flex items-center gap-1.5 text-xs'

/**
 * Compute the default className for the lat/lng numeric pair inside a
 * geolocation cell. Mono + tabular-nums lock digit widths so the comma-
 * separated pair reads as scannable coordinates rather than free-flowing
 * prose; the density text token keeps the readout compact inside a data-table
 * row.
 */
export const computeGeolocationCoordClasses = (): string =>
  ['font-mono tabular-nums text-(length:--sv-density-text)', `text-[${v('sv-fg', T.fg)}]`].join(' ')

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

/**
 * Compute the default className for a count-field badge — the chip holding the
 * integer a relational field aggregates ("5 tasks", "12 attachments").
 *
 * The shared badge at `secondary`, which is the drawings' `.b-neu`: a filled
 * neutral chip, the tone reserved for a number the platform computed rather
 * than a value the author chose. `tabular-nums` on top so a column of counts
 * aligns at the digit, and `justify-center` so a one-digit count sits under a
 * two-digit one rather than beside it.
 */
export const computeCountBadgeClasses = (): string =>
  [
    computeBadgeClasses({ variant: 'secondary' }),
    'min-w-[1.5rem] justify-center tabular-nums',
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// JSON — single-line truncated mono preview
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for a json-field readout — a single-line
 * mono preview of the stringified JSON. `font-mono` telegraphs "this is
 * structured data, not free prose"; `truncate` so a large blob collapses to
 * ellipsis rather than blowing out the column.
 *
 * BARE, where this carried a well and a radius. The mono face is already the
 * whole signal that the cell holds structured data, and a fill behind it made a
 * JSON column read as selected — the grid's own paint for a row the reader
 * picked is the same well.
 */
export const computeJsonPreviewClasses = (): string =>
  [
    'inline-block max-w-full truncate font-mono text-(length:--sv-density-text)',
    `text-[${v('sv-fg', T.fg)}]`,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// ARRAY — wrap of small neutral chips
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for the wrap container that holds multiple
 * array-value chips. Mirrors the linked-record wrap recipe so a column of
 * "list of values" cells (array of strings, array of numbers, …) has a
 * consistent visual rhythm with relational cells.
 */
export const computeArrayChipsWrapClasses = (): string =>
  'inline-flex flex-wrap items-center gap-1 max-w-full'

/**
 * Compute the default className for a single chip inside an array-value cell —
 * an `array` field's entries, and a `multi-select`'s chosen options.
 *
 * The SAME shared badge as the status chip, at `outline`. These two are the
 * same object seen once and seen several times over, and they had drifted into
 * two shapes with two paddings and two type steps, so a `single-select` column
 * and a `multi-select` column beside it disagreed about what an option looks
 * like. As with the status chip, an option's DECLARED colour still arrives as
 * an inline `style` per entry and fills its own chip — one cell holding two
 * options paints two colours, because the hue belongs to the option and not to
 * the column.
 */
export const computeArrayChipClasses = (): string =>
  [computeBadgeClasses({ variant: 'outline' }), 'max-w-full'].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// CODE — inline mono code with bg-bgSubtle
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for a code-field cell — an inline mono preview
 * of Sovrium's `code` field-type (the lang-aware editor lives in the CRUD
 * form; this is the scannable cell readout).
 *
 * Bare mono, for the reason the JSON preview gives next door: the face carries
 * the whole claim, and the fill it used to wear collided with the grid's own
 * selection well.
 */
export const computeCodeInlineClasses = (): string =>
  [
    'inline-block max-w-full truncate font-mono text-(length:--sv-density-text)',
    `text-[${v('sv-fg', T.fg)}]`,
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
  'inline-flex items-center gap-0.5 text-xs leading-none tracking-[1px]'

/**
 * Compute the className for one rating glyph. `filled` selects between full ink
 * and the strong BORDER tone — both neutral, per A7. The glyph itself also
 * differs (a solid vs a hollow shape), so the score reads without colour doing
 * any of the work.
 *
 * The empty arm is `border-strong` rather than `fg-disabled`: an unearned point
 * is the shape of the scale, not text that has been switched off, and at the
 * disabled foreground it read as a greyed-out control the reader could not use.
 */
export const computeRatingGlyphClasses = ({ filled = false }: { filled?: boolean } = {}): string =>
  filled ? `text-[${v('sv-fg', T.fg)}]` : `text-[${v('sv-border-strong', T.borderStrong)}]`

/**
 * Compute the className for the progress TRACK — the `role="progressbar"` box
 * the fill is measured against. Fixed width so a column of bars is comparable
 * at a glance, `overflow-hidden` so the fill's corners follow the track's.
 *
 * No padding and no border: the fill's width is a percentage of this box, and
 * either would make the painted proportion disagree with the stored value.
 *
 * 80px on the BORDER tone. The track is an unfilled rule, not a surface — at
 * `bg-subtle` a bar at 10% was indistinguishable from a bar at 90% on any
 * screen a reader was not leaning into, because the empty part of it painted
 * the same well as half the chrome around it.
 */
export const computeProgressTrackClasses = (): string =>
  [
    'inline-block h-1.5 w-20 max-w-full overflow-hidden align-middle',
    RADIUS_FULL,
    `bg-[${v('sv-border', T.border)}]`,
  ].join(' ')

/**
 * Compute the className for the progress FILL. The width is an inline style
 * (it is the datum), and so is the author's declared `color` when present.
 *
 * With no declared colour the fill takes `sv-primary`, which the drawings spend
 * on every filled shape in the grid — the checked checkbox, the cursor ring,
 * the fill handle — and which resolves to a near-black neutral by default, so
 * A7 ruling 5 still holds: the platform picks no hue. `fg-muted` was the wrong
 * neutral rather than the wrong idea; against the track's new border tone it
 * left barely a step between the filled part and the empty one.
 */
export const computeProgressFillClasses = (): string =>
  ['block h-full', `bg-[${v('sv-primary', T.primary)}]`].join(' ')

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
    'inline-block h-3 w-3 flex-shrink-0 border',
    RADIUS_SM,
    `border-[${v('sv-border', T.border)}]`,
  ].join(' ')

/**
 * Compute the className for the readable hex beside the swatch. Mono +
 * tabular so a column of codes aligns character for character.
 */
export const computeColorCodeClasses = (): string =>
  [
    'font-mono text-(length:--sv-density-text) tabular-nums',
    `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  ].join(' ')

/**
 * Compute the className for a barcode readout. A fixed-advance face is the
 * whole point: a column of codes is scanned by eye for a differing digit, and
 * proportional digits defeat that.
 */
export const computeBarcodeClasses = (): string =>
  ['font-mono text-(length:--sv-density-text) tabular-nums', `text-[${v('sv-fg', T.fg)}]`].join(' ')

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
 * Compute the className for ONE entry inside that wrap — the glyph and the name
 * as one unit that never breaks across a line.
 *
 * There are two arms at the call site, a file with a link and a file without,
 * and they carried the same string twice. The pair is the whole point: an entry
 * whose file has no `href` must still occupy the same box as one that does, or
 * a column of attachments changes rhythm on whichever rows happen to have lost
 * their storage key.
 */
export const computeAttachmentEntryClasses = (): string =>
  'inline-flex max-w-full items-center gap-1.5'

/**
 * Compute the className for one attachment link. Renders the file's NAME, not
 * its storage key — the key is a path the reader never chose and cannot use.
 */
export const computeAttachmentLinkClasses = (): string =>
  [
    'inline-block max-w-full truncate underline underline-offset-2',
    `text-[${v('sv-fg', T.fg)}]`,
  ].join(' ')

/**
 * Compute the className for the small page glyph that precedes an attachment's
 * name — a 14×16 outlined rectangle, the proportions of a sheet of paper.
 *
 * Drawn rather than lettered, and `aria-hidden` at its call site: it says "this
 * row of underlined words is a FILE and not a link to a page" at a glance, in a
 * column where every entry is underlined and the names alone are often
 * indistinguishable. A character glyph would have to be read, which is the work
 * it exists to save.
 */
export const computeAttachmentGlyphClasses = (): string =>
  [
    'inline-block h-4 w-3.5 shrink-0 border',
    RADIUS_SM,
    `border-[${v('sv-fg-disabled', T.fgDisabled)}]`,
    `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  ].join(' ')
