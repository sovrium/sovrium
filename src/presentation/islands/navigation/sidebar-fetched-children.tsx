/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazy, Suspense, useMemo, type ReactElement } from 'react'
import { computeSidebarDisclosureRowClasses } from '@/presentation/design/sidebar-default-classes'
import { fillRowTemplate, type ProjectedEntry } from './sidebar-entry-projection'
import type { DisclosureSource } from './sidebar-disclosure-props'

/**
 * The disclosure, by the same `import()` the island registry uses, so its chunk
 * stays the one the registry mounts — a static import here would split it into
 * a shared chunk behind a facade, which every authored disclosure then pays
 * for. The group requests both chunks at once (`sidebar-fetched-entry`), so this
 * resolves from the module cache rather than starting a second round trip.
 */
const SidebarDisclosureIsland = lazy(() => import('./sidebar-disclosure-island'))

/** A second fetched level, its copy resolved on the server and its query still a template. */
export interface ChildrenSource extends DisclosureSource {
  readonly expandLabel: string
  readonly collapseLabel: string
}

/**
 * Fill a second fetched level's `query` from its PARENT row: each string value
 * takes the `{field}` grammar `hrefTemplate` speaks, unencoded (the URL builder
 * encodes it). `undefined` when the row cannot fill a placeholder — a children
 * list fetched with a literal `{name}` in its filter would list the wrong rows.
 */
function fillRowQuery(
  query: Readonly<Record<string, string | number | boolean>> | undefined,
  row: Readonly<Record<string, unknown>>
): Readonly<Record<string, string | number | boolean>> | undefined {
  if (query === undefined) return {}
  const filled = Object.entries(query).map(
    ([key, value]) =>
      [key, typeof value === 'string' ? fillRowTemplate(value, row, false) : value] as const
  )
  if (filled.some(([, value]) => value === undefined)) return undefined
  return Object.fromEntries(filled) as Readonly<Record<string, string | number | boolean>>
}

interface FetchedChildrenProps {
  /** The row's own link, drawn by the group so it shows before this chunk arrives. */
  readonly link: ReactElement
  readonly entry: ProjectedEntry
  readonly current: boolean
  readonly rail: boolean | undefined
  readonly track: boolean | undefined
  /** The list id this entry's disclosure governs, unique on the page. */
  readonly listId: string
  readonly childrenSource: ChildrenSource
}

/**
 * A fetched entry that opens onto its own fetched children: the row's link with
 * a toggle beside it, whose list is fetched on first expand with its `query`
 * filled from THIS row.
 *
 * Its own chunk, loaded only by a group whose source declares `childrenSource`:
 * a group of plain links never pays for the query filling, the toggle, the list
 * and its states. Until it arrives the group draws the plain link.
 *
 * The disclosure is the authored one's own component, called rather than
 * mounted as a nested island — a marker rendered after the mount pass is never
 * seen. It opens on arrival when the reader is on this entry's page, as an
 * authored disclosure opens on its current section. A row that cannot fill a
 * placeholder of the query stays a plain link.
 */
export default function FetchedChildren({
  link,
  entry,
  current,
  rail,
  track,
  listId,
  childrenSource,
}: FetchedChildrenProps) {
  const source = useMemo(() => {
    const query = fillRowQuery(childrenSource.query, entry.row ?? {})
    return query === undefined ? undefined : { ...childrenSource, query }
  }, [childrenSource, entry.row])
  if (source === undefined) return link
  return (
    <div className={computeSidebarDisclosureRowClasses()}>
      {link}
      <Suspense>
        <SidebarDisclosureIsland
          listId={listId}
          label={entry.label}
          href={entry.href}
          expandLabel={source.expandLabel}
          collapseLabel={source.collapseLabel}
          expanded={current}
          sectionCurrent={current}
          {...(track === true ? { track } : {})}
          {...(rail === true ? { rail } : {})}
          source={source}
        />
      </Suspense>
    </div>
  )
}
