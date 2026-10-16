/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A generic record sheet's Access tab: the accounts granted THIS record, read
 * from the grants listing narrowed to the sheet's table and the record
 * (`/api/tables/user_access/records?table_slug=&record_id=`) — each by name,
 * address and role.
 *
 * Read-only, and it says so: no control inside it, and a line saying where
 * grants change instead. The server offers the tab only on an
 * `auth.scopeTables` table and to an admin, the one reader the listing answers.
 */

import { useQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'

type Row = Readonly<Record<string, unknown>>

/** The words the tab draws, in the page language. */
export type AccessWords = Readonly<Record<string, string>>

/** A grant's value, read flat or under `fields`, as the records API answers it. */
const cellOf = (row: Row, name: string): string => {
  const fields = (row['fields'] ?? {}) as Row
  const value = row[name] ?? fields[name]
  return value === null || value === undefined ? '' : String(value)
}

async function fetchGrants(table: string, recordId: string): Promise<readonly Row[]> {
  const params = new URLSearchParams({ table_slug: table, record_id: recordId })
  const res = await fetch(`/api/tables/user_access/records?${params.toString()}`, {
    credentials: 'include',
  })
  if (!res.ok) return []
  return ((await res.json()) as { readonly records?: readonly Row[] }).records ?? []
}

const CELL_CLASS = 'py-1 pr-3 text-sm'

/** The Access tab's panel. */
export function AccessPanel({
  table,
  recordId,
  words,
}: {
  readonly table: string
  readonly recordId: string
  readonly words: AccessWords
}): ReactElement {
  const grants = useQuery({
    queryKey: ['record-drawer', 'access', table, recordId],
    queryFn: () => fetchGrants(table, recordId),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const rows = grants.data
  return (
    <section
      aria-label={words['accessRegion']}
      className="flex flex-col gap-3"
    >
      <p className="text-muted-foreground text-sm">{words['accessBody']}</p>
      {rows === undefined && (
        <p
          role="status"
          aria-live="polite"
          className="text-muted-foreground text-sm"
        >
          {words['loading']}
        </p>
      )}
      {rows !== undefined && rows.length === 0 && (
        <p className="text-muted-foreground text-sm">{words['accessEmpty']}</p>
      )}
      {rows !== undefined && rows.length > 0 && (
        <table className="w-full text-left">
          <thead>
            <tr className="text-muted-foreground">
              <th className={CELL_CLASS}>{words['accessName']}</th>
              <th className={CELL_CLASS}>{words['accessEmail']}</th>
              <th className={CELL_CLASS}>{words['accessRole']}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={cellOf(row, 'id') || String(index)}>
                <td className={CELL_CLASS}>{cellOf(row, 'user_name')}</td>
                <td className={CELL_CLASS}>{cellOf(row, 'user_email')}</td>
                <td className={CELL_CLASS}>{cellOf(row, 'role')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
