/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * "Linked from": under a generic sheet's fields, one section per other table
 * whose relationship points at the opened record — named by that table's
 * plural label, with how many of its records point here and the first five,
 * each named the way a record names itself (`recordTitleOf`).
 *
 * A record listed here opens in the SAME sheet, stacked over the one it was
 * reached from, which a Back control returns to. The sheet declares no other
 * sheet to open it in — that is what `related` sections are for, and a sheet
 * declaring them shows them instead of this.
 */

import { useQuery } from '@tanstack/react-query'
import { recordTitleOf } from '@/domain/models/app/tables/record-title-service'
import type { RecordDrawerField } from './record-drawer-field'
import type { ReactElement } from 'react'

type Row = Readonly<Record<string, unknown>>

/** One section, as the server resolved it (`resolve-record-drawer-generic.ts`). */
export interface LinkedFromSection {
  readonly table: string
  readonly label: string
  readonly field: string
  readonly fields: ReadonlyArray<RecordDrawerField>
  readonly canEdit: boolean
}

/** A record of a linked table the reader chose, to open stacked. */
export interface LinkedPick {
  readonly section: LinkedFromSection
  readonly recordId: string
  readonly title: string
}

const idValue = (recordId: string): string | number =>
  /^\d+$/.test(recordId) ? Number(recordId) : recordId

async function fetchLinked(
  section: LinkedFromSection,
  recordId: string,
  limit: number
): Promise<{ readonly rows: readonly Row[]; readonly total: number }> {
  const condition = { field: section.field, operator: 'equals', value: idValue(recordId) }
  const params = new URLSearchParams({
    limit: String(limit),
    filter: JSON.stringify({ and: [condition] }),
  })
  const res = await fetch(`/api/tables/${encodeURIComponent(section.table)}/records?${params}`)
  if (!res.ok) return { rows: [], total: 0 }
  const body = (await res.json()) as {
    readonly records?: readonly (Row & { readonly fields?: Row })[]
    readonly pagination?: { readonly total?: number }
  }
  const rows = (body.records ?? []).map((row) => ({ ...row, ...(row.fields ?? {}) }))
  return { rows, total: body.pagination?.total ?? rows.length }
}

/** One table's section: its label and count, and its first records as buttons. */
function LinkedSection({
  section,
  recordId,
  limit,
  onPick,
}: {
  readonly section: LinkedFromSection
  readonly recordId: string
  readonly limit: number
  readonly onPick: (pick: LinkedPick) => void
}): ReactElement {
  const linked = useQuery({
    queryKey: ['record-drawer', 'linked-from', section.table, section.field, recordId],
    queryFn: () => fetchLinked(section, recordId, limit),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const rows = linked.data?.rows ?? []
  return (
    <section
      aria-label={section.label}
      className="flex flex-col gap-1"
    >
      <h4 className="text-foreground flex items-center gap-2 text-sm font-medium">
        {section.label}
        <span className="text-muted-foreground tabular-nums">{linked.data?.total ?? ''}</span>
      </h4>
      <ul className="flex flex-col">
        {rows.map((row) => {
          const id = String(row['id'] ?? '')
          const title = recordTitleOf(section.fields, row)
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onPick({ section, recordId: id, title })}
                className="text-foreground hover:bg-muted w-full rounded px-2 py-1 text-left text-sm"
              >
                {title}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** The "Linked from" block, or nothing when no other table points here. */
export function LinkedFrom({
  sections,
  recordId,
  limit,
  heading,
  onPick,
}: {
  readonly sections: readonly LinkedFromSection[]
  readonly recordId: string | undefined
  readonly limit: number
  readonly heading: string
  readonly onPick: (pick: LinkedPick) => void
}): ReactElement | undefined {
  if (sections.length === 0 || recordId === undefined) return undefined
  return (
    <div className="border-border flex flex-col gap-3 border-t pt-4">
      <h3 className="text-foreground text-md font-semibold">{heading}</h3>
      {sections.map((section) => (
        <LinkedSection
          key={`${section.table}.${section.field}`}
          section={section}
          recordId={recordId}
          limit={limit}
          onPick={onPick}
        />
      ))}
    </div>
  )
}
