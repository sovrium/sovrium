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

function resolveFieldType(
  tables: Tables | undefined,
  tableName: string | undefined,
  fieldName: string | undefined
): string | undefined {
  if (!tables || !tableName || !fieldName) return undefined
  const table = tables.find((t) => t.name === tableName)
  return table?.fields.find((f) => f.name === fieldName)?.type
}

interface AttachmentValue {
  readonly key?: string
  readonly filename?: string
  readonly name?: string
  readonly url?: string
}

function attachmentHref(value: AttachmentValue): string | undefined {
  if (typeof value.url === 'string' && value.url.length > 0) return value.url
  if (typeof value.key === 'string' && value.key.length > 0) {
    return `/api/buckets/default/files/${value.key}`
  }
  return undefined
}

function toAttachmentList(value: unknown): readonly AttachmentValue[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is AttachmentValue => typeof v === 'object' && v !== null)
  }
  if (typeof value === 'object' && value !== null) return [value as AttachmentValue]
  if (typeof value === 'string' && value.length > 0) return [{ key: value }]
  return []
}

function renderAttachment(
  id: string | undefined,
  testId: string | undefined,
  value: unknown
): ReactElement {
  const items = toAttachmentList(value)
  return (
    <div
      id={id}
      data-testid={testId}
      data-component="record-field"
    >
      {items.map((item, i) => {
        const href = attachmentHref(item)
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
  const id = props['id'] as string | undefined
  const testId = props['data-testid'] as string | undefined
  const fieldName = props['field'] as string | undefined
  const tableName = props['_recordTable'] as string | undefined
  const value = props['_recordValue']

  const fieldType = resolveFieldType(tables, tableName, fieldName)

  if (fieldType === 'rich-text') return renderRichText(id, testId, value)
  if (fieldType !== undefined && ATTACHMENT_FIELD_TYPES.has(fieldType)) {
    return renderAttachment(id, testId, value)
  }
  return renderPlainText(id, testId, value)
}
