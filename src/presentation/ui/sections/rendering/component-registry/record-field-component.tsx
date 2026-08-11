/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `record-field` renderer (GAP-5 / [internal ref]).
 *
 * Read-only display of a single bound record field. The data-source resolver
 * (single-mode / collection `$record`) injects the raw value as
 * `rawProps._recordValue` and the bound table name as `rawProps._recordTable`.
 * This renderer looks up the field's DECLARED type from `config.tables` and
 * dispatches:
 *   - `rich-text` → stored HTML sanitized via the canonical `sanitizeRichTextHTML`
 *     (security rule S2 — the SINGLE sanitiser, never add a second) and rendered
 *     as real elements via `dangerouslySetInnerHTML` (mirrors the `text`
 *     `format: 'markdown'` sanitise→inject branch in `text-components.tsx`).
 *   - attachment family (`attachment` / `single-attachment` / `multiple-attachments`)
 *     → a read-only list of `<a>` download links (file name + url).
 *   - otherwise → plain text.
 */

import { sanitizeRichTextHTML } from '@/domain/utils/html-sanitization'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Tables } from '@/domain/models/app/tables'
import type { ReactElement } from 'react'

const ATTACHMENT_FIELD_TYPES = new Set(['attachment', 'single-attachment', 'multiple-attachments'])

/** Implicit bucket used when the bound column declares no `bucket`. */
const DEFAULT_BUCKET = 'default'

/** Look up the declared field from the bound table's schema. */
function resolveField(
  tables: Tables | undefined,
  tableName: string | undefined,
  fieldName: string | undefined
): { readonly type: string; readonly bucket?: unknown } | undefined {
  if (!tables || !tableName || !fieldName) return undefined
  const table = tables.find((t) => t.name === tableName)
  return table?.fields.find((f) => f.name === fieldName)
}

/**
 * Resolve the download bucket for an attachment column: the bucket DECLARED on
 * the column, else the implicit 'default' — never the app's first declared
 * bucket, which is the form-upload path's fallback..
 */
function resolveBucket(field: { readonly bucket?: unknown } | undefined): string {
  const bucket = field?.bucket
  return typeof bucket === 'string' && bucket.length > 0 ? bucket : DEFAULT_BUCKET
}

/** A single attachment metadata shape ({ key, filename } JSONB or string key). */
interface AttachmentValue {
  readonly key?: string
  readonly filename?: string
  readonly name?: string
  readonly url?: string
}

/** Build the read-only download URL for a stored attachment key. */
function attachmentHref(value: AttachmentValue, bucket: string): string | undefined {
  if (typeof value.url === 'string' && value.url.length > 0) return value.url
  if (typeof value.key === 'string' && value.key.length > 0) {
    return `/api/buckets/${bucket}/files/${value.key}`
  }
  return undefined
}

/** Normalise an attachment field value to a list of attachment objects. */
function toAttachmentList(value: unknown): readonly AttachmentValue[] {
  if (Array.isArray(value)) {
    // `multiple-attachments` stores an array of bare storage keys; the read
    // path may also hand back an array of enriched objects.
    return value.flatMap((v): readonly AttachmentValue[] => {
      if (typeof v === 'string' && v.length > 0) return [{ key: v }]
      return typeof v === 'object' && v !== null ? [v as AttachmentValue] : []
    })
  }
  if (typeof value === 'object' && value !== null) return [value as AttachmentValue]
  if (typeof value === 'string' && value.length > 0) return [{ key: value }]
  return []
}

/** Render the attachment family read-only as a list of download links. */
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

/** Render a rich-text value as sanitized real HTML. */
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
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR one-shot; HTML is canonically sanitised before injection (security S2)
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}

/**
 * Render the `record-field-system` island host (CAP-2). When a `record-field`
 * SELF-binds to a system DETAIL endpoint, the data-source resolver stamps
 * `_recordFieldSystemMode` + `_recordFieldDataSource` + `_recordFieldSystemId`;
 * this host forwards them to the island, which fetches its single record and
 * renders `field`. The `data-component="record-field"` marker lives ONLY on this
 * SSR host (single match) — the island root mounts into it and renders the value.
 */
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
      {/* SSR skeleton: a VISIBLE pulse before island hydration so the host has a
          non-zero box. The island replaces this host's children on mount. */}
      <span
        role="status"
        aria-label="Loading field..."
        className="bg-background-subtle inline-block h-4 w-16 animate-pulse rounded"
      />
    </div>
  )
}

/** Render any other field value as plain text. */
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

  // CAP-2: a record-field that SELF-binds to a system DETAIL endpoint hydrates
  // the `record-field-system` island (fetches its own single record client-side)
  // rather than resolving server-side from a host container's bound record.
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
