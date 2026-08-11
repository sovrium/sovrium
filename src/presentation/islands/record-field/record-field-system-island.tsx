/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useRecordQuery, type RecordDataSource } from '../hooks/use-records-query'
import { hasDataBinding } from '../shared/data-binding'
import type { ReactElement } from 'react'

interface RecordFieldSystemIslandProps {
  readonly dataSource?: RecordDataSource
  /** The bound record id (route param value) injected into the endpoint slot. */
  readonly recordId?: string
  /** The record field name to render (`props.field` — an endpoint envelope key). */
  readonly field?: string
  readonly 'data-testid'?: string
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
}: RecordFieldSystemIslandProps): ReactElement {
  const { data, isLoading, isError } = useRecordQuery('record-field', dataSource, recordId)

  if (!hasDataBinding(dataSource)) {
    return (
      <span
        role="alert"
        className="text-error-fg text-sm"
      >
        Record field is missing required dataSource configuration.
      </span>
    )
  }
  if (isLoading) {
    return (
      <span
        role="status"
        aria-label="Loading field..."
        className="bg-background-subtle inline-block h-4 w-16 animate-pulse rounded"
      />
    )
  }
  if (isError) {
    return (
      <span
        role="alert"
        className="text-error-fg text-sm"
      >
        Failed to load field
      </span>
    )
  }

  const value = field !== undefined && data ? data[field] : undefined
  return <span>{value === undefined || value === null ? '' : String(value)}</span>
}
