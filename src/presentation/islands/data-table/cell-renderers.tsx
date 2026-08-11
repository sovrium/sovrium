/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Read-only data-table cell renderers for field-types that have no
 * implicit `column.format` literal ([internal ref], Phase 4 slice 3).
 *
 * TanStack Table's default `String(value)` passthrough produces unusable
 * cells for these 9 field-types:
 *   - user / created-by / updated-by / deleted-by  → raw user-id text
 *   - relationship / lookup / rollup               → raw foreign-id text
 *   - status                                       → raw option value (no color)
 *   - formula                                      → raw computed value (no kind awareness)
 *   - geolocation                                  → raw "{lat,lng}" object
 *   - count                                        → raw integer text
 *   - json                                         → "[object Object]" or huge stringified blob
 *   - array                                        → comma-separated raw string
 *   - code                                         → unformatted text in proportional font
 *
 * Each renderer here owns the *chrome* — the visual identity of the
 * field-type (avatar pill, status pill, mono code chip, etc.) — and threads
 * its className through `cell-affordances-default-classes.ts` so a tenant
 * override of `app.theme.*` still wins. The renderers are deliberately
 * minimal pure-presentation components: they receive a value and an optional
 * options blob, return SSR-safe JSX, and never read window / document /
 * fetch / mutation hooks.
 *
 * The field-type → renderer dispatch map lives in `./cell-renderer-registry.ts`
 * (separate file so this module exports React components only, satisfying the
 * fast-refresh `only-export-components` rule).
 */

import { deriveOptionChipColors } from '@/domain/utils/option-chip-color'
import { optionColor, optionValue, type SelectOptionLike } from '@/domain/utils/select-option'
import {
  computeArrayChipClasses,
  computeArrayChipsWrapClasses,
  computeCodeInlineClasses,
  computeCountBadgeClasses,
  computeFormulaReadonlyClasses,
  computeGeolocationClasses,
  computeGeolocationCoordClasses,
  computeGeolocationPinClasses,
  computeJsonPreviewClasses,
  computeLinkedRecordPillClasses,
  computeLinkedRecordWrapClasses,
  computeStatusPillClasses,
  computeUserAvatarClasses,
  computeUserNameClasses,
  computeUserPillClasses,
} from '../recipes/cell-affordances-default-classes'
import { readsAsList } from '../shared/cell-value-semantics'
import { EMPTY_VALUE, isMissing } from './cell-empty'
import type { FieldDisplayMeta } from '../hooks/use-inline-editing'

// ──────────────────────────────────────────────────────────────────────────────
// Shared types
// ──────────────────────────────────────────────────────────────────────────────

/** Field options blob passed from the column-def builder per cell. */
export interface CellFieldOptions {
  /**
   * The options the app author declared on this field, exactly as authored —
   * bare strings or `{ value, label?, color? }` objects. Shared by all three
   * selection field-types (`status`, `single-select`, `multi-select`), which
   * agree on one option grammar.
   */
  readonly selectOptions?: readonly SelectOptionLike[]
  /** When the schema knows the formula's return kind (typed formulas). */
  readonly formulaKind?: 'number' | 'text' | 'date' | 'error'
  /**
   * The field's declared DISPLAY properties — `rating.max`, `rating.style`,
   * `progress.color`, `barcode.format`, `duration.displayFormat` and the
   * currency treatment. These used to be dropped at
   * `type-specific-props-builder.ts`, which built `dataTableFieldMeta` as
   * exactly `{ type, options?, required? }`; widening that struct is the one
   * change that let most of the scalar renderers exist at all.
   */
  readonly display?: FieldDisplayMeta
  /**
   * The active page locale, so a cell that formats an instant reads the same
   * way as the rest of the page rather than the browser's own default.
   */
  readonly locale?: string
  /**
   * The zone an instant is resolved into, forwarded from the field's declared
   * `timeZone`. The editor already receives it; a read-only cell that ignored
   * it would show one calendar day and open on another.
   */
  readonly timeZone?: string
}

/**
 * Resolve the chip paint for one rendered value against the field's declared
 * options.
 *
 * Returns `undefined` when the value matches no option, or matches one that
 * declared no `color` — in which case the caller renders its existing default
 * chrome untouched. An opt-in never invents a hue for an author who did not ask
 * for one ([[internal ref] A7](../../../../docs/architecture/decisions/024-restraint-as-the-design-default.md)
 * ruling 5).
 */
