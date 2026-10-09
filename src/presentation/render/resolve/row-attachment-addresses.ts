/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `$record.<attachment>` in a row template is an ADDRESS a browser can open.
 *
 * On a private bucket it is a download link signed for this render (the one a
 * `file-preview` and the records API mint, valid an hour); on a public bucket,
 * the bucket's plain files address. Its parts read what the column recorded:
 * `.key` the storage key, `.url` the same address, `.name`, `.size` and
 * `.mimeType` what was stored with the file, empty otherwise. A
 * `multiple-attachments` column answers for its first file.
 *
 * Only the rows the page already read for this reader are addressed — the row
 * read applied the row-level rules and dropped every column she may not read —
 * so a value she could not read is never signed: its token prints nothing.
 *
 * HOW, WITHOUT A SECOND GRAMMAR. The `$record.` grammar names one field per
 * token, so the parts cannot be read off a nested value. Instead, each token
 * naming an attachment column of the bound table is rewritten in the row
 * template to a hidden per-part field, and each row carries those fields
 * beside its stored value. The stored value itself is untouched, so the
 * presence flags and a `record-field` keep reading what the column holds. A
 * nested binding's own template is left alone: its tokens name its own rows.
 */

import { parseJsonArrayCell, parseJsonObjectCell } from '@/domain/kernel/sql/sqlite-json-cell'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import { resolveStoragePublicAccess } from '@/domain/models/process-env/storage/storage-public-access'
import type { SignFileUrl } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { Component } from '@/domain/models/app/pages/components'

const ATTACHMENT_TYPES: ReadonlySet<string> = new Set([
  'single-attachment',
  'multiple-attachments',
  'attachment',
])

const PARTS = ['url', 'key', 'name', 'size', 'mimeType'] as const
type Part = (typeof PARTS)[number]

/** One `$record.<field>` token, with an optional attachment part. A static literal. */
const ATTACHMENT_TOKEN =
  /(?<!\\)\$record\.([a-zA-Z0-9_]+)(?:\.(key|url|name|size|mimeType)(?![a-zA-Z0-9_]))?/g

/** The hidden field one part of one column is carried under. */
const partField = (field: string, part: Part): string => `_attachment_${part}_${field}`

/** Rewrite every token naming an attachment column to the hidden field of its part. */
const rewriteTokens = (text: string, columns: ReadonlySet<string>): string =>
  text.replace(ATTACHMENT_TOKEN, (match: string, field: string, part: Part | undefined) =>
    columns.has(field) ? `$record.${partField(field, part ?? 'url')}` : match
  )

/** The row template with its attachment tokens rewritten; a nested binding's children are kept. */
const rewriteTemplate = (value: unknown, columns: ReadonlySet<string>): unknown => {
  if (typeof value === 'string') return rewriteTokens(value, columns)
  if (Array.isArray(value)) return value.map((item) => rewriteTemplate(item, columns))
  if (typeof value !== 'object' || value === null) return value
  const node = value as Readonly<Record<string, unknown>>
  return Object.fromEntries(
    Object.entries(node).map(([key, child]) => [
      key,
      key === 'children' && node['dataSource'] !== undefined
        ? child
        : rewriteTemplate(child, columns),
    ])
  )
}

interface StoredFile {
  readonly key: string
  readonly name?: unknown
  readonly size?: unknown
  readonly mimeType?: unknown
}

/** The recorded details of an object-shaped file, or none without a key. */
const fileFromObject = (file: Readonly<Record<string, unknown>>): StoredFile | undefined => {
  const { key } = file
  if (typeof key !== 'string' || key === '') return undefined
  return {
    key,
    name: file['name'] ?? file['filename'],
    size: file['size'],
    mimeType: file['mimeType'] ?? file['type'],
  }
}

/** The first file a stored value names — a bare key, an object, or the JSON text of either. */
const firstFileOf = (value: unknown): StoredFile | undefined => {
  const parsed = parseJsonArrayCell(value) ?? parseJsonObjectCell(value) ?? value
  const first: unknown = Array.isArray(parsed) ? parsed[0] : parsed
  if (typeof first === 'string') return first === '' ? undefined : { key: first }
  return typeof first === 'object' && first !== null
    ? fileFromObject(first as Readonly<Record<string, unknown>>)
    : undefined
}

interface ColumnAddress {
  readonly field: string
  readonly bucket: string
  readonly isPublic: boolean
}

/** The hidden part fields one row carries for one column, or none for an empty cell. */
const rowParts = async (
  row: Readonly<Record<string, unknown>>,
  column: ColumnAddress,
  sign: SignFileUrl
): Promise<Readonly<Record<string, unknown>>> => {
  if (!Object.hasOwn(row, column.field)) return {}
  const file = firstFileOf(row[column.field])
  if (file === undefined) return {}
  const url = column.isPublic
    ? `/api/buckets/${column.bucket}/files/${file.key}`
    : await sign(column.bucket, file.key, 'record')
  const values: Readonly<Record<Part, unknown>> = {
    url: url ?? '',
    key: file.key,
    name: file.name,
    size: file.size,
    mimeType: file.mimeType,
  }
  return Object.fromEntries(PARTS.map((part) => [partField(column.field, part), values[part]]))
}

/** The attachment columns a row template names: only these are addressed, and signed. */
const namedColumns = (template: unknown, columns: ReadonlySet<string>): ReadonlySet<string> =>
  new Set(
    (JSON.stringify(template ?? null).match(ATTACHMENT_TOKEN) ?? [])
      .map((token) => token.slice('$record.'.length).split('.')[0] ?? '')
      .filter((field) => columns.has(field))
  )

/**
 * The list's row template and rows, each attachment token of the bound table
 * made an address for this reader. Unchanged when the template names no
 * attachment column, or when the render carries no signer.
 */
export async function addressRowAttachments(input: {
  readonly component: Component
  readonly rows: readonly Record<string, unknown>[]
  readonly app: App
  readonly tableName: string
  readonly sign: SignFileUrl | undefined
}): Promise<{ readonly component: Component; readonly rows: readonly Record<string, unknown>[] }> {
  const { component, rows, app, tableName, sign } = input
  const fields = app.tables?.find((table) => table.name === tableName)?.fields ?? []
  const attachments = new Set(fields.filter((f) => ATTACHMENT_TYPES.has(f.type)).map((f) => f.name))
  const names = namedColumns(component.children, attachments)
  if (sign === undefined || names.size === 0) return { component, rows }
  const { defaultPublic } = resolveStoragePublicAccess()
  const columns: readonly ColumnAddress[] = [...names].map((field) => {
    const bucket = resolveFieldBucket(app, tableName, field) ?? SYSTEM_BUCKET_NAME
    const declared = app.buckets?.find((candidate) => candidate.name === bucket)
    return { field, bucket, isPublic: defaultPublic || declared?.public === true }
  })
  const addressed = await Promise.all(
    rows.map(async (row) => {
      const parts = await Promise.all(columns.map((column) => rowParts(row, column, sign)))
      return Object.assign({}, row, ...parts) as Record<string, unknown>
    })
  )
  return {
    component: {
      ...component,
      children: rewriteTemplate(component.children, names) as Component['children'],
    },
    rows: addressed,
  }
}
