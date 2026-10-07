/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * CAP-8 related sections of the record drawer.
 *
 * One compact, read-only list per `related` entry: the rows of another table
 * whose relationship column points at the record the drawer opened. Each is
 * read through the ordinary records endpoint — so under that table's own read
 * and field permissions — when the drawer opens, and again on every later
 * open: the query is keyed on the opened record and enabled only while the
 * drawer is open, and a zero `staleTime` makes re-enabling it re-read.
 *
 * No toolbar, no pager, no inline edit: a section is a glance. A row is a link
 * only when its entry says so (`onRowClick`), and the create affordance is
 * drawn only for a caller the SSR host found allowed to create in the table.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type KeyboardEvent, type ReactElement } from 'react'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import { dispatch } from '../runtime/event-bus'
import { nullable } from '../runtime/query-client'
import { readDisplayText } from '../runtime/record-display-label'
import { buildSortParam } from '../runtime/records-api'
import { ReadOnlyValue } from './record-drawer-read-only-value'
import { RelatedCreateForm } from './record-drawer-related-create'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'

type Row = Readonly<Record<string, unknown>>

/**
 * One related section as the SSR host resolved it (`resolve-record-drawer-related.ts`
 * builds this shape; the island cannot import across the render/islands line).
 */
export interface RelatedSection {
  readonly label: string
  readonly table: string
  readonly field: string
  readonly columns: readonly {
    readonly field: string
    readonly label: string
    readonly type: string
    readonly currency?: CurrencyDisplayOptions
  }[]
  readonly sort?: readonly { readonly field: string; readonly direction: 'asc' | 'desc' }[]
  readonly limit: number
  readonly emptyMessage?: string
  readonly onRowClick?: unknown
  readonly canCreate: boolean
}

/** The labels a section needs from the SSR host (it cannot resolve them itself). */
export interface RelatedLabels {
  readonly newRecord: string
  readonly save: string
  readonly cancel: string
  readonly createFailed: string
}

const SECTION_CLASS = 'border-border flex flex-col gap-2 border-t pt-4'
const HEADING_CLASS = 'text-foreground text-md font-semibold'
const TABLE_CLASS = 'w-full text-left text-sm'
const HEADER_CELL_CLASS = 'text-foreground-muted py-1 pr-2 font-medium'
const CELL_CLASS = 'text-foreground py-1 pr-2'
const LINK_ROW_CLASS = 'hover:bg-background-subtle cursor-pointer'
const EMPTY_CLASS = 'text-foreground-muted text-sm'
const CREATE_CLASS = 'text-primary self-start text-sm font-medium hover:underline'

/** An id travels as a number when it is one, so an integer relationship column matches it. */
function idValue(recordId: string): string | number {
  return /^\d+$/.test(recordId) ? Number(recordId) : recordId
}

/** The records URL of one section: filtered to the opened record, sorted, capped. */
function sectionUrl(section: RelatedSection, recordId: string): string {
  const params = new URLSearchParams({ limit: String(section.limit) })
  const sort = buildSortParam(section.sort)
  if (sort !== undefined) params.set('sort', sort)
  const condition = { field: section.field, operator: 'equals', value: idValue(recordId) }
  params.set('filter', JSON.stringify({ and: [condition] }))
  return `/api/tables/${encodeURIComponent(section.table)}/records?${params.toString()}`
}

/**
 * Read one section's rows. A refused read resolves to the NO-rows marker
 * (`undefined`, held as `null` by the query) rather than throwing: the SSR host already dropped sections the
 * caller may not read, so a refusal here is a race with a permission change,
 * and the section then draws nothing rather than an error banner.
 */
async function fetchSectionRows(url: string): Promise<readonly Row[] | undefined> {
  const response = await fetch(url)
  if (!response.ok) return undefined
  const body = (await response.json()) as {
    readonly records?: readonly (Row & { readonly fields?: Row })[]
  }
  return (body.records ?? []).map((row) => ({ ...row, ...(row.fields ?? {}) }))
}

/** A cell's text: empty for no value, JSON for a structured one. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * The handler of the entry's `onRowClick`, or `undefined` when a row is not a
 * link. A `navigate` target goes through the one canonical same-origin check
 * before it reaches `location` — the path is authored, but `$record.*` in it is
 * record data.
 */
function rowClickHandler(
  onRowClick: unknown,
  onReplace: () => void
): ((row: Row) => void) | undefined {
  const action = (onRowClick ?? {}) as {
    readonly type?: unknown
    readonly path?: unknown
    readonly action?: unknown
    readonly component?: unknown
  }
  if (action.type === 'navigate' && typeof action.path === 'string') {
    const { path } = action
    return (row) => {
      const target = toSafeRedirectPath(substituteRecordVars(path, row))
      if (target !== undefined) window.location.assign(target)
    }
  }
  if (action.action === 'openDrawer' && typeof action.component === 'string') {
    const { component } = action
    return (row) => {
      // One drawer at a time: the target opens on the row, this one closes.
      onReplace()
      dispatch('sovrium:open-drawer', { id: component, record: { ...row } })
    }
  }
  return undefined
}

