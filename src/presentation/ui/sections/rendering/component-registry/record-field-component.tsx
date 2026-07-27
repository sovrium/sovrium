/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { sanitizeRichTextHTML } from '@/domain/utils/html-sanitization'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Tables } from '@/domain/models/app/tables'
import type { ReactElement } from 'react'

const ATTACHMENT_FIELD_TYPES = new Set(['attachment', 'single-attachment', 'multiple-attachments'])

const DEFAULT_BUCKET = 'default'

function resolveField(
  tables: Tables | undefined,
  tableName: string | undefined,
  fieldName: string | undefined
): { readonly type: string; readonly bucket?: unknown } | undefined {
  if (!tables || !tableName || !fieldName) return undefined
  const table = tables.find((t) => t.name === tableName)
  return table?.fields.find((f) => f.name === fieldName)
}

function resolveBucket(field: { readonly bucket?: unknown } | undefined): string {
  const bucket = field?.bucket
  return typeof bucket === 'string' && bucket.length > 0 ? bucket : DEFAULT_BUCKET
}

interface AttachmentValue {
  readonly key?: string
  readonly filename?: string
  readonly name?: string
  readonly url?: string
}

function attachmentHref(value: AttachmentValue, bucket: string): string | undefined {
  if (typeof value.url === 'string' && value.url.length > 0) return value.url
  if (typeof value.key === 'string' && value.key.length > 0) {
    return `/api/buckets/${bucket}/files/${value.key}`
  }
  return undefined
}

function toAttachmentList(value: unknown): readonly AttachmentValue[] {
  if (Array.isArray(value)) {
    return value.flatMap((v): readonly AttachmentValue[] => {
      if (typeof v === 'string' && v.length > 0) return [{ key: v }]
      return typeof v === 'object' && v !== null ? [v as AttachmentValue] : []
    })
  }
  if (typeof value === 'object' && value !== null) return [value as AttachmentValue]
  if (typeof value === 'string' && value.length > 0) return [{ key: value }]
  return []
}

function renderAttachment(
  id: string | undefined,
  testId: string | undefined,
  value: unknown,
  bucket: string
): ReactElement {
  const items = toAttachmentList(value)
  return (
    <div
      id={id}
      data-testid={testId}
      data-component="record-field"
    >
      {items.map((item, i) => {
        const href = attachmentHref(item, bucket)
        const label = item.filename ?? item.name ?? item.key ?? 'file'
        return href ? (
          <a
            key={i}
            href={href}
            className="text-primary underline"
          >
            {label}
          </a>
        ) : (
          <span key={i}>{label}</span>
        )
      })}
    </div>
  )
}

function renderRichText(
  id: string | undefined,
  testId: string | undefined,
  value: unknown
): ReactElement {
  const safeHtml = typeof value === 'string' ? sanitizeRichTextHTML(value) : ''
  return (
    <div
      id={id}
      data-testid={testId}
      data-component="record-field"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}

function renderRecordFieldSystemIsland(props: Record<string, unknown>): ReactElement {
  const dataSource = JSON.parse((props['_recordFieldDataSource'] as string) ?? '{}') as unknown
  const islandProps = JSON.stringify({
    dataSource,
    recordId: props['_recordFieldSystemId'] as string | undefined,
    field: props['field'] as string | undefined,
    'data-testid': props['data-testid'] as string | undefined,
  })
  return (
    <div
      id={props['id'] as string | undefined}
      data-island="record-field-system"
      data-component="record-field"
      data-testid={props['data-testid'] as string | undefined}
      data-island-props={islandProps}
    >
      {}
      <span
        role="status"
        aria-label="Loading field..."
        className="bg-background-subtle inline-block h-4 w-16 animate-pulse rounded"
      />
    </div>
  )
}

function renderPlainText(
  id: string | undefined,
  testId: string | undefined,
  value: unknown
): ReactElement {
  const text = value === undefined || value === null ? '' : String(value)
  return (
    <div
      id={id}
      data-testid={testId}
      data-component="record-field"
    >
      {text}
    </div>
  )
}

export const recordFieldComponent: ComponentRenderer = ({ rawProps, tables }): ReactElement => {
  const props = rawProps ?? {}

  if (props['_recordFieldSystemMode']) return renderRecordFieldSystemIsland(props)

  const id = props['id'] as string | undefined
  const testId = props['data-testid'] as string | undefined
  const fieldName = props['field'] as string | undefined
  const tableName = props['_recordTable'] as string | undefined
  const value = props['_recordValue']

  const field = resolveField(tables, tableName, fieldName)
  const fieldType = field?.type

  if (fieldType === 'rich-text') return renderRichText(id, testId, value)
  if (fieldType !== undefined && ATTACHMENT_FIELD_TYPES.has(fieldType)) {
    return renderAttachment(id, testId, value, resolveBucket(field))
  }
  return renderPlainText(id, testId, value)
}
