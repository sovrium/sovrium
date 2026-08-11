/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Read-only data-table cell renderers for the eight field types that had **no
 * entry** in `FIELD_TYPE_TO_CELL_RENDERER` and therefore fell through to
 * TanStack's `String(value)` default:
 *
 *   rating · progress · color · barcode · duration · checkbox ·
 *   single-attachment · multiple-attachments
 *
 * Sibling of `./cell-renderers.tsx`, which owns the reference / selection /
 * advanced field types. Split by subject rather than merged so neither file
 * carries a grab-bag of unrelated chrome.
 *
 * ## [internal ref] A7 — which of these may carry colour
 *
 * The operational test is who chose the vocabulary. Three of the eight sit on
 * that line and they do not fall the same way:
 *
 *  - **`color` — DATA, always.** The stored value IS a colour the author's own
 *    record declares. Refusing to paint it would make the field type meaningless.
 *  - **`progress` — DATA when the field declares `color`, CHROME when it does
 *    not.** An undeclared hue would be Sovrium deciding what colour "progress"
 *    is. Opt-in, not repaint (A7 ruling 5).
 *  - **`rating` — CHROME, always.** `RatingFieldSchema` carries `max` and
 *    `style` and no `color`; `style: 'stars'` selects a GLYPH, not a hue. Gold
 *    stars would be the platform inventing a vocabulary and attributing it to
 *    the author — the same mistake as a coloured Admin status pill.
 *
 * ## Ecoconception R1
 *
 * An attachment renders its filename as a link to the already-signed URL and
 * **no `<img>` at all**. `generateThumbnail` / `generateThumbnails` do NOT exist
 * in AppSchema — they are declared on no attachment schema, and a config
 * carrying them FAILS `sovrium validate`. (An earlier revision of this comment
 * asserted they were "declared and dead"; that claim was false and was cited as
 * evidence by two later audits. A comment stating a schema fact is checked by
 * nothing — verify against the schema, not against prose.) There is no
 * thumbnail pipeline either, so rendering one would render a subsystem that
 * does not exist. If images ever land here, R1 governs: AVIF,
 * `loading="lazy"`, never inline base64.
 */

import { formatDurationValue } from '@/domain/utils/duration-format'
import { isHexColor } from '@/domain/utils/option-chip-color'
import {
  computeAttachmentLinkClasses,
  computeAttachmentListClasses,
  computeBarcodeClasses,
  computeCheckboxGlyphClasses,
  computeColorCellClasses,
  computeColorCodeClasses,
  computeColorSwatchClasses,
  computeDurationClasses,
  computeProgressFillClasses,
  computeProgressTrackClasses,
  computeRatingGlyphClasses,
  computeRatingRowClasses,
} from '../recipes/cell-affordances-default-classes'
import { DEFAULT_RATING_MAX, ratingGlyphsFor, readsAsTrue } from '../shared/cell-value-semantics'
import { richTextPreview } from '../shared/rich-text-preview'
import { EMPTY_VALUE, isMissing } from './cell-empty'
import type { CellFieldOptions } from './cell-renderers'

// ──────────────────────────────────────────────────────────────────────────────
// RATING — one glyph per declared max, filled to the stored value
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Render a rating as a row of glyphs carrying its own text equivalent — a
 * screen reader must not have to count shapes to learn the score.
 */
