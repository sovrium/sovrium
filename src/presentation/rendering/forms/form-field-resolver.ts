/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { resolveTranslationPattern } from '@/domain/utils/translation-resolver'
import type { ResolvedFormField } from './form-field-elements'
import type { App } from '@/domain/models/app'
import type { Form, FormField, SignatureField } from '@/domain/models/app/forms'
import type { StandaloneField } from '@/domain/models/app/forms/fields/standalone'
import type { TableBoundField } from '@/domain/models/app/forms/fields/table-bound'
import type { Languages } from '@/domain/models/app/languages'
import type { Table } from '@/domain/models/app/tables'

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

export function resolveDocumentLang(languages: Languages | undefined, activeLang?: string): string {
  if (!languages) return 'en'
  return resolveActiveLang(languages, activeLang)
}

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
  'single-select': 'select',
  'multi-select': 'select',
  user: 'user',
}

function inputTypeForTableField(tableField: { readonly type: string }): string {
  return TABLE_FIELD_INPUT_TYPE_MAP[tableField.type] ?? 'text'
}

function readColumnOptions(
  column: Readonly<{ readonly type?: string; readonly options?: unknown }> | undefined
): ReadonlyArray<{ readonly value: string; readonly label: string }> | undefined {
  if (!column) return undefined
  if (column.type !== 'single-select' && column.type !== 'multi-select') return undefined
  const raw = column.options
  if (!Array.isArray(raw)) return undefined
  return raw.map((entry) => {
    if (typeof entry === 'string') return { value: entry, label: entry }
    if (typeof entry === 'object' && entry !== null) {
      const obj = entry as { readonly value?: unknown; readonly label?: unknown }
      const value = typeof obj.value === 'string' ? obj.value : String(obj.value ?? '')
      const label = typeof obj.label === 'string' ? obj.label : value
      return { value, label }
    }
    return { value: String(entry), label: String(entry) }
  })
}

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
            label: option.label ?? option.value,
          })),
        }
      : {}),
    ...(field.accept !== undefined ? { accept: field.accept } : {}),
    ...(field.maxFileSize !== undefined ? { maxFileSize: field.maxFileSize } : {}),
    ...(field.maxFiles !== undefined ? { maxFiles: field.maxFiles } : {}),
    ...(field.dropZone !== undefined ? { dropZone: field.dropZone } : {}),
  }
}

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
  const columnOptions = readColumnOptions(column)
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
