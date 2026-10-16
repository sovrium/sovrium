/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatCellValue } from '@/domain/models/app/tables/cell-value-format'
import { useRecordQuery, type RecordDataSource } from './hooks/use-record-query'
import { hasDataBinding } from './runtime/data-binding'
import { resolvePageLocale } from './runtime/page-locale'
import { resolvePageTimezone } from './runtime/page-timezone'
import type { ColumnFormat } from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { ReactElement } from 'react'

type FieldStrings = Readonly<Record<string, string>> | undefined

interface RecordFieldSystemIslandProps {
  readonly dataSource?: RecordDataSource
  /** The bound record id (route param value) injected into the endpoint slot. */
  readonly recordId?: string
  /** The record field name to render (`props.field` — an endpoint envelope key). */
  readonly field?: string
  /**
   * The author's declared display format, forwarded from the SSR host so a
   * self-binding record-field prints its fetched value exactly as a
   * container-bound one prints its resolved value.
   */
  readonly format?: ColumnFormat
  readonly 'data-testid'?: string
  /** The field's own words in the page language (`field.*`), where they differ from English. */
  readonly uiStrings?: FieldStrings
}

/** The field's pulse while its record loads, named in the page language. */
function FieldLoading({ strings }: { readonly strings: FieldStrings }): ReactElement {
  return (
    <span
      role="status"
      data-loading-status=""
      aria-label={strings?.['field.loading'] ?? 'Loading field...'}
      className="bg-muted inline-block h-4 w-16 animate-pulse rounded"
    />
  )
}

/** A missing binding, or with `failed` a failed read, said in the page language. */
function FieldAlert({
  strings,
  failed,
}: {
  readonly strings: FieldStrings
  readonly failed?: boolean
}): ReactElement {
  return (
    <span
      role="alert"
      className="text-error-fg text-md"
    >
      {failed
        ? (strings?.['field.loadFailed'] ?? 'Failed to load field')
        : (strings?.['field.missingSource'] ??
          'Record field is missing required dataSource configuration.')}
    </span>
  )
}

/**
 * record-field-system island — a record-field that SELF-binds to a system DETAIL
 * endpoint (CAP-2). It fetches ONE record from `dataSource.system.endpoint` (the
 * bound `recordId` injected into the `:param` slot) via the shared single-record
 * detail fetch, then renders `field` from the resolved record as read-only text.
 *
 * A system source is a READ source: no edit affordances. The `data-component`
 * marker lives on the SSR host wrapper (single match); this island root only
 * renders the field value, mounted INTO that host.
 */
export default function RecordFieldSystemIsland({
  dataSource,
  recordId,
  field,
  format,
  uiStrings,
}: RecordFieldSystemIslandProps): ReactElement {
  const { data, isLoading, isError } = useRecordQuery('record-field', dataSource, recordId)

  if (!hasDataBinding(dataSource)) return <FieldAlert strings={uiStrings} />
  if (isLoading) return <FieldLoading strings={uiStrings} />
  if (isError)
    return (
      <FieldAlert
        strings={uiStrings}
        failed
      />
    )

  const value = field !== undefined && data ? data[field] : undefined
  const text = format
    ? formatCellValue(value, format, resolvePageLocale(), { timeZone: resolvePageTimezone() })
    : value === undefined || value === null
      ? ''
      : String(value)
  // An empty value reads as a muted em dash, never as nothing at all: the host's
  // recipe mutes its own ink while it holds this mark.
  if (text === '') return <span data-slot="record-field-empty">—</span>
  return <span>{text}</span>
}
