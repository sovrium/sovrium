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

import { resolveDensityStep } from '@/domain/models/app/design/density-service'
import {
  buildConditionValueMap,
  isFieldRequired,
  isFieldVisible,
} from '@/domain/models/app/forms/form-field-helpers'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { optionLabel, optionValue } from '@/domain/models/app/tables/select-option'
import {
  nativeInputTypeOf,
  type ControlAttributeField,
} from '@/presentation/design/field-control-attributes'
import { fieldWidgetOf } from '@/presentation/design/field-type-behavior'
import { resolveTypedColumnConfig } from '@/presentation/render/elements/crud-form/crud-form-field-resolver'
import { renderInlineMarkdown } from '@/presentation/render/markdown/inline-markdown'
import type { ResolvedFormField } from './form-field-elements'
import type { App } from '@/domain/models/app'
import type { DensityStepName } from '@/domain/models/app/design'
import type { Form, FormField, SectionField, SignatureField } from '@/domain/models/app/forms'
import type { StandaloneField } from '@/domain/models/app/forms/fields/standalone'
import type { TableBoundField } from '@/domain/models/app/forms/fields/table-bound'
import type { FormOptionSets } from '@/domain/models/app/forms/form-option-source-service'
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
 * The density step a standalone form document runs at, resolved exactly as a
 * page's is — by the zone its path falls in, then the app default, then
 * `compact`. A form with no public `path` is served at `/forms/{name}`, so that
 * is the path its zone is looked up with.
 */
