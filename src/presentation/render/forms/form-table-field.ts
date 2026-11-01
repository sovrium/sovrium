/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A table-bound form field resolved to the field a form draws: its input type,
 * choices, upload and recording settings, all read from the column it writes.
 */

import { autofillHintOverlay } from '@/domain/models/app/forms/form-autofill-hint-service'
import { offeredChoices } from '@/domain/models/app/forms/form-option-subset-service'
import { optionLabel, optionValue } from '@/domain/models/app/tables/select-option'
import {
  nativeInputTypeOf,
  resolveTypedColumnConfig,
  type ControlAttributeField,
} from '@/presentation/design/field-control-attributes'
import { fieldWidgetOf } from '@/presentation/design/field-type-behavior'
import { resolveText } from './form-field-text'
import type { FieldResolutionContext } from './form-field-text'
import type { ResolvedFormField } from './form-resolved-field'
import type { TableBoundField } from '@/domain/models/app/forms/fields/table-bound'
import type { FormOptionSets } from '@/domain/models/app/forms/form-option-source-service'
import type { Languages } from '@/domain/models/app/languages'
import type { Table } from '@/domain/models/app/tables'
import type { SelectOption } from '@/domain/models/app/tables/fields/field-types/validation-utils'

/**
 * Map a table-bound field kind onto an HTML input element type. Attachment
 * columns project onto `<input type="file">`; the inline runtime upgrades them
 * with multipart upload, dropzone, file chips, and validation.
 */
const TABLE_FIELD_INPUT_TYPE_MAP: Readonly<Record<string, string>> = {
  email: 'email',
  number: 'number',
  phone: 'tel',
  url: 'url',
  date: 'date',
  datetime: 'datetime-local',
  'long-text': 'textarea',
  checkbox: 'checkbox',
  'single-attachment': 'file',
  'multiple-attachments': 'file-multi',
  // Selection columns expose a fixed `options[]` list; route them through
  // the same `<select>` element used by standalone select fields so the
  // standalone-form path renders true HTML `<option>` children (rather
  // than a plain text input) — matching the inline page-component form
  // path which already handles `single-select`/`multi-select` natively.
  'single-select': 'select',
  'multi-select': 'select',
  // A status column is a closed set of `{ value }` options too: drawn like a single-select,
  // led by the empty option, never as a free text box its option CHECK would refuse.
  status: 'select',
  // [internal ref] / the forms specs: user-typed columns FK to
  // `auth_user.id`. They render as a picker carrying the
  // `data-field-type="user"` / `data-allow-multiple` markers the spec
  // asserts, whose options are the app's accounts read on the server for a
  // signed-in visitor (`resolveFormOptionSources`).
  user: 'user',
  // A relationship column only accepts the id of a row that exists, so a free
  // text box could only ever be answered wrongly. It renders a select of the
  // related rows, read on the server when the form is served
  // (`resolveFormOptionSources`). One choice per relationship, even a
  // many-to-many one: a multi-choice picker is not part of this.
  relationship: 'select',
}

/**
 * The control a table-bound field is drawn with. The map above names the
 * columns a hosted form draws its own way; every other column takes the native
 * input type the page `form` component gives it (`nativeInputTypeOf`), so a
 * `currency` or `percentage` column is a number input on both — and a `rating`
 * column, which no plain input can hold, is its radio scale.
 */
function inputTypeForTableField(tableField: { readonly type: string }): string {
  const own = TABLE_FIELD_INPUT_TYPE_MAP[tableField.type]
  if (own !== undefined) return own
  if (fieldWidgetOf(tableField.type) === 'rating') return 'rating'
  return nativeInputTypeOf(tableField.type)
}

/**
 * A column's own control configuration (`precision`, `currency`, `min`, `max`,
 * the rating glyph…), read by the helper the page `form` component reads it with.
 */
function columnControlConfig(column: Readonly<Table['fields'][number]>): ControlAttributeField {
  return {
    type: column.type,
    ...resolveTypedColumnConfig(column.type, column as Readonly<Record<string, unknown>>),
  }
}

/** The column types whose own `options` a form draws as its choices. */
const SELECTION_COLUMN_TYPES = new Set(['single-select', 'multi-select', 'status'])

/**
 * Pull `options[]` off a selection-type column (`single-select` /
 * `multi-select` / `status`) so the form renderer can emit `<option>` children.
 * Tables accept either the bare-`string[]` or `{ value, label? }[]` form —
 * normalize both via the shared `optionValue` / `optionLabel` helpers to the
 * renderer shape, and resolve each label's `$t:` token against the active
 * locale. The stored `value` is never localized — only the
 * display label is — so switching languages never rewrites data.
 */
export function readColumnOptions(
  column: Readonly<{ readonly type?: string; readonly options?: unknown }> | undefined,
  languages: Languages | undefined,
  activeLang: string | undefined
): ReadonlyArray<{ readonly value: string; readonly label: string }> | undefined {
  if (!column) return undefined
  if (!SELECTION_COLUMN_TYPES.has(column.type ?? '')) return undefined
  const raw = column.options
  if (!Array.isArray(raw)) return undefined
  return (raw as ReadonlyArray<SelectOption>).map((entry) => {
    const value = optionValue(entry)
    return { value, label: resolveText(optionLabel(entry), languages, value, activeLang) }
  })
}

/** `recordAudio.maxDurationSeconds` when the author sets none. */
const DEFAULT_RECORD_AUDIO_SECONDS = 7200

/**
 * `recordAudio` on an attachment field: the recorder's cap in seconds, the
 * schema default (two hours) applied here so the runtime reads one number.
 */
