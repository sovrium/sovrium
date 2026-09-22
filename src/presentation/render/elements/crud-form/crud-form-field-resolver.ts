/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { fieldNamesMatch } from '@/domain/models/app/tables/field-name-matching'
import {
  declaredFieldDescription,
  declaredFieldLabel,
  resolveDisplayDescription,
  resolveDisplayLabel,
} from '@/presentation/design/field-display'
import { showsDeclaredDefault } from '@/presentation/design/field-type-behavior'
import { humanizeFieldName } from '@/presentation/design/string-utils'
import type { ResolvedFieldDef } from './crud-form-types'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Component } from '@/domain/models/app/pages/components'
import type { FormFieldConfig } from '@/domain/models/app/pages/components/component-types/data/form'
import type { Tables } from '@/domain/models/app/tables'
import type { FieldType } from '@/domain/models/app/tables/fields'

/**
 * Normalize a choice field's declared options to their VALUE strings.
 *
 * `single-select` / `multi-select` declare `options: string[]`, but `status`
 * declares `options: { value, color }[]`. Rendering the raw entry would emit
 * `<option value="[object Object]">`, so the object form is unwrapped here —
 * once, at the single boundary where table-schema fields become form fields —
 * rather than in each of the two renderers.
 */
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

/**
 * Read a table field's schema-declared `default` as a form default value.
 *
 * Restricted to the field types whose control can legitimately show it (choice
 * controls — see `showsDeclaredDefault`) and to scalar values: an array default
 * (`multi-select`) has no single-control representation. Everything else keeps
 * its default in the column's `DEFAULT` clause, which applies when the untouched
 * field is omitted from the write.
 */
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

/** Column types that accept a column-level `bucket` binding. */
const ATTACHMENT_FIELD_TYPES: ReadonlySet<string> = new Set([
  'single-attachment',
  'multiple-attachments',
])

/**
 * Field-type pass-through props extracted from the table-schema field object.
 *
 * Rich-text fields carry `toolbar`, `maxLength`, `placeholder`. Code fields
 * carry `language`, `lineNumbers`, `tabSize`, `minLines`, `maxLines`. Barcode
 * fields carry `format`. We extract a superset here and let the renderer
 * (downstream) ignore irrelevant keys.
 */
type FieldTypePassthrough = {
  readonly placeholder?: string
  readonly maxLength?: number
  readonly toolbar?: readonly string[]
  readonly language?: string
  readonly lineNumbers?: boolean
  readonly tabSize?: number
  readonly minLines?: number
  readonly maxLines?: number
  readonly format?: string
}