export function resolveFormDensityStep(
  app: Pick<App, 'design' | 'languages'>,
  form: Pick<Form, 'name' | 'path'>
): DensityStepName {
  return resolveDensityStep(
    app.design,
    form.path ?? `/forms/${form.name}`,
    app.languages?.supported.map((language) => language.code)
  )
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

/** What one render knows beyond the config: the values it is served with and the choices read for it. */
export interface FormServedState {
  readonly conditionValues?: Readonly<Record<string, unknown>>
  readonly optionSets?: FormOptionSets
}

/** The per-render inputs every field resolver reads. */
interface FieldResolutionContext {
  readonly activeLang: string | undefined
  readonly optionSets: FormOptionSets
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
  // A status column is a closed set of `{ value }` options too: drawn like a
  // single-select, led by the empty option, never as a free text box its
  // option CHECK would refuse.
  status: 'select',
  // Bug 4 / [internal ref]: user-typed columns FK to
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

/**
 * Pull `options[]` off a selection-type column (`single-select` /
 * `multi-select` / `status`) so the form renderer can emit `<option>` children.
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
  if (
    column.type !== 'single-select' &&
    column.type !== 'multi-select' &&
    column.type !== 'status'
  ) {
    return undefined
  }
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
const recordAudioOverlay = (
  recordAudio: { readonly maxDurationSeconds?: number } | undefined
): Partial<Pick<ResolvedFormField, 'recordAudioMaxSeconds'>> =>
  recordAudio === undefined
    ? {}
    : { recordAudioMaxSeconds: recordAudio.maxDurationSeconds ?? DEFAULT_RECORD_AUDIO_SECONDS }

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

/**
 * A standalone field's choices: read from a table when it names an
 * `optionsSource` (row values are data, never `$t:` keys), else its authored
 * `options` with each label localized.
 */
function standaloneOptions(
  field: Readonly<StandaloneField>,
  optionSets: FormOptionSets,
  languages: Languages | undefined,
  activeLang: string | undefined
): ResolvedFormField['options'] {
  if (field.optionsSource !== undefined) return optionSets[field.name] ?? []
  // Resolve the option label's `$t:` token against the active locale
  // ([internal ref] parity for standalone select fields); the stored `value` is
  // never localized.
  return field.options?.map((option) => ({
    value: option.value,
    label: resolveText(option.label ?? option.value, languages, option.value, activeLang),
  }))
}

const resolveStandaloneField = (
  field: Readonly<StandaloneField>,
  languages: Languages | undefined,
  activeLang: string | undefined,
  optionSets: FormOptionSets
): ResolvedFormField => {
  const inputType = inputTypeForStandalone(field.inputType)
  const options = standaloneOptions(field, optionSets, languages, activeLang)
  return {
    name: field.name,
    inputElement: inputType,
    htmlInputType: inputType,
    label: resolveText(field.label, languages, field.name, activeLang),
    placeholder: resolveText(field.placeholder, languages, '', activeLang),
    helpText: resolveText(field.helpText, languages, '', activeLang),
    required: field.required ?? false,
    hidden: field.hidden ?? false,
    ...(options !== undefined ? { options } : {}),
    ...(field.accept !== undefined ? { accept: field.accept } : {}),
    ...(field.maxFileSize !== undefined ? { maxFileSize: field.maxFileSize } : {}),
    ...(field.maxFiles !== undefined ? { maxFiles: field.maxFiles } : {}),
    ...(field.dropZone !== undefined ? { dropZone: field.dropZone } : {}),
    ...recordAudioOverlay(field.recordAudio),
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
): Partial<
  Pick<
    ResolvedFormField,
    'accept' | 'maxFileSize' | 'maxFiles' | 'dropZone' | 'recordAudioMaxSeconds'
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

/**
 * A table-bound field's choices: a relationship or user column's are the rows
 * or accounts read for this render (none when nothing was read), a selection
 * column's are its own.
 */
const tableFieldOptions = (
  field: Readonly<TableBoundField>,
  column: Readonly<Table['fields'][number]> | undefined,
  optionSets: FormOptionSets,
  locale: { readonly languages: Languages | undefined; readonly activeLang: string | undefined }
): ResolvedFormField['options'] =>
  column?.type === 'relationship' || column?.type === 'user'
    ? (optionSets[field.column] ?? [])
    : readColumnOptions(column, locale.languages, locale.activeLang)

const resolveTableField = (
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
    label: resolveText(field.label, languages, field.column, activeLang),
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

/**
 * A `kind: section` entry, resolved to an item that renders its heading and
 * description where it is declared. It carries no control, so it is never
 * submitted; its `name` is a render key only, and cannot collide with a column
 * because a column name may not begin with a dot.
 */
const resolveSectionItem = (
  field: Readonly<SectionField>,
  index: number,
  languages: Languages | undefined,
  activeLang: string | undefined
): ResolvedFormField => ({
  name: `.section-${index}`,
  inputElement: 'section',
  htmlInputType: 'section',
  label: resolveText(field.heading, languages, '', activeLang),
  placeholder: '',
  helpText: resolveText(field.description, languages, '', activeLang),
  required: false,
  hidden: false,
})

/**
 * Resolve a single FormField definition into the shape the renderer
 * needs. A section resolves to a heading item that submits nothing; a
 * calculation is skipped (returns `undefined`) — it is not a user-input field
 * and the foundation tier does not render it.
 */
function resolveField(
  field: Readonly<FormField>,
  table: Readonly<Table> | undefined,
  languages: Languages | undefined,
  context: FieldResolutionContext & { readonly index: number }
): ResolvedFormField | undefined {
  const { activeLang, optionSets } = context
  if (field.kind === 'calculation') return undefined
  if (field.kind === 'section') {
    return resolveSectionItem(field, context.index, languages, activeLang)
  }
  if (field.kind === 'signature') return resolveSignatureField(field, languages, activeLang)
  if (field.kind === 'standalone') {
    return resolveStandaloneField(field, languages, activeLang, optionSets)
  }
  return resolveTableField(field, table, languages, context)
}

/**
 * Apply a field's `visibleWhen` / `requiredWhen` to its resolved shape,
 * evaluated against the values the page is served with (the prefill, or a
 * multi-step draft) — the same helpers the submit pipeline uses, so the
 * served page and the server's judgement agree. `requiredWhen` wins over
 * `required`, as on submit. A config-`hidden` field is left alone: it has no
 * on-screen wrapper, and its rules stay with the server.
 */
function withConditionState(
  field: Readonly<FormField>,
  resolved: ResolvedFormField,
  values: Parameters<typeof isFieldVisible>[1]
): ResolvedFormField {
  if (resolved.hidden) return resolved
  const conditional = field as Parameters<typeof isFieldVisible>[0]
  const conditionHidden = !isFieldVisible(conditional, values)
  const required =
    conditional.requiredWhen !== undefined
      ? isFieldRequired(conditional, values)
      : resolved.required
  if (!conditionHidden && required === resolved.required) return resolved
  return { ...resolved, required, ...(conditionHidden ? { conditionHidden } : {}) }
}

/**
 * Resolve fields and look up the bound table for `kind: 'table-field'`.
 * Returns the rendered-shape fields ready for the React tree.
 *
 * `activeLang`, when supplied, threads the `?lang=` query parameter into
 * `$t:` resolution for each field's label/placeholder/helpText.
 *
 * `served.conditionValues` are the values the page is served with (the
 * resolved prefill, or a multi-step draft), keyed by field name. Each field's
 * `visibleWhen` / `requiredWhen` is evaluated against them so the served
 * page already carries the state the inline runtime would apply; an empty
 * map means nothing has been answered yet. `served.optionSets` are the choices
 * read from tables for this render (`resolveFormOptionSources`), keyed the same
 * way; a table-backed field with no entry offers no choices.
 */
export function resolveAllFields(
  app: Readonly<App>,
  form: Readonly<Form>,
  activeLang?: string,
  served: FormServedState = {}
): ReadonlyArray<ResolvedFormField> {
  const { conditionValues = {}, optionSets = {} } = served
  const table =
    form.submitTo.table !== undefined
      ? app.tables?.find((candidate) => candidate.name === form.submitTo.table)
      : undefined
  const values = buildConditionValueMap(form, conditionValues)
  return form.fields.flatMap((field, index) => {
    const resolved = resolveField(field, table, app.languages, { activeLang, optionSets, index })
    if (resolved === undefined) return []
    // Help text is translated first, then rendered: a `$t:` value may itself
    // carry the markdown.
    const withHelp = { ...resolved, helpTextHtml: renderInlineMarkdown(resolved.helpText) }
    return [withConditionState(field, withHelp, values)]
  })
}

/** A field together with the section items declared immediately before it. */
export interface FieldWithSections {
  readonly field: ResolvedFormField
  readonly sections: ReadonlyArray<ResolvedFormField>
}

/**
 * Attach each section item to the field declared after it. A layout that does
 * not draw every field on one page — one question per screen, one step at a
 * time — shows a section with the field it introduces; a section with no field
 * after it introduces nothing and is dropped.
 */
export function attachSectionsToNextField(
  fields: ReadonlyArray<ResolvedFormField>
): ReadonlyArray<FieldWithSections> {
  return fields.reduce<{
    readonly groups: ReadonlyArray<FieldWithSections>
    readonly pending: ReadonlyArray<ResolvedFormField>
  }>(
    (acc, field) =>
      field.inputElement === 'section'
        ? { groups: acc.groups, pending: [...acc.pending, field] }
        : { groups: [...acc.groups, { field, sections: acc.pending }], pending: [] },
    { groups: [], pending: [] }
  ).groups
}

/**
 * The items one step of a multi-step form draws: its fields, each preceded by
 * the sections that introduce it, with a section heading one level below the
 * step's own title.
 */
export function stepItems(
  fields: ReadonlyArray<ResolvedFormField>,
  stepFieldNames: ReadonlyArray<string>
): ReadonlyArray<ResolvedFormField> {
  return attachSectionsToNextField(fields)
    .filter((group) => stepFieldNames.includes(group.field.name))
    .flatMap((group) => [
      ...group.sections.map((section) => ({ ...section, sectionLevel: 3 as const })),
      group.field,
    ])
}

/**
 * Each step's description, translated FIRST and then rendered as inline
 * markdown — a `$t:` key may hold the markdown — keyed by step id.
 */
export function stepDescriptionsHtml(
  steps: NonNullable<Form['steps']>,
  languages: Languages | undefined,
  activeLang: string | undefined
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    steps.map((step) => [
      step.id,
      renderInlineMarkdown(resolveText(step.description, languages, '', activeLang)),
    ])
  )
}

export { resolveText }
