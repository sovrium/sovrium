/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A generic record sheet's Activity tab: the record's history, newest first,
 * read from `GET /api/tables/:table/records/:id/history` when the tab opens —
 * never with the record, since most readers never open it.
 *
 * Each change names who made it and what it changed: a creation is one line,
 * an update lists each field whose value moved, by its label, with the value it
 * moved to. While the history loads the panel says so in a polite status.
 */

import { useQuery } from '@tanstack/react-query'
import { fillPlaceholders } from '@/domain/kernel/format/placeholder-format'
import { relativeTimeText } from './record-drawer-relative-time'
import type { ReactElement } from 'react'

interface HistoryEntry {
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly createdAt: string
  readonly changes: Readonly<Record<string, unknown>> | null
  readonly userName: string | null
}

/** The words the tab draws, in the page language. */
export type ActivityWords = Readonly<Record<string, string>>

const ACTION_KEY: Readonly<Record<HistoryEntry['action'], string>> = {
  create: 'activityCreated',
  update: 'activityUpdated',
  delete: 'activityDeleted',
  restore: 'activityRestored',
}

async function fetchHistory(table: string, recordId: string): Promise<readonly HistoryEntry[]> {
  const url = `/api/tables/${encodeURIComponent(table)}/records/${encodeURIComponent(recordId)}/history?sort=createdAt:desc`
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) return []
  const body = (await res.json()) as { readonly history?: readonly HistoryEntry[] }
  return body.history ?? []
}

/** A value as one line of text. */
const valueText = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

/** The fields an update moved, each as `<label>: <new value>`. */
function changedFields(entry: HistoryEntry, labelOf: (name: string) => string): readonly string[] {
  const before = (entry.changes?.['before'] ?? {}) as Readonly<Record<string, unknown>>
  const after = (entry.changes?.['after'] ?? {}) as Readonly<Record<string, unknown>>
  return Object.keys(after)
    .filter((name) => valueText(before[name]) !== valueText(after[name]))
    .filter((name) => labelOf(name) !== '')
    .map((name) => `${labelOf(name)}: ${valueText(after[name])}`)
}

/** One change, as a list item. */
function ActivityItem({
  entry,
  words,
  labelOf,
}: {
  readonly entry: HistoryEntry
  readonly words: ActivityWords
  readonly labelOf: (name: string) => string
}): ReactElement {
  const name = entry.userName ?? words['activitySomeone'] ?? 'Someone'
  const said = fillPlaceholders(words[ACTION_KEY[entry.action]] ?? '{name}', { name })
  const changes = entry.action === 'update' ? changedFields(entry, labelOf) : []
  return (
    <li className="border-border flex flex-col gap-1 border-b pb-2 text-sm">
      <span className="text-foreground">
        {said}
        <span className="text-muted-foreground"> · {relativeTimeText(entry.createdAt)}</span>
      </span>
      {changes.map((change) => (
        <span
          key={change}
          className="text-muted-foreground"
        >
          {change}
        </span>
      ))}
    </li>
  )
}

/** The Activity tab's panel. */
export function ActivityPanel({
  table,
  recordId,
  words,
  labelOf,
}: {
  readonly table: string
  readonly recordId: string
  readonly words: ActivityWords
  readonly labelOf: (name: string) => string
}): ReactElement {
  const history = useQuery({
    queryKey: ['record-drawer', 'history', table, recordId],
    queryFn: () => fetchHistory(table, recordId),
    retry: false,
    refetchOnWindowFocus: false,
  })
  if (history.data === undefined) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="text-muted-foreground text-sm"
      >
        {words['loading'] ?? 'Loading…'}
      </p>
    )
  }
  if (history.data.length === 0) {
    return <p className="text-muted-foreground text-sm">{words['activityEmpty']}</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {history.data.map((entry, index) => (
        <ActivityItem
          key={`${entry.createdAt}-${String(index)}`}
          entry={entry}
          words={words}
          labelOf={labelOf}
        />
      ))}
    </ul>
  )
}