export const recordAudioOverlay = (
  recordAudio: { readonly maxDurationSeconds?: number } | undefined
): Partial<Pick<ResolvedFormField, 'recordAudioMaxSeconds'>> =>
  recordAudio === undefined
    ? {}
    : { recordAudioMaxSeconds: recordAudio.maxDurationSeconds ?? DEFAULT_RECORD_AUDIO_SECONDS }

/**
 * Pull attachment-related props off a table column. Falls back to
 * undefined for each prop when the column is missing or doesn't declare
 * the prop.
 */
interface ColumnAttachmentProps {
  readonly accept?: string
  readonly maxFileSize?: number
  readonly maxFiles?: number
}

function readColumnAttachmentProps(
  column: Readonly<{ readonly type?: string }> | undefined
): ColumnAttachmentProps {
  if (!column) return {}
  const c = column as {
    readonly allowedFileTypes?: readonly string[]
    readonly maxFileSize?: number
    readonly maxFiles?: number
  }
  const allowed = Array.isArray(c.allowedFileTypes) ? c.allowedFileTypes : undefined
  return {
    ...(allowed && allowed.length > 0 ? { accept: allowed.join(',') } : {}),
    ...(typeof c.maxFileSize === 'number' ? { maxFileSize: c.maxFileSize } : {}),
    ...(typeof c.maxFiles === 'number' ? { maxFiles: c.maxFiles } : {}),
  }
}

/**
 * Build the optional file-upload and autofill-hint overlay for a table-bound
 * field. Form-level overrides win; column-level constraints fall through.
 */
function fileUploadOverlay(
  field: Readonly<TableBoundField>,
  column: Readonly<{ readonly type?: string }> | undefined
): Partial<
  Pick<
    ResolvedFormField,
    'accept' | 'maxFileSize' | 'maxFiles' | 'dropZone' | 'recordAudioMaxSeconds' | 'autocomplete'
  >
> {
  const columnProps = readColumnAttachmentProps(column)
  const accept = field.accept ?? columnProps.accept
  const maxFileSize = field.maxFileSize ?? columnProps.maxFileSize
  const maxFiles = field.maxFiles ?? columnProps.maxFiles
  return {
    ...(accept !== undefined ? { accept } : {}),
    ...(maxFileSize !== undefined ? { maxFileSize } : {}),
    ...(maxFiles !== undefined ? { maxFiles } : {}),
    ...(field.dropZone !== undefined ? { dropZone: field.dropZone } : {}),
    ...recordAudioOverlay(field.recordAudio),
    ...autofillHintOverlay(column?.type, field.autocomplete),
  }
}

/**
 * [internal ref] / a forms spec: surface `user.allowMultiple` so the picker can
 * render the right widget (single-select vs multi-select). Returns `undefined`
 * for non-`user` columns so the spread in `resolveTableField` omits the field
 * entirely. Extracted to keep `resolveTableField` under the complexity cap.
 */
const readUserAllowMultiple = (
  column: Readonly<Table['fields'][number]> | undefined
): boolean | undefined => {
  if (column?.type !== 'user') return undefined
  return (column as { readonly allowMultiple?: boolean }).allowMultiple === true
}

/**
 * A table-bound field's choices: a relationship or user column's are the rows or
 * accounts read for this render (none when nothing was read), a selection column's
 * its own, narrowed to the field's `options` so a withheld value never reaches the page.
 */
const tableFieldOptions = (
  field: Readonly<TableBoundField>,
  column: Readonly<Table['fields'][number]> | undefined,
  optionSets: FormOptionSets,
  { languages, activeLang }: { readonly languages?: Languages; readonly activeLang?: string }
): ResolvedFormField['options'] =>
  column?.type === 'relationship' || column?.type === 'user'
    ? (optionSets[field.column] ?? [])
    : offeredChoices(readColumnOptions(column, languages, activeLang), field.options, (label) =>
        resolveText(label, languages, label, activeLang)
      )

/**
 * The text naming a table-bound control: the form's own `label`, else the
 * column's declared `label` (either may be a `$t:` key), else nothing — the
 * caller then falls back to the column name.
 */
const tableFieldLabel = (
  field: Readonly<TableBoundField>,
  column: Readonly<Table['fields'][number]> | undefined
): string | undefined => {
  if (field.label !== undefined) return field.label
  const label = (column as { readonly label?: unknown } | undefined)?.label
  return typeof label === 'string' ? label : undefined
}

export const resolveTableField = (
  field: Readonly<TableBoundField>,
  table: Readonly<Table> | undefined,
  languages: Languages | undefined,
  context: FieldResolutionContext
): ResolvedFormField => {
  const { activeLang, optionSets } = context
  const column = table?.fields.find((tableField) => tableField.name === field.column)
  const elementType = column ? inputTypeForTableField(column) : 'text'
  const columnOptions = tableFieldOptions(field, column, optionSets, { languages, activeLang })
  const allowMultiple = readUserAllowMultiple(column)
  return {
    name: field.column,
    inputElement: elementType,
    htmlInputType: elementType,
    // The form's own label wins; otherwise the column's declared `label` (which
    // may be a `$t:` key) names the control — the name the reader knows the
    // field by elsewhere — and only a column declaring none falls back to its name.
    label: resolveText(tableFieldLabel(field, column), languages, field.column, activeLang),
    placeholder: resolveText(field.placeholder, languages, '', activeLang),
    helpText: resolveText(field.helpText, languages, '', activeLang),
    required: field.required ?? column?.required ?? false,
    hidden: field.hidden ?? false,
    ...(columnOptions ? { options: columnOptions } : {}),
    ...(allowMultiple !== undefined ? { allowMultiple } : {}),
    ...(column ? { column: columnControlConfig(column) } : {}),
    ...fileUploadOverlay(field, column),
  }
}