function resolveChipPaint(
  display: string,
  options: readonly SelectOptionLike[] | undefined
): React.CSSProperties | undefined {
  const match = options?.find((option) => optionValue(option) === display)
  const declared = match ? optionColor(match) : undefined
  if (declared === undefined) return undefined

  const derived = deriveOptionChipColors(declared)
  if (!derived) return undefined

  // The declared hue is the FILL and never the text (ruling 4): `darkColors` is
  // inert, so one hex is the author's whole vocabulary and a hue used as text
  // would be unreadable on one of the two surfaces. Inline styles carry the
  // pair, so the chip reads identically in light and dark mode.
  return {
    backgroundColor: derived.fill,
    color: derived.foreground,
    border: `1px solid ${derived.border}`,
  }
}

/** Common renderer signature consumed by the dispatch map. */
export type CellRenderer = (props: {
  value: unknown
  fieldOptions?: CellFieldOptions
}) => React.ReactNode

// ──────────────────────────────────────────────────────────────────────────────
// USER pill (user-field + created-by / updated-by / deleted-by aliases)
// ──────────────────────────────────────────────────────────────────────────────

const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase()
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase()
}

/**
 * Render a user reference as an avatar pill. `value` is the user-id or a
 * display name string (the consumer hydrates the id → name elsewhere; this
 * renderer paints whichever string lands in the cell). Falls back to the
 * em-dash placeholder for null / undefined.
 */
