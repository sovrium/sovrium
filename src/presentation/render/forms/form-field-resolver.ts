/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Field resolution pipeline shared by `form-renderer.tsx`. Walks each
 * `Form['fields']` entry and produces the `ResolvedFormField` shape
 * consumed by the per-field React components in
 * `./form-field-elements.tsx`. Sliced out of `form-renderer.tsx` so the
 * orchestration file (FormHead / FormBody / FormPage) stays under the
 * project's max-lines cap.
 */

import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { optionLabel, optionValue } from '@/domain/models/app/tables/select-option'
import type { ResolvedFormField } from './form-field-elements'
import type { App } from '@/domain/models/app'
import type { Form, FormField, SignatureField } from '@/domain/models/app/forms'
import type { StandaloneField } from '@/domain/models/app/forms/fields/standalone'
import type { TableBoundField } from '@/domain/models/app/forms/fields/table-bound'
import type { Languages } from '@/domain/models/app/languages'
import type { Table } from '@/domain/models/app/tables'
import type { SelectOption } from '@/domain/models/app/tables/fields/field-types/validation-utils'

/**
 * Resolve the active language for `$t:` resolution.
 *
 * The requested language (e.g. `?lang=fr`) wins when it is one of the
 * app's `supported` codes. Otherwise the renderer immediately collapses to
 * `fallback ?? default` so an unsupported `?lang=de`
 * resolves against the catalog rather than emitting raw `$t:` literals.
 * The downstream `resolveTranslationPattern` still applies its own
 * active → fallback → literal chain for missing keys.
 */
function resolveActiveLang(languages: Languages, requestedLang: string | undefined): string {
  if (requestedLang === undefined || requestedLang === '') {
    return languages.default
  }
  const supported = languages.supported ?? []
  const isSupported = supported.some(
    (entry) => entry.code === requestedLang || entry.locale === requestedLang
  )
  if (isSupported) return requestedLang
  return languages.fallback ?? languages.default
}

/**
 * Resolve the document `lang` attribute. Falls back to `'en'` when no
 * `languages` block is configured; otherwise reuses the same active-language
 * resolution as `$t:` (requested wins when supported, else fallback ?? default).
 */
export function resolveDocumentLang(languages: Languages | undefined, activeLang?: string): string {
  if (!languages) return 'en'
  return resolveActiveLang(languages, activeLang)
}

/**
 * Resolve a `$t:key` literal (or pass-through plain string) using the
 * app's `languages` configuration. When `languages` is undefined, returns
 * the input unchanged.
 *
 * `activeLang`, when supplied, selects the catalog language (typically the
 * `?lang=` query parameter). It falls back to `languages.default` when
 * omitted, preserving the legacy single-language behaviour.
 */
function resolveText(
  value: string | undefined,
  languages: Languages | undefined,
  fallback: string,
  activeLang?: string
): string {
  if (value === undefined) return fallback
  if (languages === undefined) return value
  const lang = resolveActiveLang(languages, activeLang)
  return resolveTranslationPattern(value, lang, languages)
}

/**
 * Map a table-bound field kind onto an HTML input element type.
 *
 * Attachment columns (`single-attachment` / `multiple-attachments`)
 * project onto a `<input type="file">` element; the inline runtime
 * upgrades them with multipart upload, dropzone, file chips, and
 * validation.
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
  // Bug 4 / [internal ref]: user-typed columns FK to
  // `auth_user.id`. They render as a picker (combobox over the user
  // directory) carrying the `data-field-type="user"` / `data-allow-multiple`
  // markers the spec asserts. The UserInput SSR component (in
  // form-field-elements.tsx) emits the picker; the inline runtime
  // upgrades it with a fetch-backed combobox.
  user: 'user',
}

function inputTypeForTableField(tableField: { readonly type: string }): string {
  return TABLE_FIELD_INPUT_TYPE_MAP[tableField.type] ?? 'text'
}

/**
 * Pull `options[]` off a selection-type column (`single-select` /
 * `multi-select`) so the form renderer can emit `<option>` children.
 * Tables accept either the bare-`string[]` or `{ value, label? }[]` form —
 * normalize both via the shared `optionValue` / `optionLabel` helpers to the
 * renderer shape, and resolve each label's `$t:` token against the active
 * locale. The stored `value` is never localized — only the
 * display label is — so switching languages never rewrites data.
 */
function readColumnOptions(
  column: Readonly<{ readonly type?: string; readonly options?: unknown }> | undefined,
  languages: Languages | undefined,
  activeLang: string | undefined
): ReadonlyArray<{ readonly value: string; readonly label: string }> | undefined {
  if (!column) return undefined
  if (column.type !== 'single-select' && column.type !== 'multi-select') return undefined
  const raw = column.options
  if (!Array.isArray(raw)) return undefined
  return (raw as ReadonlyArray<SelectOption>).map((entry) => {
    const value = optionValue(entry)
    return { value, label: resolveText(optionLabel(entry), languages, value, activeLang) }
  })
}

/**
 * Map a standalone field's `inputType` onto an HTML input element type.
 */
function inputTypeForStandalone(inputType: string): string {
  switch (inputType) {
    case 'long-text':
      return 'textarea'
    case 'short-text':
      return 'text'
    case 'select':
    case 'multi-select':
      return 'select'
    case 'rating':
      return 'number'
    case 'checkbox':
      return 'checkbox'
    case 'radio':
      return 'radio'
    default:
      return inputType
  }
}