export function RatingCell({
  value,
  fieldOptions,
}: {
  value: unknown
  fieldOptions?: CellFieldOptions
}): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const score = Number(value)
  if (Number.isNaN(score)) return EMPTY_VALUE

  const max = fieldOptions?.display?.max ?? DEFAULT_RATING_MAX
  const [filledGlyph, hollowGlyph] = ratingGlyphsFor(fieldOptions?.display?.style)

  return (
    <span
      role="img"
      aria-label={`${String(score)} out of ${String(max)}`}
      className={computeRatingRowClasses()}
    >
      {Array.from({ length: max }, (_, index) => {
        const filled = index < score
        return (
          <span
            key={`glyph-${String(index)}`}
            aria-hidden="true"
            data-rating-glyph=""
            data-filled={String(filled)}
            className={computeRatingGlyphClasses({ filled })}
          >
            {filled ? filledGlyph : hollowGlyph}
          </span>
        )
      })}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// PROGRESS — a real progressbar whose fill width tracks the stored percentage
// ──────────────────────────────────────────────────────────────────────────────

const clampPercent = (n: number): number => Math.min(100, Math.max(0, n))

/**
 * The fill's inline style: its WIDTH is the datum, and so is the author's
 * declared `color` when present. Built outside the component so the object is
 * not constructed in JSX scope on every render pass.
 */
const progressFillStyle = (percent: number, declared: string | undefined): React.CSSProperties => ({
  width: `${String(percent)}%`,
  ...(declared && isHexColor(declared) ? { backgroundColor: declared } : {}),
})

/** The swatch's inline paint — the stored hex, verbatim. */
const swatchStyle = (hex: string): React.CSSProperties => ({ backgroundColor: hex })

/**
 * Render a progress value as a bar. The fill paints the hex the FIELD declared
 * and otherwise takes a neutral token — the platform never invents a hue for an
 * author who declared none.
 */
export function ProgressCell({
  value,
  fieldOptions,
}: {
  value: unknown
  fieldOptions?: CellFieldOptions
}): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const raw = Number(value)
  if (Number.isNaN(raw)) return EMPTY_VALUE
  const percent = clampPercent(raw)

  const fillStyle = progressFillStyle(percent, fieldOptions?.display?.color)

  return (
    <span
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${String(percent)}%`}
      className={computeProgressTrackClasses()}
    >
      <span
        data-progress-fill=""
        className={computeProgressFillClasses()}
        style={fillStyle}
      />
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// COLOR — paint the stored hex, keep the code readable beside it
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Render a color value as a bordered swatch plus its code. The value is the
 * datum, so painting it must not cost the ability to read or copy it.
 */
export function ColorSwatchCell({ value }: { value: unknown }): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const code = String(value)
  if (!isHexColor(code)) return <span className={computeColorCodeClasses()}>{code}</span>

  return (
    <span className={computeColorCellClasses()}>
      <span
        data-color-swatch=""
        aria-hidden="true"
        className={computeColorSwatchClasses()}
        style={swatchStyle(code)}
      />
      <span className={computeColorCodeClasses()}>{code}</span>
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// BARCODE — fixed-advance digits, symbology exposed
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Render a barcode value in a fixed-advance face so a column of codes aligns
 * digit for digit, and surface the declared symbology so a reader can tell an
 * EAN-13 from a UPC-A without opening the config.
 */
export function BarcodeCell({
  value,
  fieldOptions,
}: {
  value: unknown
  fieldOptions?: CellFieldOptions
}): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const format = fieldOptions?.display?.format
  return (
    <span
      data-barcode=""
      {...(format ? { 'data-barcode-format': format } : {})}
      className={computeBarcodeClasses()}
    >
      {String(value)}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// DURATION — the declared preset, over a value stored in seconds
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Render a duration under its declared `displayFormat`. Postgres hands back the
 * `INTERVAL` string and SQLite the `INTEGER` count of seconds; the shared
 * formatter reads both, so the cell says the same thing on either dialect.
 */
export function DurationCell({
  value,
  fieldOptions,
}: {
  value: unknown
  fieldOptions?: CellFieldOptions
}): React.ReactNode {
  const formatted = formatDurationValue(value, fieldOptions?.display?.displayFormat)
  if (formatted === undefined) return EMPTY_VALUE
  return <span className={computeDurationClasses()}>{formatted}</span>
}

// ──────────────────────────────────────────────────────────────────────────────
// CHECKBOX — a boolean affordance from the field type alone
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Render a checkbox value as a check or a cross carrying its own accessible
 * name. Both arms are neutral: a green tick and a red cross would let colour
 * alone carry the meaning, and would be a vocabulary the `checkbox` schema
 * never declares.
 */
export function CheckboxCell({ value }: { value: unknown }): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const checked = readsAsTrue(value)
  return (
    <span
      role="img"
      aria-label={checked ? 'Yes' : 'No'}
      className={computeCheckboxGlyphClasses({ checked })}
    >
      {checked ? '✓' : '✗'}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// ATTACHMENTS — named links, never a stringified blob and never a thumbnail
// ──────────────────────────────────────────────────────────────────────────────

/**
 * One attached file as the read path enriches it: a bare storage key promoted
 * to an object carrying the URL the records API already signed.
 */
interface AttachmentEntry {
  readonly name: string
  readonly href?: string
}

/** The last path segment of a storage key — the name the uploader chose. */
const baseName = (key: string): string => {
  const segments = key.split('/').filter(Boolean)
  return segments[segments.length - 1] ?? key
}

const toAttachmentEntry = (value: unknown): AttachmentEntry | undefined => {
  if (typeof value === 'string') return value.length > 0 ? { name: baseName(value) } : undefined
  if (typeof value !== 'object' || value === null) return undefined

  const entry = value as Readonly<Record<string, unknown>>
  const pick = (...keys: readonly string[]): string | undefined =>
    keys
      .map((key) => entry[key])
      .find((candidate): candidate is string => typeof candidate === 'string' && candidate !== '')

  const label = pick('filename', 'name', 'key')
  if (label === undefined) return undefined
  const href = pick('signedUrl', 'url', 'key')
  return { name: baseName(label), ...(href !== undefined ? { href } : {}) }
}

function AttachmentLink({ entry }: { entry: AttachmentEntry }): React.ReactNode {
  if (entry.href === undefined) {
    return <span className={computeAttachmentLinkClasses()}>{entry.name}</span>
  }
  return (
    <a
      href={entry.href}
      target="_blank"
      rel="noopener noreferrer"
      className={computeAttachmentLinkClasses()}
    >
      {entry.name}
    </a>
  )
}

/**
 * Render a single attachment as a link named after the file. The records API
 * has already replaced the bare key with `{ key, signedUrl }`, so the URL this
 * needs is in hand — no new fetch, no new endpoint.
 */
export function AttachmentLinkCell({ value }: { value: unknown }): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const entry = toAttachmentEntry(value)
  if (!entry) return EMPTY_VALUE
  return <AttachmentLink entry={entry} />
}

/** Recover the array a SQLite JSON-TEXT column reads back as. */
const toAttachmentArray = (value: unknown): readonly unknown[] | undefined => {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string' || !value.trim().startsWith('[')) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

/**
 * Render every attached file as its own named link, in stored order.
 */
export function AttachmentListCell({ value }: { value: unknown }): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const items = toAttachmentArray(value)
  if (!items) return <AttachmentLinkCell value={value} />

  const entries = items
    .map(toAttachmentEntry)
    .filter((entry): entry is AttachmentEntry => entry !== undefined)
  if (entries.length === 0) return EMPTY_VALUE

  return (
    <span className={computeAttachmentListClasses()}>
      {entries.map((entry, index) => (
        <AttachmentLink
          key={`attachment-${String(index)}`}
          entry={entry}
        />
      ))}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// DATETIME — a readable instant, not the wire encoding
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Render a stored instant the way a person reads one.
 *
 * `datetime` had no entry in the renderer registry, so a cell showed the raw
 * ISO string the API sends — a machine encoding, in a grid whose editor already
 * receives the field's declared `timeZone` precisely so the two can agree about
 * which day it is.
 *
 * A value that does not parse is passed through untouched rather than replaced
 * by "Invalid Date": showing something unexpected is recoverable, and losing the
 * value is not.
 */
export function DateTimeCell({
  value,
  fieldOptions,
}: {
  value: unknown
  fieldOptions?: CellFieldOptions
}): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const parsed = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return String(value)
  const timeZone = fieldOptions?.timeZone
  return new Intl.DateTimeFormat(fieldOptions?.locale ?? 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timeZone ? { timeZone } : {}),
  }).format(parsed)
}

// ──────────────────────────────────────────────────────────────────────────────
// RICH TEXT — a plain-text preview, markup stripped
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Render a rich-text value as a plain-text preview.
 *
 * The stored body reached the cell verbatim and React escaped it, so a reader
 * saw `<p>` and `<strong>` spelled out as text. The fix is NOT to render that
 * HTML: a grid row is a dense single-line surface, block elements would break
 * row geometry, and the sibling ruling that keeps the rich-text EDITOR out of
 * the cell applies to the display side for the same reason.
 *
 * Stripping rather than injecting also keeps this cell off the
 * `dangerouslySetInnerHTML` path entirely. The records API ships the stored body
 * as authored, script tags and all, so a "just render the HTML" fix would turn a
 * display gap into stored XSS — and the canonical sanitiser is a server-side
 * concern that a grid cell has no business reaching for when it wants text.
 */
export function RichTextPreviewCell({ value }: { value: unknown }): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const text = richTextPreview(String(value))
  return text === '' ? EMPTY_VALUE : text
}
