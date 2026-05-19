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

function resolveText(
  value: string | undefined,
  languages: Languages | undefined,
  fallback: string
): string {
  if (value === undefined) return fallback
  if (languages === undefined) return value
  return resolveTranslationPattern(value, languages.default, languages)
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
}

function inputTypeForTableField(tableField: { readonly type: string }): string {
  return TABLE_FIELD_INPUT_TYPE_MAP[tableField.type] ?? 'text'
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
  languages: Languages | undefined
): ResolvedFormField => ({
  name: field.name,
  inputElement: 'signature',
  htmlInputType: 'signature',
  label: resolveText(field.label, languages, field.name),
  placeholder: resolveText(field.placeholder, languages, ''),
  helpText: resolveText(field.helpText, languages, ''),
  required: field.required ?? false,
  hidden: field.hidden ?? false,
})

const resolveStandaloneField = (
  field: Readonly<StandaloneField>,
  languages: Languages | undefined
): ResolvedFormField => {
  const inputType = inputTypeForStandalone(field.inputType)
  return {
    name: field.name,
    inputElement: inputType,
    htmlInputType: inputType,
    label: resolveText(field.label, languages, field.name),
    placeholder: resolveText(field.placeholder, languages, ''),
    helpText: resolveText(field.helpText, languages, ''),
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

const resolveTableField = (
  field: Readonly<TableBoundField>,
  table: Readonly<Table> | undefined,
  languages: Languages | undefined
): ResolvedFormField => {
  const column = table?.fields.find((tableField) => tableField.name === field.column)
  const elementType = column ? inputTypeForTableField(column) : 'text'
  return {
    name: field.column,
    inputElement: elementType,
    htmlInputType: elementType,
    label: resolveText(field.label, languages, field.column),
    placeholder: resolveText(field.placeholder, languages, ''),
    helpText: resolveText(field.helpText, languages, ''),
    required: field.required ?? column?.required ?? false,
    hidden: field.hidden ?? false,
    ...fileUploadOverlay(field, column),
  }
}

function resolveField(
  field: Readonly<FormField>,
  table: Readonly<Table> | undefined,
  languages: Languages | undefined
): ResolvedFormField | undefined {
  if (field.kind === 'section' || field.kind === 'calculation') return undefined
  if (field.kind === 'signature') return resolveSignatureField(field, languages)
  if (field.kind === 'standalone') return resolveStandaloneField(field, languages)
  return resolveTableField(field, table, languages)
}

export function resolveAllFields(
  app: Readonly<App>,
  form: Readonly<Form>
): ReadonlyArray<ResolvedFormField> {
  const table =
    form.submitTo.table !== undefined
      ? app.tables?.find((candidate) => candidate.name === form.submitTo.table)
      : undefined
  return form.fields
    .map((field) => resolveField(field, table, app.languages))
    .filter((field): field is ResolvedFormField => field !== undefined)
}

export { resolveText }
