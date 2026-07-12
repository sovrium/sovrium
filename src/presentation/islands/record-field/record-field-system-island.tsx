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
  readonly recordId?: string
  readonly field?: string
  readonly 'data-testid'?: string
}

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