const resolveSignatureField = (
  field: Readonly<SignatureField>,
  languages: Languages | undefined,
  activeLang?: string
): ResolvedFormField => ({
  name: field.name,
  inputElement: 'signature',
  htmlInputType: 'signature',
  label: resolveText(field.label, languages, field.name, activeLang),
  placeholder: resolveText(field.placeholder, languages, '', activeLang),
  helpText: resolveText(field.helpText, languages, '', activeLang),
  required: field.required ?? false,
  hidden: field.hidden ?? false,
})

const resolveStandaloneField = (
  field: Readonly<StandaloneField>,
  languages: Languages | undefined,
  activeLang?: string
): ResolvedFormField => {
  const inputType = inputTypeForStandalone(field.inputType)
  return {
    name: field.name,
    inputElement: inputType,
    htmlInputType: inputType,
    label: resolveText(field.label, languages, field.name, activeLang),
    placeholder: resolveText(field.placeholder, languages, '', activeLang),
    helpText: resolveText(field.helpText, languages, '', activeLang),
    required: field.required ?? false,
    hidden: field.hidden ?? false,
    ...(field.options
      ? {
          options: field.options.map((option) => ({
            value: option.value,
            // Resolve the option label's `$t:` token against the active locale
            // ([internal ref] parity for standalone select fields); the stored
            // `value` is never localized.
            label: resolveText(option.label ?? option.value, languages, option.value, activeLang),
          })),
        }
      : {}),
    ...(field.accept !== undefined ? { accept: field.accept } : {}),
    ...(field.maxFileSize !== undefined ? { maxFileSize: field.maxFileSize } : {}),
    ...(field.maxFiles !== undefined ? { maxFiles: field.maxFiles } : {}),
    ...(field.dropZone !== undefined ? { dropZone: field.dropZone } : {}),
  }
}

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
 * Build the optional file-upload prop overlay for a table-bound field.
 * Form-level overrides win; column-level constraints fall through.
 */
function fileUploadOverlay(
  field: Readonly<TableBoundField>,
  column: Readonly<{ readonly type?: string }> | undefined
): Partial<Pick<ResolvedFormField, 'accept' | 'maxFileSize' | 'maxFiles' | 'dropZone'>> {
  const columnProps = readColumnAttachmentProps(column)
  const accept = field.accept ?? columnProps.accept
  const maxFileSize = field.maxFileSize ?? columnProps.maxFileSize
  const maxFiles = field.maxFiles ?? columnProps.maxFiles
  return {
    ...(accept !== undefined ? { accept } : {}),
    ...(maxFileSize !== undefined ? { maxFileSize } : {}),
    ...(maxFiles !== undefined ? { maxFiles } : {}),
    ...(field.dropZone !== undefined ? { dropZone: field.dropZone } : {}),
  }
}

/**
 * Bug 4 / [internal ref]: surface `user.allowMultiple` so the picker can
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

const resolveTableField = (
  field: Readonly<TableBoundField>,
  table: Readonly<Table> | undefined,
  languages: Languages | undefined,
  activeLang?: string
): ResolvedFormField => {
  const column = table?.fields.find((tableField) => tableField.name === field.column)
  const elementType = column ? inputTypeForTableField(column) : 'text'
  const columnOptions = readColumnOptions(column, languages, activeLang)
  const allowMultiple = readUserAllowMultiple(column)
  return {
    name: field.column,
    inputElement: elementType,
    htmlInputType: elementType,
    label: resolveText(field.label, languages, field.column, activeLang),
    placeholder: resolveText(field.placeholder, languages, '', activeLang),
    helpText: resolveText(field.helpText, languages, '', activeLang),
    required: field.required ?? column?.required ?? false,
    hidden: field.hidden ?? false,
    ...(columnOptions ? { options: columnOptions } : {}),
    ...(allowMultiple !== undefined ? { allowMultiple } : {}),
    ...fileUploadOverlay(field, column),
  }
}

/**
 * Resolve a single FormField definition into the shape the renderer
 * needs. Sections and calculations are skipped (return `undefined`) —
 * they are not user-input fields and the foundation tier does not render
 * them.
 */
function resolveField(
  field: Readonly<FormField>,
  table: Readonly<Table> | undefined,
  languages: Languages | undefined,
  activeLang?: string
): ResolvedFormField | undefined {
  if (field.kind === 'section' || field.kind === 'calculation') return undefined
  if (field.kind === 'signature') return resolveSignatureField(field, languages, activeLang)
  if (field.kind === 'standalone') return resolveStandaloneField(field, languages, activeLang)
  return resolveTableField(field, table, languages, activeLang)
}

/**
 * Resolve fields and look up the bound table for `kind: 'table-field'`.
 * Returns the rendered-shape fields ready for the React tree.
 *
 * `activeLang`, when supplied, threads the `?lang=` query parameter into
 * `$t:` resolution for each field's label/placeholder/helpText.
 */
export function resolveAllFields(
  app: Readonly<App>,
  form: Readonly<Form>,
  activeLang?: string
): ReadonlyArray<ResolvedFormField> {
  const table =
    form.submitTo.table !== undefined
      ? app.tables?.find((candidate) => candidate.name === form.submitTo.table)
      : undefined
  return form.fields
    .map((field) => resolveField(field, table, app.languages, activeLang))
    .filter((field): field is ResolvedFormField => field !== undefined)
}

export { resolveText }
