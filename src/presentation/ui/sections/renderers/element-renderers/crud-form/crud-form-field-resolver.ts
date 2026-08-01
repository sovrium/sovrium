/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { showsDeclaredDefault } from '@/presentation/utils/field-type-behavior'
import { humanizeFieldName } from '@/presentation/utils/string-utils'
import type { ResolvedFieldDef } from './crud-form-renderer'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Component } from '@/domain/models/app/pages/components'
import type { FormFieldConfig } from '@/domain/models/app/pages/components/component-types/data/form'
import type { Tables } from '@/domain/models/app/tables'
import type { FieldType } from '@/domain/models/app/tables/fields'

function normalizeOptions(raw: unknown): readonly string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw
    .map((entry) => {
      if (typeof entry === 'string') return entry
      if (typeof entry === 'object' && entry !== null) {
        const { value } = entry as Record<string, unknown>
        return typeof value === 'string' ? value : undefined
      }
      return undefined
    })
    .filter((value): value is string => value !== undefined)
}

function declaredDefaultOf(
  tableField: { readonly type: string },
  fieldType: string
): string | number | boolean | undefined {
  if (!showsDeclaredDefault(fieldType)) return undefined
  const value = (tableField as unknown as Record<string, unknown>)['default']
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  return undefined
}

const ATTACHMENT_FIELD_TYPES: ReadonlySet<string> = new Set([
  'single-attachment',
  'multiple-attachments',
])

type FieldTypePassthrough = {
  readonly placeholder?: string
  readonly maxLength?: number
  readonly toolbar?: readonly string[]
  readonly language?: string
  readonly lineNumbers?: boolean
  readonly tabSize?: number
  readonly minLines?: number
  readonly maxLines?: number
}

function extractFieldTypePassthrough(tableField: unknown): FieldTypePassthrough {
  const f = tableField as Record<string, unknown>
  return {
    placeholder: typeof f['placeholder'] === 'string' ? (f['placeholder'] as string) : undefined,
    maxLength: typeof f['maxLength'] === 'number' ? (f['maxLength'] as number) : undefined,
    toolbar: Array.isArray(f['toolbar']) ? (f['toolbar'] as readonly string[]) : undefined,
    language: typeof f['language'] === 'string' ? (f['language'] as string) : undefined,
    lineNumbers: typeof f['lineNumbers'] === 'boolean' ? (f['lineNumbers'] as boolean) : undefined,
    tabSize: typeof f['tabSize'] === 'number' ? (f['tabSize'] as number) : undefined,
    minLines: typeof f['minLines'] === 'number' ? (f['minLines'] as number) : undefined,
    maxLines: typeof f['maxLines'] === 'number' ? (f['maxLines'] as number) : undefined,
  }
}

function resolveCfgOverrides(cfg: FormFieldConfig, fallbackLabel: string) {
  return {
    displayLabel: cfg.label ?? fallbackLabel,
    placeholder: cfg.placeholder,
    readOnly: cfg.readOnly,
    disabled: cfg.disabled,
    ...(cfg.defaultValue !== undefined && { defaultValue: cfg.defaultValue }),
    hidden: cfg.hidden,
    visibleWhen: cfg.visibleWhen,
    requiredWhen: cfg.requiredWhen,
    disabledWhen: cfg.disabledWhen,
    accept: cfg.accept,
    dropZone: cfg.dropZone,
    maxFiles: cfg.maxFiles,
  }
}

function resolveAttachmentBucket(
  fieldType: string,
  tf: Readonly<Record<string, unknown>>
): string | undefined {
  if (!ATTACHMENT_FIELD_TYPES.has(fieldType)) return undefined
  const { bucket } = tf
  return typeof bucket === 'string' && bucket.length > 0 ? bucket : undefined
}

function resolveMaxFileSize(tf: Readonly<Record<string, unknown>>): number | undefined {
  return typeof tf['maxFileSize'] === 'number' ? (tf['maxFileSize'] as number) : undefined
}

function resolveAllowedFileTypes(
  tf: Readonly<Record<string, unknown>>
): readonly string[] | undefined {
  const value = tf['allowedFileTypes']
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
    ? (value as readonly string[])
    : undefined
}

function resolveButtonConfig(
  fieldType: string,
  tf: Record<string, unknown>
): Record<string, unknown> {
  if (fieldType !== 'button') return {}
  return {
    button: {
      label: tf['label'],
      action: tf['action'],
      ...(tf['url'] === undefined ? {} : { url: tf['url'] }),
      ...(tf['automation'] === undefined ? {} : { automation: tf['automation'] }),
      ...(tf['visibleWhen'] === undefined ? {} : { visibleWhen: tf['visibleWhen'] }),
    },
  }
}

function resolveFieldDef(
  tableField: { readonly name: string; readonly type: string; readonly required?: boolean },
  cfg: FormFieldConfig | undefined,
  imageBucket: string | undefined
): ResolvedFieldDef {
  const options = normalizeOptions((tableField as Record<string, unknown>)['options'])
  const fallbackLabel = humanizeFieldName(tableField.name)
  const passthrough = extractFieldTypePassthrough(tableField)
  const richTextBucket = tableField.type === 'rich-text' ? imageBucket : undefined
  const tf = tableField as Record<string, unknown>
  const maxFileSize = resolveMaxFileSize(tf)
  const allowedFileTypes = resolveAllowedFileTypes(tf)
  const attachmentBucket = resolveAttachmentBucket(tableField.type, tf)
  const fieldType = tableField.type as FieldType
  const declaredDefault = declaredDefaultOf(tableField, fieldType)
  return {
    name: tableField.name,
    type: fieldType,
    required: tableField.required,
    options,
    displayLabel: fallbackLabel,
    ...(declaredDefault !== undefined && { defaultValue: declaredDefault }),
    ...passthrough,
    ...(richTextBucket && { imageBucket: richTextBucket }),
    ...(maxFileSize !== undefined && { maxFileSize }),
    ...(allowedFileTypes !== undefined && { allowedFileTypes }),
    ...(attachmentBucket !== undefined && { bucket: attachmentBucket }),
    ...resolveButtonConfig(tableField.type, tf),
    ...(cfg ? resolveCfgOverrides(cfg, fallbackLabel) : undefined),
  }
}

function getFieldsConfig(component?: Component): readonly FormFieldConfig[] | undefined {
  if (!component) return undefined
  const { fields } = component as { readonly fields?: readonly FormFieldConfig[] }
  return fields && fields.length > 0 ? fields : undefined
}

function normalizeFieldName(name: string): string {
  return name.replace(/[_-]/g, '').toLowerCase()
}

export function buildResolvedFieldDefs(
  tables: Tables | undefined,
  tableName: string,
  component?: Component,
  buckets?: Buckets
): readonly ResolvedFieldDef[] {
  const tableSchema = tables?.find((t) => t.name === tableName)
  const tableFields = tableSchema?.fields ?? []
  const fieldsConfig = getFieldsConfig(component)
  const imageBucket = buckets && buckets.length === 1 ? buckets[0]!.name : undefined

  if (fieldsConfig) {
    return fieldsConfig.flatMap((cfg) => {
      const normalizedCfgField = normalizeFieldName(cfg.field)
      const tf = tableFields.find((t) => normalizeFieldName(t.name) === normalizedCfgField)
      if (!tf) return []
      return [resolveFieldDef(tf, cfg, imageBucket)]
    })
  }

  return tableFields.map((tf) => resolveFieldDef(tf, undefined, imageBucket))
}
