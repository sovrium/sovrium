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

import { sanitizeRichTextHTML } from '@/domain/kernel/sanitize/html-sanitization'
import { formatCellValue } from '@/domain/models/app/tables/cell-value-format'
import { computeRecordFieldValueClasses } from '@/presentation/design/display-default-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import type { ComponentRenderer } from './component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'
import type { ColumnFormat } from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { Tables } from '@/domain/models/app/tables'
import type { ReactElement } from 'react'

/**
 * The locale a server-rendered `record-field` formats in.
 *
 * Only `relative-time` reads it, and this renderer runs before a `<html lang>`
 * exists to read (the island's `resolvePageLocale` is the DOM-side answer), so
 * it takes the platform default the formatters themselves fall back to rather
 * than inventing a second one.
 */
const SSR_FORMAT_LOCALE = 'en-US'

/**
 * The author's declared `format`, read off the component ROOT — where
 * `recordFieldFields` declares it, beside `dataSource`.
 *
 * Narrowed by a cast rather than by the component union: the union is ~58
 * branches wide and every renderer in this registry reaches its own root keys
 * the same way.
 */
function resolveFormat(component: Component | undefined): ColumnFormat | undefined {
  return (component as { readonly format?: ColumnFormat } | undefined)?.format
}

/**
 * The three things every branch below paints on its root, and the reason they
 * travel together.
 *
 * `className` used to be DROPPED by all four branches — each emitted a bare
 * `<div data-component="record-field">` — so neither the app author's own class
 * nor `design.components['record-field']` could reach this renderer at all, and
 * the only place the defect could be fixed was here. Threading it as one object
 * rather than as a fifth positional parameter keeps the branches' signatures
 * readable and makes "did this branch forget the class?" answerable by eye.
 */
interface RecordFieldChrome {
  readonly id: string | undefined
  readonly testId: string | undefined
  /** The recipe, already merged with whatever the app and the author declared. */
  readonly className: string
}

/** Merge the value recipe with the class the dispatcher resolved for this node. */
function resolveChrome(props: Record<string, unknown>, className: unknown): RecordFieldChrome {
  return {
    id: props['id'] as string | undefined,
    testId: props['data-testid'] as string | undefined,
    className: resolveClasses(
      computeRecordFieldValueClasses(),
      undefined,
      typeof className === 'string' ? className : undefined
    ),
  }
}

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
function renderAttachment(chrome: RecordFieldChrome, value: unknown, bucket: string): ReactElement {
  const items = toAttachmentList(value)
  return (
    <div
      id={chrome.id}
      className={chrome.className}
      data-testid={chrome.testId}
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
function renderRichText(chrome: RecordFieldChrome, value: unknown): ReactElement {
  const safeHtml = typeof value === 'string' ? sanitizeRichTextHTML(value) : ''
  return (
    <div
      id={chrome.id}
      className={chrome.className}
      data-testid={chrome.testId}
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
function renderRecordFieldSystemIsland(
  chrome: RecordFieldChrome,
  props: Record<string, unknown>,
  format: ColumnFormat | undefined
): ReactElement {
  const dataSource = JSON.parse((props['_recordFieldDataSource'] as string) ?? '{}') as unknown
  const islandProps = JSON.stringify({
    dataSource,
    recordId: props['_recordFieldSystemId'] as string | undefined,
    field: props['field'] as string | undefined,
    // Forwarded so a self-binding record-field formats its fetched value the
    // same way its container-bound sibling does. Omitting it would have made
    // `format` a silent no-op on exactly one of the two binding modes.
    format,
    'data-testid': props['data-testid'] as string | undefined,
  })
  return (
    <div
      id={chrome.id}
      className={chrome.className}
      data-island="record-field-system"
      data-component="record-field"
      data-testid={chrome.testId}
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

/**
 * Render any other field value as text — through the declared `format` when the
 * author set one, else verbatim.
 *
 * The format wins over the field-type dispatch above ONLY for the plain-text
 * tail: `rich-text` and the attachment family have their own chrome and no
 * `ColumnFormat` describes either, so a format declared on one of those is
 * ignored rather than silently replacing a download link with a string.
 */
function renderPlainText(
  chrome: RecordFieldChrome,
  value: unknown,
  format: ColumnFormat | undefined
): ReactElement {
  const text = format
    ? formatCellValue(value, format, SSR_FORMAT_LOCALE)
    : value === undefined || value === null
      ? ''
      : String(value)
  return (
    <div
      id={chrome.id}
      className={chrome.className}
      data-testid={chrome.testId}
      data-component="record-field"
    >
      {text}
    </div>
  )
}

export const recordFieldComponent: ComponentRenderer = ({
  elementProps,
  rawProps,
  tables,
  component,
}): ReactElement => {
  const props = rawProps ?? {}
  const format = resolveFormat(component)
  // `elementProps` and NOT `rawProps` for the class, deliberately: the
  // dispatcher folds `design.components['record-field']` into
  // `elementProps.className` before a renderer ever sees it, so reading the raw
  // bag would honour the author's own class and silently drop the app's.
  const chrome = resolveChrome(props, elementProps['className'])

  // CAP-2: a record-field that SELF-binds to a system DETAIL endpoint hydrates
  // the `record-field-system` island (fetches its own single record client-side)
  // rather than resolving server-side from a host container's bound record.
  if (props['_recordFieldSystemMode']) return renderRecordFieldSystemIsland(chrome, props, format)

  const fieldName = props['field'] as string | undefined
  const tableName = props['_recordTable'] as string | undefined
  const value = props['_recordValue']

  const field = resolveField(tables, tableName, fieldName)
  const fieldType = field?.type

  if (fieldType === 'rich-text') return renderRichText(chrome, value)
  if (fieldType !== undefined && ATTACHMENT_FIELD_TYPES.has(fieldType)) {
    return renderAttachment(chrome, value, resolveBucket(field))
  }
  return renderPlainText(chrome, value, format)
}
