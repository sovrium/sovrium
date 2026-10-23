/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef, useState } from 'react'
import { toApiConditions } from '../runtime/records-api'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'

/** What a counted tab binds to: a table, its filter or view, and the refresh a `kpi` takes. */
export interface TabCountSource {
  readonly table: string
  readonly view?: string
  readonly filter?: readonly DataFilter[]
  readonly refreshMode?: 'none' | 'poll' | 'realtime'
  readonly pollIntervalMs?: number
}

/** A poll with no interval of its own reads every 30 s, as every bound component does. */
const DEFAULT_POLL_MS = 30_000

/** A realtime count follows its table by reading again every 3 s. */
const REALTIME_POLL_MS = 3000

/** How often a count is read again, or never. */
const pollEvery = (source: TabCountSource | undefined): number | undefined => {
  if (source?.refreshMode === 'poll') return source.pollIntervalMs ?? DEFAULT_POLL_MS
  return source?.refreshMode === 'realtime' ? REALTIME_POLL_MS : undefined
}

/** The noun after the figure, singular and plural. */
export interface TabCountLabel {
  readonly one: string
  readonly other: string
}

/**
 * Where a count is asked: through a view, its records route counts what the
 * view serves this reader (`pagination.total`, one row asked for); bound to the
 * table, its aggregate.
 */
const countUrl = (source: TabCountSource): string => {
  const conditions = toApiConditions(source.filter)
  const params = new URLSearchParams(source.view === undefined ? {} : { limit: '1' })
  if (conditions.length > 0) params.set('filter', JSON.stringify({ and: conditions }))
  const route =
    source.view === undefined ? 'aggregate' : `views/${encodeURIComponent(source.view)}/records`
  const query = params.size === 0 ? '' : `?${params.toString()}`
  return `${window.location.origin}/api/tables/${encodeURIComponent(source.table)}/${route}${query}`
}

/** The figure an answer carries: the aggregate's count, or a view page's total. */
const figureOf = (
  answer: {
    readonly aggregations?: { readonly count?: unknown }
    readonly pagination?: { readonly total?: unknown }
  },
  throughView: boolean
): number | null => {
  const count = Number(throughView ? answer.pagination?.total : answer.aggregations?.count)
  return Number.isFinite(count) ? count : null
}

/**
 * The count, or `undefined` when the reader may not read the table, or the
 * read failed: a tab whose figure cannot be known draws its bare label, never
 * a zero that would say how many rows a refused table holds.
 */
const readCount = async (source: TabCountSource): Promise<number | null> => {
  try {
    const response = await fetch(countUrl(source), { credentials: 'same-origin' })
    if (!response.ok) return null
    return figureOf(
      (await response.json()) as Parameters<typeof figureOf>[0],
      source.view !== undefined
    )
  } catch {
    // A network failure is a figure not known, drawn as the bare label.
    return null
  }
}

/**
 * The live figure of one counted tab, read on mount and again on the binding's
 * refresh while the page is visible. Plain state rather than the page's query
 * cache: a tab strip draws on every page that has one, and the cache's weight
 * would ride with it.
 */
export function useTabCount(source: TabCountSource | undefined): number | undefined {
  const [count, setCount] = useState<number | undefined>(undefined)
  const sourceRef = useRef(source)
  sourceRef.current = source
  const question =
    source === undefined ? undefined : JSON.stringify([source.table, source.view, source.filter])
  const every = pollEvery(source)
  useEffect(() => {
    if (question === undefined) return undefined
    const state = { live: true }
    const read = (): void => {
      const { current } = sourceRef
      if (current === undefined) return
      void readCount(current).then((figure) => {
        if (state.live) setCount(figure ?? undefined)
      })
    }
    read()
    const timer =
      every === undefined
        ? undefined
        : setInterval(() => {
            if (!document.hidden) read()
          }, every)
    return () => {
      state.live = false
      if (timer !== undefined) clearInterval(timer)
    }
  }, [question, every])
  return count
}

/**
 * A trigger's caption with its figure: `Health · 2`, `Health · 1 problem`.
 * The bare label when there is no figure, or a zero the author did not ask to
 * show.
 */
export const countedTabLabel = (
  label: string,
  count: number | undefined,
  words: TabCountLabel | undefined,
  showZero: boolean | undefined
): string => {
  if (count === undefined || (count === 0 && showZero !== true)) return label
  const word = words === undefined ? '' : ` ${count === 1 ? words.one : words.other}`
  return `${label} · ${String(count)}${word}`
}