/** The rows of one section, as a compact table. */
function RelatedTable({
  section,
  rows,
  onRow,
}: {
  readonly section: RelatedSection
  readonly rows: readonly Row[]
  readonly onRow: ((row: Row) => void) | undefined
}): ReactElement {
  const onKey = (row: Row) => (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === 'Enter') onRow?.(row)
  }
  return (
    <table className={TABLE_CLASS}>
      <thead>
        <tr>
          {section.columns.map((column) => (
            <th
              key={column.field}
              scope="col"
              className={HEADER_CELL_CLASS}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={cellText(row['id']) || String(index)}
            className={onRow === undefined ? undefined : LINK_ROW_CLASS}
            tabIndex={onRow === undefined ? undefined : 0}
            onClick={onRow === undefined ? undefined : () => onRow(row)}
            onKeyDown={onRow === undefined ? undefined : onKey(row)}
          >
            {section.columns.map((column) => (
              <td
                key={column.field}
                className={CELL_CLASS}
              >
                {readDisplayText(row, column.field) ?? (
                  <ReadOnlyValue
                    type={column.type}
                    value={row[column.field]}
                    label={column.label}
                    currency={column.currency}
                  />
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * The create affordance of one section: the button, then the inline form it
 * opens. `onCreated` re-reads the section so the new row appears in it.
 */
function RelatedCreate({
  section,
  recordId,
  labels,
  onCreated,
}: {
  readonly section: RelatedSection
  readonly recordId: string
  readonly labels: RelatedLabels
  readonly onCreated: () => void
}): ReactElement {
  const [creating, setCreating] = useState(false)
  if (!creating) {
    return (
      <button
        type="button"
        data-component-type="button"
        className={CREATE_CLASS}
        onClick={() => setCreating(true)}
      >
        {labels.newRecord}
      </button>
    )
  }
  return (
    <RelatedCreateForm
      section={section}
      linkValue={idValue(recordId)}
      labels={labels}
      onDone={(created) => {
        setCreating(false)
        if (created) onCreated()
      }}
    />
  )
}

/** Read one section's rows while the drawer is open, keyed on the opened record. */
function useSectionRows(section: RelatedSection, recordId: string, open: boolean) {
  const url = sectionUrl(section, recordId)
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['record-drawer', 'related', url],
    // `nullable`: TanStack rejects an `undefined` result, which would turn a
    // refused read into an error state that still draws the section.
    queryFn: nullable(() => fetchSectionRows(url)),
    enabled: open,
    // Zero, not the island client's 60 s default: a later open must re-read,
    // or a row added or edited meanwhile would not show until a minute passed.
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const reread = () =>
    void queryClient.invalidateQueries({ queryKey: ['record-drawer', 'related', url] })
  return { query, reread }
}

/** One related section: its heading, its rows or empty message, its create affordance. */
function RelatedSectionView({
  section,
  recordId,
  open,
  labels,
  onReplace,
}: {
  readonly section: RelatedSection
  readonly recordId: string
  readonly open: boolean
  readonly labels: RelatedLabels
  readonly onReplace: () => void
}): ReactElement | undefined {
  const { query, reread } = useSectionRows(section, recordId, open)
  // A refused read (`null` rows after the load) draws no section at all.
  if (query.isSuccess && query.data === null) return undefined
  const rows = query.data ?? []
  const showEmpty = query.isSuccess && rows.length === 0 && section.emptyMessage !== undefined
  return (
    <section
      aria-label={section.label}
      className={SECTION_CLASS}
    >
      <h3 className={HEADING_CLASS}>{section.label}</h3>
      {rows.length > 0 && (
        <RelatedTable
          section={section}
          rows={rows}
          onRow={rowClickHandler(section.onRowClick, onReplace)}
        />
      )}
      {showEmpty && <p className={EMPTY_CLASS}>{section.emptyMessage}</p>}
      {section.canCreate && (
        <RelatedCreate
          section={section}
          recordId={recordId}
          labels={labels}
          onCreated={reread}
        />
      )}
    </section>
  )
}

/**
 * Every related section of an open drawer, in declaration order. Nothing
 * renders before the drawer knows which record it opened.
 */
export function RecordDrawerRelated({
  sections,
  recordId,
  open,
  labels,
  onReplace,
}: {
  readonly sections: readonly RelatedSection[]
  readonly recordId: string | undefined
  readonly open: boolean
  readonly labels: RelatedLabels
  readonly onReplace: () => void
}): ReactElement | undefined {
  if (recordId === undefined) return undefined
  return (
    <>
      {sections.map((section) => (
        <RelatedSectionView
          key={`${section.table}:${section.field}:${section.label}`}
          section={section}
          recordId={recordId}
          open={open}
          labels={labels}
          onReplace={onReplace}
        />
      ))}
    </>
  )
}