export function UserPillCell({ value }: { value: unknown }): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const display = String(value)
  return (
    <span className={computeUserPillClasses()}>
      <span
        aria-hidden="true"
        className={computeUserAvatarClasses()}
      >
        {initialsOf(display)}
      </span>
      <span className={computeUserNameClasses()}>{display}</span>
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// LINKED RECORD pill (relationship / lookup / rollup)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Render a linked-record value (relationship / lookup / rollup). If the cell
 * value is an array (lookup / rollup that resolved to many records), wrap a
 * row of pills; if scalar, render a single pill.
 *
 * Each pill carries `data-linked-record` so one link and several can be told
 * apart without parsing the cell's text: a renderer that joined every related
 * row into a single pill would still contain all the right words.
 */
export function LinkedRecordPillCell({ value }: { value: unknown }): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE

  if (Array.isArray(value)) {
    if (value.length === 0) return EMPTY_VALUE
    return (
      <span className={computeLinkedRecordWrapClasses()}>
        {value.map((entry, i) => (
          <span
            key={`linked-${String(i)}`}
            className={computeLinkedRecordPillClasses()}
            data-linked-record=""
          >
            {String(entry)}
          </span>
        ))}
      </span>
    )
  }

  return (
    <span
      className={computeLinkedRecordPillClasses()}
      data-linked-record=""
    >
      {String(value)}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// STATUS pill (colored bg per option, schema-driven)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Render a `status` or `single-select` value as a pill.
 *
 * Both field-types dispatch here because they are the same thing on screen —
 * one value chosen from a declared option list — and since the three selection
 * types converged on one option grammar there is nothing left to tell apart.
 *
 * When the matching option declares a `color`, the pill paints that hex as its
 * fill and carries the foreground and border the platform derived from it. When
 * it declares none, the neutral chrome renders exactly as it did before colour
 * existed.
 *
 * The pill shows the stored VALUE rather than the option's `label`: the label
 * may be a `$t:` translation key, and the island has no catalog to resolve it
 * against (the server-rendered form path does, via `form-field-resolver.ts`).
 * Painting a raw `$t:` key into a grid cell would be worse than not translating.
 */
export function StatusPillCell({
  value,
  fieldOptions,
}: {
  value: unknown
  fieldOptions?: CellFieldOptions
}): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE

  const display = String(value)
  const paint = resolveChipPaint(display, fieldOptions?.selectOptions)

  return (
    <span
      className={computeStatusPillClasses()}
      style={paint}
    >
      {display}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// FORMULA read-only (kind-dispatched)
// ──────────────────────────────────────────────────────────────────────────────

const detectFormulaKind = (
  value: unknown,
  declared: CellFieldOptions['formulaKind']
): 'number' | 'text' | 'date' | 'error' => {
  if (declared) return declared
  if (typeof value === 'string' && value.startsWith('#') && value.endsWith('!')) return 'error'
  if (typeof value === 'number' || (typeof value === 'string' && !Number.isNaN(Number(value))))
    return 'number'
  if (value instanceof Date) return 'date'
  return 'text'
}

/**
 * Render a formula-field readout. Kind comes from the schema if declared,
 * else inferred from the value shape (numeric / error sigil / Date / else).
 */
export function FormulaReadonlyCell({
  value,
  fieldOptions,
}: {
  value: unknown
  fieldOptions?: CellFieldOptions
}): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const kind = detectFormulaKind(value, fieldOptions?.formulaKind)
  const display = value instanceof Date ? value.toLocaleDateString() : String(value)
  return <span className={computeFormulaReadonlyClasses({ kind })}>{display}</span>
}

// ──────────────────────────────────────────────────────────────────────────────
// GEOLOCATION (pin + lat,lng)
// ──────────────────────────────────────────────────────────────────────────────

interface LatLng {
  readonly lat: number
  readonly lng: number
}

const parseObjectGeoloc = (obj: Record<string, unknown>): LatLng | undefined => {
  const lat = typeof obj['lat'] === 'number' ? obj['lat'] : Number(obj['lat'])
  const lng = typeof obj['lng'] === 'number' ? obj['lng'] : Number(obj['lng'])
  if (Number.isNaN(lat) || Number.isNaN(lng)) return undefined
  return { lat, lng }
}

const parseStringGeoloc = (s: string): LatLng | undefined => {
  const parts = s.split(',').map((p) => Number(p.trim()))
  if (parts.length !== 2) return undefined
  const [lat, lng] = parts
  if (lat === undefined || lng === undefined) return undefined
  if (Number.isNaN(lat) || Number.isNaN(lng)) return undefined
  return { lat, lng }
}

const parseGeoloc = (value: unknown): LatLng | undefined => {
  if (isMissing(value)) return undefined
  if (typeof value === 'object') return parseObjectGeoloc(value as Record<string, unknown>)
  if (typeof value === 'string') return parseStringGeoloc(value)
  return undefined
}

/**
 * Render a geolocation cell as a bordered chip: pin glyph + "lat, lng" pair
 * formatted to 4 decimals in mono / tabular-nums so a column of coords
 * aligns at the decimal point.
 */
export function GeolocationCell({ value }: { value: unknown }): React.ReactNode {
  const coords = parseGeoloc(value)
  if (!coords) return EMPTY_VALUE
  return (
    <span className={computeGeolocationClasses()}>
      <span
        aria-hidden="true"
        className={computeGeolocationPinClasses()}
      >
        ◉
      </span>
      <span className={computeGeolocationCoordClasses()}>
        {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
      </span>
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// COUNT badge
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Render a count-field value as a small numeric badge. Coerces the value to
 * a number first; non-numeric values fall through to the em-dash.
 */
export function CountBadgeCell({ value }: { value: unknown }): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return EMPTY_VALUE
  return <span className={computeCountBadgeClasses()}>{num}</span>
}

// ──────────────────────────────────────────────────────────────────────────────
// JSON preview
// ──────────────────────────────────────────────────────────────────────────────

const previewJson = (value: unknown): string => {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Render a json-field value as a single-line mono preview. Stringifies the
 * value (or uses the value as-is if already a string) and truncates via CSS
 * `truncate` so a large JSON blob collapses to ellipsis.
 */
export function JsonPreviewCell({ value }: { value: unknown }): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  return <span className={computeJsonPreviewClasses()}>{previewJson(value)}</span>
}

// ──────────────────────────────────────────────────────────────────────────────
// ARRAY chips
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Render an array-valued cell as a wrap of small chips — the `array` field-type,
 * and `multi-select`, which is an array of declared options. Accepts a real
 * array, a JSON-encoded array string, or a comma-separated string; falls through
 * to the em-dash when nothing readable survives.
 *
 * The shape decoding is {@link readsAsList}, shared with the multi-select
 * editor that opens over this very cell. It used to be a private copy here, and
 * the copy dropped empty comma segments while the editor's did not — so `'a,,b'`
 * rendered two chips, seeded the editor with three, and committed an `''` that
 * PostgreSQL rejected against the per-entry membership CHECK.
 *
 * Each chip resolves its own paint, so a cell holding two options paints two
 * colours: the colour belongs to the option, not to the column. An `array`
 * field carries no options and every chip keeps the default chrome.
 */
export function ArrayChipsCell({
  value,
  fieldOptions,
}: {
  value: unknown
  fieldOptions?: CellFieldOptions
}): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const items = readsAsList(value)
  if (items.length === 0) return EMPTY_VALUE
  return (
    <span className={computeArrayChipsWrapClasses()}>
      {items.map((item, i) => (
        <span
          key={`chip-${String(i)}`}
          className={computeArrayChipClasses()}
          style={resolveChipPaint(item, fieldOptions?.selectOptions)}
        >
          {item}
        </span>
      ))}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// CODE inline
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Render a code-field value as an inline mono code chip. Single-line preview
 * — the full lang-aware editor lives in the CRUD form; this is just the
 * scannable cell readout.
 */
export function CodeInlineCell({ value }: { value: unknown }): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  return <code className={computeCodeInlineClasses()}>{String(value)}</code>
}
