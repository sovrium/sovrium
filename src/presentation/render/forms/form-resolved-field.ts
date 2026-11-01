/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The field a form draws once it is resolved from config (its label, input
 * type, choices and upload limits), and how a prefilled value is written into
 * a control.
 */

import type { ControlAttributeField } from '@/presentation/design/field-control-attributes'

export interface ResolvedFormField {
  readonly name: string
  readonly inputElement: string
  readonly htmlInputType: string
  readonly label: string
  readonly placeholder: string
  readonly helpText: string
  /** `helpText`, `$t:` resolved, as sanitized inline markdown; `''` when there is none. */
  readonly helpTextHtml?: string
  readonly required: boolean
  readonly hidden: boolean
  /**
   * True when this field's prefilled value stays an editable starting value
   * although the host locked its inline prefill: the lock names other keys
   * (`EmbeddedFormPrefillContext.lockedKeys`).
   */
  readonly prefillEditable?: boolean
  /**
   * True when the field's `visibleWhen` is false for the values the page is
   * served with: the wrapper is served `hidden` and its controls `disabled`,
   * so it is neither shown, validated nor sent until the rule turns true.
   */
  readonly conditionHidden?: boolean
  readonly options?: ReadonlyArray<{ readonly value: string; readonly label: string }>
  /** File-upload accept attribute (MIME types or extensions). */
  readonly accept?: string
  /** Maximum file size in bytes (per file). */
  readonly maxFileSize?: number
  /** Maximum number of files for `multiple-attachments` columns. */
  readonly maxFiles?: number
  /** Whether to render a drag-and-drop zone alongside the file picker. */
  readonly dropZone?: boolean
  readonly dropZoneLabel?: string // the drop zone's prompt, in the page language
  /** Seconds a browser recording may last; present only when `recordAudio` is set. */
  readonly recordAudioMaxSeconds?: number
  /** The Record button's words in the page language; present only when `recordAudio` is set. */
  readonly recordAudioLabel?: string
  /** `user` columns: whether the picker allows several (`data-allow-multiple` on its root). */
  readonly allowMultiple?: boolean
  /**
   * The bound column's type and its typed configuration (`precision`,
   * `currency`, `symbolPosition`, `min`, `max`, `ratingStyle`), for a
   * table-bound field. It decides a number input's `step` / bounds / keypad and
   * the unit beside it, through the same `field-control-attributes` the page
   * `form` component reads — so one column is drawn alike on both.
   */
  readonly column?: ControlAttributeField
  /** For a `section` item: its heading level, `3` inside a multi-step form. */
  readonly sectionLevel?: 2 | 3
  readonly readOnly?: boolean // a `calculation`: read, never typed into
  readonly multiChoice?: boolean // a standalone `multi-select`: a set, not one choice
  readonly pickDateLabel?: string // a date's calendar button, in the page language
  readonly chooseDateLabel?: string // a date's calendar, in the page language
  readonly autocomplete?: string // the browser autofill hint, declared or derived from the type
}

/**
 * Prefill value supported by inline-create form-ref expansion.
 *
 * Scalars and homogeneous arrays cover every case the foundation tier
 * needs (multi-select inherits as `string[]`, scalar columns as
 * `string`/`number`/`boolean`). Arrays of mixed types fall back to
 * scalars per element via `String(...)` at render time.
 */
export type PrefillValue = string | number | boolean | readonly string[] | readonly number[]

/**
 * Coerce a prefill value into the string representation an HTML
 * `<input value=...>` expects. Arrays are joined with commas because the
 * foundation tier renders multi-select as a single `<input>`; a richer
 * follow-up tier can map array prefills onto multiple `<option selected>`
 * entries inside a `<select multiple>` once the renderer supports them.
 */
export function prefillValueToString(value: PrefillValue): string {
  if (Array.isArray(value)) return value.join(',')
  return String(value)
}
