/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { humanizeFieldName } from '@/presentation/utils/string-utils'
import type { ResolvedFieldDef } from './crud-form-renderer'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Component } from '@/domain/models/app/pages/components'
import type { FormFieldConfig } from '@/domain/models/app/pages/components/component-types/data/form'
import type { Tables } from '@/domain/models/app/tables'

type SingleSelectField = { options?: readonly string[] }

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
    defaultValue: cfg.defaultValue,
    hidden: cfg.hidden,
    visibleWhen: cfg.visibleWhen,
    requiredWhen: cfg.requiredWhen,
    disabledWhen: cfg.disabledWhen,
    accept: cfg.accept,
    dropZone: cfg.dropZone,
    maxFiles: cfg.maxFiles,
  }
}

function resolveFieldDef(
  tableField: { readonly name: string; readonly type: string; readonly required?: boolean },
  cfg: FormFieldConfig | undefined,
  imageBucket: string | undefined
): ResolvedFieldDef {
  const { options } = tableField as unknown as SingleSelectField
  const fallbackLabel = humanizeFieldName(tableField.name)
  const passthrough = extractFieldTypePassthrough(tableField)
  const richTextBucket = tableField.type === 'rich-text' ? imageBucket : undefined
  const tf = tableField as Record<string, unknown>
  const maxFileSize =
    typeof tf['maxFileSize'] === 'number' ? (tf['maxFileSize'] as number) : undefined
  const allowedFileTypes =
    Array.isArray(tf['allowedFileTypes']) &&
    (tf['allowedFileTypes'] as unknown[]).every((v) => typeof v === 'string')
      ? (tf['allowedFileTypes'] as readonly string[])
      : undefined
  return {
    name: tableField.name,
    type: tableField.type,
    required: tableField.required,
    options,
    displayLabel: fallbackLabel,
    ...passthrough,
    ...(richTextBucket && { imageBucket: richTextBucket }),
    ...(maxFileSize !== undefined && { maxFileSize }),
    ...(allowedFileTypes !== undefined && { allowedFileTypes }),
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
