/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react'
import { computeSidebarEntryClasses } from '@/presentation/design/sidebar-default-classes'
import { buildSystemQueryUrl } from '../runtime/system-query-url'
import { toProjectedEntry, type ProjectedEntry } from './sidebar-entry-projection'

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
  props: Required<Omit<SidebarGroupsIslandProps, 'itemProps' | 'query' | 'rail'>> &
    Pick<SidebarGroupsIslandProps, 'itemProps' | 'query'>
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
      return entry ? [entry] : []
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
  query,
  rail,
}: SidebarGroupsIslandProps) {
  const [entries, setEntries] = useState<readonly ProjectedEntry[]>([])

  useEffect(() => {
    if (endpoint === undefined || labelKey === undefined || hrefTemplate === undefined) return
    // eslint-disable-next-line functional/no-let -- unmount guard for the async setState
    let live = true
    void fetchEntries({ endpoint, rowsKey, labelKey, hrefTemplate, itemProps, query }).then(
      (fetched) => {
        if (live) setEntries(fetched)
      }
    )
    return () => {
      live = false
    }
  }, [endpoint, rowsKey, labelKey, hrefTemplate, itemProps, query])

  // Nothing fetched (yet, or at all) renders nothing rather than an empty list:
  // the authored entries above are the sidebar until the rows arrive.
  if (entries.length === 0) return undefined

  return (
    <ul className="flex flex-col gap-0.5">
      {entries.map((entry) => (
        <li key={entry.href}>
          <a
            {...(entry.props ?? {})}
            href={entry.href}
            className={computeSidebarEntryClasses(false)}
            {...(rail !== true || entry.props?.['title'] !== undefined
              ? {}
              : { title: entry.label })}
          >
            <span>{entry.label}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
