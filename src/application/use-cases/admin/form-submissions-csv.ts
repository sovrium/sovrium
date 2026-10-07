/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rows of a form's submissions CSV export, before any encoding: the
 * columns in form-declaration order and one row per submission, every field
 * the caller's role may not read blanked (the column is kept, so a reader sees
 * that a value exists and is withheld rather than that the field is absent).
 *
 * Encoding the rows is the presentation edge's job — one encoder writes both
 * the HTTP download and the MCP text, so they are the same bytes.
 */

import { Schema } from 'effect'
import {
  evaluatePermission,
  OPEN_WHEN_UNDECLARED,
  permits,
  type PermissionCaller,
} from '@/domain/models/app/auth/permission-evaluation'
import type { PermissionValue } from '@/domain/models/app/auth/permissions'
import type { Form, FormField } from '@/domain/models/app/forms'

/** The inline export cap; past it the file is cut short and flagged. */
export const EXPORT_INLINE_CAP = 1000

/**
 * Whether the caller's role may read a form field. A field with no
 * `permissions.read` is readable; an admin outranks a field allow-list, so the
 * operator running an export sees every column rather than a blank one.
 */
const isFieldReadable = (field: FormField, caller: PermissionCaller): boolean => {
  const { permissions } = field as { readonly permissions?: { readonly read?: PermissionValue } }
  return permits(
    evaluatePermission(permissions?.read, caller, {
      whenUndeclared: OPEN_WHEN_UNDECLARED,
      adminOverride: 'admin-outranks-everything',
    })
  )
}

/** The column a field lands in, across the field kinds that carry a value. */
const fieldName = (field: FormField): string => {
  if (field.kind === 'table-field') return field.column
  if (field.kind === 'standalone') return field.name
  if (field.kind === 'calculation') return field.name
  if (field.kind === 'signature') return field.name
  return ''
}

/** The CSV columns, in form-declaration order. */
export const csvColumns = (form: Form): ReadonlyArray<string> => [
  'id',
  'submitted_at',
  'status',
  ...form.fields.map(fieldName).filter((name) => name.length > 0),
]

/** A submitted value as one CSV cell: an upload by its URL or name, a list joined. */
const csvCell = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.join(', ')
  if (value !== null && typeof value === 'object') {
    const upload = value as { readonly url?: string; readonly name?: string }
    return upload.url ?? upload.name ?? JSON.stringify(value)
  }
  return value ?? ''
}

/** One CSV row; a field the caller may not read is blanked, never dropped. */
export const csvRow = (
  row: {
    readonly id: string
    readonly submittedAt: Date | string
    readonly status: string | null
    readonly data: unknown
  },
  form: Form,
  caller: PermissionCaller
): Readonly<Record<string, unknown>> => {
  const data = (row.data ?? {}) as Readonly<Record<string, unknown>>
  const fields = form.fields
    .map((field) => [field, fieldName(field)] as const)
    .filter(([, name]) => name.length > 0)
    .map(([field, name]) => [name, isFieldReadable(field, caller) ? csvCell(data[name]) : ''])
  return {
    id: row.id,
    submitted_at: row.submittedAt instanceof Date ? row.submittedAt.toISOString() : row.submittedAt,
    status: row.status ?? '',
    ...Object.fromEntries(fields),
  }
}

/** The export's one query knob: the format, `csv` (the default) and nothing else. */
export const formSubmissionsExportQuerySchema = Schema.Struct({
  format: Schema.optional(
    Schema.Literal('csv').annotate({ description: 'The export format. Only `csv` (the default).' })
  ),
})
