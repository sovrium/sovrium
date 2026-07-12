/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { useEffect, useMemo } from 'react'
import { useRecordQuery, type RecordDataSource } from '../hooks/use-records-query'
import type { SystemDetailSource } from '@/domain/models/app/pages/components/system-detail-source'

interface PageRecordSystemIslandProps {
  readonly system?: SystemDetailSource
  readonly recordId?: string
}

const RECORD_TOKEN = /\$(?:record|parent)\.([a-zA-Z0-9_]+)/g

function toDisplayValue(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function collectTokenTextNodes(node: Node): readonly Text[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node as Text
    return text.nodeValue && text.nodeValue.includes('$') ? [text] : []
  }
  return Array.from(node.childNodes).flatMap(collectTokenTextNodes)
}

function distributeRecord(record: Readonly<Record<string, unknown>>): void {
  collectTokenTextNodes(document.body).forEach((text) => {
    const next = (text.nodeValue ?? '').replace(RECORD_TOKEN, (_, field: string) =>
      toDisplayValue(record[field])
    )
    if (next !== text.nodeValue) {
      text.nodeValue = next
    }
  })
}

export default function PageRecordSystemIsland({
  system,
  recordId,
}: PageRecordSystemIslandProps): null {
  const dataSource = useMemo<RecordDataSource | undefined>(
    () => (system ? { system } : undefined),
    [system]
  )
  const { data } = useRecordQuery('page-record', dataSource, recordId)

  useEffect(() => {
    if (data) distributeRecord(data)
  }, [data])

  return null
}
