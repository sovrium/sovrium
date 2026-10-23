/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useId, useRef, useState } from 'react'
import { computeSidebarGroupListClasses } from '@/presentation/design/sidebar-default-classes'
import { buildSystemQueryUrl } from '../runtime/system-query-url'
import { toProjectedEntry, type ProjectedEntry } from './sidebar-entry-projection'
import { FetchedEntry } from './sidebar-fetched-entry'
import { rowMarks } from './sidebar-row-marks'
import { useFetchedSidebarCurrent } from './use-fetched-sidebar-current'
import type { ChildrenSource } from './sidebar-fetched-children'

/**
 * The fetched half of a `sidebar` group: one navigation entry per row of a rows
 * envelope, projected through `labelKey` and `hrefTemplate`.
 *
 * ONLY the fetched half. The group's heading and its authored entries are
 * server-rendered by `renderSidebarGroups` and sit above this host untouched,
 * so navigation exists without JavaScript and this island stays small enough to
 * be worth loading: no query client, no icon set, no template engine.
 *
 * A sidebar must list what EXISTS at request time — that is the whole reason an
 * authored list is not enough — and the entries change with the data rather
 * than with the config, which is why they are fetched rather than pre-rendered.
 */

interface SidebarGroupsIslandProps {
  /** Rows endpoint, already `:param`-substituted server-side. */
  readonly endpoint?: string
  /** Key of the rows array in the response envelope. */
  readonly rowsKey?: string
  /** Row key whose value becomes each entry's label. */
  readonly labelKey?: string
  /** Entry href with `{field}` placeholders filled from the row. */
  readonly hrefTemplate?: string
  /**
   * Attributes rendered on EACH fetched entry, whose values carry the same
   * `{field}` placeholders `hrefTemplate` does.
   *
   * Without them a fetched entry is addressable only by the label the endpoint
   * happened to return — so the row listing a table cannot be pointed at until
   * someone already knows which tables exist.
   */
  readonly itemProps?: Readonly<Record<string, unknown>>
  /** Each entry's icon, `{field}`-filled from its row: a Lucide name or one emoji. */
  readonly icon?: string
  /** Each entry's badge, `{field}`-filled from its row; empty or `0` draws none. */
  readonly badge?: string
  /**
   * Static query params merged into the request — the group's own filter.
   *
   * The group source spreads the shared system source, so `query` decodes on it
   * exactly as it does on a `table` binding, and the schema names it as
   * supported. It has to reach the FETCH for that to mean anything: a filter
   * that decodes and is then dropped renders the unfiltered list, with nothing
   * for the author to notice.
   */
  readonly query?: Readonly<Record<string, string | number | boolean>>
  /**
   * Whether this group's sidebar is a rail below some breakpoint.
   *
   * Everything a rail PAINTS is a descendant rule on the navigation root, which
   * reaches these rows exactly as it reaches the server-rendered ones. The
   * tooltip is the one part that cannot travel that way — it is an attribute,
   * not a paint — and a fetched row is where a rail needs it most: its label is
   * the only thing naming it, and the endpoint decides what that label says.
   */
  readonly rail?: boolean
  /** How each row matches the address to mark itself current: `exact` (default) or `prefix`. */
  readonly activeMatch?: string
  /** A second fetched level: each row becomes a disclosure whose list loads on first expand. */
  readonly childrenSource?: ChildrenSource
  /** Whether the sidebar opted into client-side navigation tracking. */
  readonly track?: boolean
}

/**
 * GET the endpoint and project its rows.
 *
 * Never throws and never surfaces an error state: a sidebar whose fetched group
 * fails renders the authored entries above it and nothing more, which is a
 * degraded navigation rather than a broken page. `credentials: 'include'` so an
 * admin read endpoint authorizes the request.
 *
 * The URL comes from `buildSystemQueryUrl`, the same helper the KPI and chart
 * system reads use, so `endpoint` + static `query` resolve to one spelling
 * across every consumer of the shared source shape.
 */
async function fetchEntries(
  props: Required<
    Omit<
      SidebarGroupsIslandProps,
      'itemProps' | 'query' | 'rail' | 'activeMatch' | 'childrenSource' | 'track' | 'icon' | 'badge'
    >
  > &
    Pick<SidebarGroupsIslandProps, 'itemProps' | 'query' | 'icon' | 'badge'>
): Promise<readonly ProjectedEntry[]> {
  try {
    const response = await fetch(buildSystemQueryUrl(props), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return []
    const body = (await response.json()) as Record<string, unknown>
    const rows = body[props.rowsKey]
    if (!Array.isArray(rows)) return []
    return rows.flatMap((row: Readonly<Record<string, unknown>>) => {
      const entry = toProjectedEntry(row, props)
      return entry ? [{ ...entry, ...rowMarks(props, entry.row ?? row) }] : []
    })
  } catch {
    return []
  }
}

export default function SidebarGroupsIsland({
  endpoint,
  rowsKey = 'items',
  labelKey,
  hrefTemplate,
  itemProps,
  icon,
  badge,
  query,
  rail,
  activeMatch,
  childrenSource,
  track,
}: SidebarGroupsIslandProps) {
  const [entries, setEntries] = useState<readonly ProjectedEntry[]>([])
  const host = useRef<HTMLUListElement>(null)
  const current = useFetchedSidebarCurrent(entries, activeMatch, host)
  const listPrefix = useId()

  useEffect(() => {
    if (endpoint === undefined || labelKey === undefined || hrefTemplate === undefined) return
    let live = true
    const projection = { endpoint, rowsKey, labelKey, hrefTemplate, itemProps, icon, badge, query }
    void fetchEntries(projection).then((fetched) => {
      if (live) setEntries(fetched)
    })
    return () => {
      live = false
    }
  }, [endpoint, rowsKey, labelKey, hrefTemplate, itemProps, icon, badge, query])

  // Nothing fetched (yet, or at all) renders nothing rather than an empty list:
  // the authored entries above are the sidebar until the rows arrive.
  if (entries.length === 0) return undefined

  return (
    <ul
      ref={host}
      data-slot="sidebar-menu"
      className={computeSidebarGroupListClasses()}
    >
      {entries.map((entry, index) => (
        <FetchedEntry
          key={entry.href}
          entry={entry}
          current={entry.href === current}
          rail={rail}
          track={track}
          listId={`sbf${listPrefix.replaceAll(/[^A-Za-z0-9_-]/g, '')}-${String(index)}`}
          childrenSource={childrenSource}
        />
      ))}
    </ul>
  )
}
