/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `page-record-system` enhancement island (CAP-2 — page-level system single).
 *
 * A pure side-effect island for a PAGE whose page-level `dataSource.system` binds
 * the page to a SINGLE record from a system DETAIL endpoint. The page's descendant
 * components are SSR-rendered with their `$record.*` / `$parent.*` tokens LEFT AS
 * LITERAL TEXT (the record can't be resolved server-side — it lives behind an
 * admin-guarded detail endpoint). This island then, on mount:
 *  1. fetches ONE record from the detail endpoint (the route param injected into
 *     the `:param` slot) via the shared single-record detail fetch, and
 *  2. distributes it CLIENT-SIDE by walking the page's descendant text nodes and
 *     replacing each `$record.<field>` / `$parent.<field>` token with the resolved
 *     value.
 *
 * It renders NOTHING — the page components are the static structure it enhances in
 * place (mirrors the `split-pane` enhancer). A system source is READ-ONLY: the
 * island only reads + distributes, it never writes.
 *
 * The DB-table page-level `{ table, mode: single, param }` binding is resolved +
 * substituted SERVER-side and never reaches this island.
 */

import { useEffect, useMemo } from 'react'
import { useRecordQuery, type RecordDataSource } from '../hooks/use-records-query'
import type { SystemDetailSource } from '@/domain/models/app/pages/components/system-detail-source'

interface PageRecordSystemIslandProps {
  readonly system?: SystemDetailSource
  /** The route param value injected into the endpoint `:param` slot. */
  readonly recordId?: string
}

const RECORD_TOKEN = /\$(?:record|parent)\.([a-zA-Z0-9_]+)/g

/** Coerce a resolved record value to its display string form. */
function toDisplayValue(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

/**
 * Recursively collect the text nodes under `node` that contain a `$…` token, as an
 * immutable list (no loop / mutation — functional-lint clean).
 */
function collectTokenTextNodes(node: Node): readonly Text[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node as Text
    return text.nodeValue && text.nodeValue.includes('$') ? [text] : []
  }
  return Array.from(node.childNodes).flatMap(collectTokenTextNodes)
}

/**
 * Replace `$record.<field>` / `$parent.<field>` tokens with the resolved record
 * values in every page text node that carries one. Only token-bearing text nodes
 * are touched, so unrelated page text is left intact.
 */
function distributeRecord(record: Readonly<Record<string, unknown>>): void {
  collectTokenTextNodes(document.body).forEach((text) => {
    const next = (text.nodeValue ?? '').replace(RECORD_TOKEN, (_, field: string) =>
      toDisplayValue(record[field])
    )
    if (next !== text.nodeValue) {
      // eslint-disable-next-line functional/immutable-data, no-param-reassign -- DOM token distribution is the contract here
      text.nodeValue = next
    }
  })
}

/**
 * Page-level system-record enhancer — renders nothing; fetches the detail record
 * via the shared single-record detail query (TanStack handles cancellation/dedup)
 * and distributes `$record.*` into the SSR page in place once it resolves.
 */
export default function PageRecordSystemIsland({
  system,
  recordId,
}: PageRecordSystemIslandProps): null {
  // The detail-endpoint binding the shared single-record query understands.
  const dataSource = useMemo<RecordDataSource | undefined>(
    () => (system ? { system } : undefined),
    [system]
  )
  const { data } = useRecordQuery('page-record', dataSource, recordId)

  useEffect(() => {
    if (data) distributeRecord(data)
  }, [data])

  // eslint-disable-next-line unicorn/no-null -- React components must return null (not undefined) to render nothing
  return null
}