function extractFieldTypePassthrough(tableField: unknown): FieldTypePassthrough {
  const f = tableField as Record<string, unknown>
  return {
    // Not a display concern: `format` is what tells the submit pipeline that
    // this column carries a CHECK an untouched '' would fail.
    format: typeof f['format'] === 'string' ? (f['format'] as string) : undefined,
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

/**
 * The per-field overrides a form's `fields[]` entry contributes.
 *
 * `label` and `description` are deliberately ABSENT here: both are resolved once
 * in {@link resolveFieldDef} through the shared `resolveDisplayLabel` /
 * `resolveDisplayDescription`, because the form entry is only the FIRST rung of
 * a three-rung order (entry override -> the field's own value -> this surface's
 * fallback) and this function cannot see the other two.
 */
function resolveCfgOverrides(cfg: FormFieldConfig) {
  return {
    placeholder: cfg.placeholder,
    readOnly: cfg.readOnly,
    disabled: cfg.disabled,
    // Conditional: an absent form-level default must NOT clobber the
    // table field's schema-declared `default`.
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

/**
 * The control's display name + guidance, resolved in one place.
 *
 * Order for both: the form entry's override, then the field's own value, then
 * THIS surface's fallback — the HUMANIZED name for the label (the drawer and the
 * column header keep the raw one, deliberately), and nothing at all for the
 * description, so an undescribed control emits no help-text node.
 */
function resolveDisplayProps(
  tf: Readonly<Record<string, unknown>>,
  cfg: FormFieldConfig | undefined,
  fallbackLabel: string
): { readonly displayLabel: string; readonly description?: string } {
  const description = resolveDisplayDescription(cfg?.description, declaredFieldDescription(tf))
  return {
    displayLabel: resolveDisplayLabel(cfg?.label, declaredFieldLabel(tf), fallbackLabel),
    ...(description === undefined ? {} : { description }),
  }
}

/**
 * [internal ref]: the file field uploads to — and previews from — the bucket DECLARED
 * on the bound column, not the implicit 'default' and not the "single declared
 * bucket" heuristic used for the rich-text image button (which is wrong the
 * moment an app declares two buckets).
 */
function resolveAttachmentBucket(
  fieldType: string,
  tf: Readonly<Record<string, unknown>>
): string | undefined {
  if (!ATTACHMENT_FIELD_TYPES.has(fieldType)) return undefined
  const { bucket } = tf
  return typeof bucket === 'string' && bucket.length > 0 ? bucket : undefined
}

/**
 * The upload size cap, read off the TABLE column.
 *
 * Deliberately NOT gated on {@link ATTACHMENT_FIELD_TYPES} — unlike
 * {@link resolveAttachmentBucket} — because a column of any type that declares
 * `maxFileSize` has always had it forwarded, and narrowing that here would be a
 * silent behaviour change dressed up as a refactor.
 */
function resolveMaxFileSize(tf: Readonly<Record<string, unknown>>): number | undefined {
  return typeof tf['maxFileSize'] === 'number' ? (tf['maxFileSize'] as number) : undefined
}

/** The accepted-MIME allowlist, read off the TABLE column. Ungated, as above. */
function resolveAllowedFileTypes(
  tf: Readonly<Record<string, unknown>>
): readonly string[] | undefined {
  const value = tf['allowedFileTypes']
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
    ? (value as readonly string[])
    : undefined
}

/**
 * Carry a `relationship` column's picker configuration onto the resolved field
 * def, so the form renders a real record picker instead of a text box.
 *
 * This is the gap [internal ref] names: the GRID has read `relatedTable` /
 * `displayField` / `allowMultiple` off `fieldMeta.edit` since the cell editor
 * shipped, while the form's resolver composed no relationship extractor at all
 * — so none of those properties ever reached the client and the widget degraded
 * to `renderTypedInputField(args, 'text')`. A form then posted the typed LABEL
 * as the foreign key, which the column's CHECK rejected with a 500.
 *
 * Returns an empty overlay for every other type so the caller spreads it
 * unconditionally, matching {@link resolveButtonConfig} beside it.
 *
 * `canCreateRelated` is deliberately NOT read here. It is not a field property
 * — it is a per-session permission answer — and it is stamped onto the
 * component's props by the data-source resolver, where the session role is
 * known and this function's inputs are not.
 */
function resolveRelationshipConfig(
  fieldType: string,
  tf: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  if (fieldType !== 'relationship') return {}
  const stringProp = (key: string) => (typeof tf[key] === 'string' ? { [key]: tf[key] } : {})
  const boolProp = (key: string) => (typeof tf[key] === 'boolean' ? { [key]: tf[key] } : {})
  return {
    ...stringProp('relatedTable'),
    ...stringProp('displayField'),
    ...stringProp('relationType'),
    ...boolProp('allowMultiple'),
    ...(typeof tf['maxLinked'] === 'number' ? { maxLinked: tf['maxLinked'] } : {}),
  }
}

/**
 * Carry a `type: 'button'` field's own config onto the resolved field def, so
 * the form renders the declared action instead of a text box. Returns an empty
 * overlay for every other type so the caller spreads it unconditionally.
 */
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
  // imageBucket is only meaningful for rich-text; including it on every type
  // is harmless because the field renderer reads it conditionally.
  const richTextBucket = tableField.type === 'rich-text' ? imageBucket : undefined
  // maxFileSize, allowedFileTypes and bucket are defined on the table column.
  const tf = tableField as Record<string, unknown>
  const maxFileSize = resolveMaxFileSize(tf)
  const allowedFileTypes = resolveAllowedFileTypes(tf)
  const attachmentBucket = resolveAttachmentBucket(tableField.type, tf)
  // The domain deliberately admits unrecognized field types (UnknownFieldSchema),
  // so `type` is a plain `string` here. Assert it into the union at this single
  // boundary; every consumer routes through the defensive
  // `fieldTypeBehavior()` accessor, which degrades an unknown type to a text box.
  const fieldType = tableField.type as FieldType
  // A choice field's declared `default` is what the record will actually carry,
  // so the control preselects it up front. Overridden below by a form-level
  // `fields[].defaultValue` when one is configured.
  const declaredDefault = declaredDefaultOf(tableField, fieldType)
  return {
    name: tableField.name,
    type: fieldType,
    required: tableField.required,
    options,
    ...resolveDisplayProps(tf, cfg, fallbackLabel),
    ...(declaredDefault !== undefined && { defaultValue: declaredDefault }),
    ...passthrough,
    ...(richTextBucket && { imageBucket: richTextBucket }),
    ...(maxFileSize !== undefined && { maxFileSize }),
    ...(allowedFileTypes !== undefined && { allowedFileTypes }),
    ...(attachmentBucket !== undefined && { bucket: attachmentBucket }),
    ...resolveButtonConfig(tableField.type, tf),
    ...resolveRelationshipConfig(tableField.type, tf),
    ...(cfg ? resolveCfgOverrides(cfg) : undefined),
  }
}

/**
 * Reads the optional `fields[]` array from a form component definition.
 *
 * When present, the array filters and orders the rendered fields and provides
 * per-field overrides (label, placeholder, readOnly, defaultValue, hidden).
 */
function getFieldsConfig(component?: Component): readonly FormFieldConfig[] | undefined {
  if (!component) return undefined
  const { fields } = component as { readonly fields?: readonly FormFieldConfig[] }
  return fields && fields.length > 0 ? fields : undefined
}

/**
 * Build the ordered, resolved list of fields to render.
 *
 * - When `fields[]` is configured, ONLY those fields are rendered, in the given
 *   order. Each is enriched with the matching table-schema info (type, options).
 * - When `fields[]` is omitted, every table field is rendered using auto-derived
 *   labels (humanized field names).
 *
 * Field name matching is case/separator-insensitive: `firstName` matches
 * `first_name` and vice-versa. That folding is the SHARED
 * `fieldNamesMatch` — the config validator resolves `fields[].field` through the
 * same definition, so a config this resolver renders can never be refused at
 * boot for naming a field it found perfectly well.
 */
export function buildResolvedFieldDefs(
  tables: Tables | undefined,
  tableName: string,
  component?: Component,
  buckets?: Buckets
): readonly ResolvedFieldDef[] {
  const tableSchema = tables?.find((t) => t.name === tableName)
  const tableFields = tableSchema?.fields ?? []
  const fieldsConfig = getFieldsConfig(component)
  // Rich-text image-button bucket binding: the contract is "the single bucket
  // declared in the schema's buckets[] array" (asserted by
  // [internal ref]). When zero or more than one bucket is
  // declared, no implicit binding happens — the editor falls back to a
  // server-default bucket.
  const imageBucket = buckets && buckets.length === 1 ? buckets[0]!.name : undefined

  if (fieldsConfig) {
    return fieldsConfig.flatMap((cfg) => {
      const tf = tableFields.find((t) => fieldNamesMatch(t.name, cfg.field))
      if (!tf) return []
      return [resolveFieldDef(tf, cfg, imageBucket)]
    })
  }

  return tableFields.map((tf) => resolveFieldDef(tf, undefined, imageBucket))
}
