/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A generic record sheet's header controls: "Copy link", which puts the
 * record's address on the clipboard, and "More actions", a menu holding
 * "Export as CSV" (the record's fields, one header row and one value row) and,
 * for a reader the table lets delete it, "Delete" — asked first, naming the
 * record. There is no "Duplicate": a record is not copied from its sheet.
 *
 * The copied address is the page's own with `?record=<id>` — never the sheet's
 * id or its open tab, which only matter to the page that wrote them.
 */

import { useState, type ReactElement, type ReactNode } from 'react'
import { fillPlaceholders } from '@/domain/kernel/format/placeholder-format'
import { withDisplayLabels } from '@/domain/models/app/pages/substitute-record-vars'
import { dispatch } from '../runtime/event-bus'
import { InlineConfirmDialog } from '../runtime/inline-confirm-dialog'
import { toFormValue } from './record-drawer-values'
import type { RecordDrawerField } from './record-drawer-field'

type RawRecord = Readonly<Record<string, unknown>>

const CONTROL_CLASS =
  'border-border text-foreground hover:bg-muted rounded-md border px-2.5 py-1 text-sm font-medium'
const MENU_CLASS =
  'border-border bg-popover absolute top-full right-0 z-50 mt-1 flex min-w-40 flex-col rounded-md border p-1 shadow-md'
const ITEM_CLASS = 'text-foreground hover:bg-muted rounded px-2 py-1.5 text-left text-sm'

/** The record's own address: this page with `?record=<id>`. */
const recordAddress = (recordId: string): string => {
  const params = new URLSearchParams(window.location.search)
  const kept = [...params].filter(([name]) => !['record', 'drawer', 'tab'].includes(name))
  const query = new URLSearchParams([['record', recordId], ...kept]).toString()
  return `${window.location.origin}${window.location.pathname}?${query}`
}

/** One CSV cell: quoted when it holds a separator, a quote or a line break. */
const csvCell = (text: string): string =>
  /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text

/** The record as two CSV lines: its field labels, then its values as the sheet reads them. */
function recordCsv(fields: ReadonlyArray<RecordDrawerField>, record: RawRecord): string {
  const shown = withDisplayLabels(record as Record<string, unknown>)
  const listed = fields.filter((field) => field.presence === undefined && !field.button)
  const header = listed.map((field) => csvCell(field.label ?? field.name)).join(',')
  const row = listed.map((field) => csvCell(toFormValue(shown[field.name]))).join(',')
  return `${header}\r\n${row}\r\n`
}

/** Hand the reader a file, as a download. */
function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** What the header controls act on, and in which words. */
export interface RecordMenuProps {
  readonly table: string
  readonly recordId: string
  readonly title: string
  readonly record: RawRecord
  readonly fields: ReadonlyArray<RecordDrawerField>
  readonly canDelete: boolean
  readonly words: Readonly<Record<string, string>>
  readonly cancelLabel: string | undefined
  readonly onDeleted: () => void
}

/** Delete the record, then refresh the lists showing it and close the sheet. */
async function deleteRecord(props: RecordMenuProps): Promise<void> {
  const { table, recordId } = props
  const res = await fetch(`/api/tables/${table}/records/${recordId}`, { method: 'DELETE' })
  if (!res.ok) return
  dispatch('sovrium:crud-success', { table, operation: 'delete', recordId })
  props.onDeleted()
}

/** The menu's items, inline under its button. */
function MenuItems(props: {
  readonly words: Readonly<Record<string, string>>
  readonly canDelete: boolean
  readonly onExport: () => void
  readonly onDelete: () => void
}): ReactNode {
  return (
    <div
      role="menu"
      aria-label={props.words['moreActions']}
      className={MENU_CLASS}
    >
      <button
        type="button"
        role="menuitem"
        className={ITEM_CLASS}
        onClick={props.onExport}
      >
        {props.words['exportCsv']}
      </button>
      {props.canDelete && (
        <button
          type="button"
          role="menuitem"
          className={`${ITEM_CLASS} text-destructive`}
          onClick={props.onDelete}
        >
          {props.words['delete']}
        </button>
      )}
    </div>
  )
}

/** Copy link, More actions, and the question a delete asks first. */
export function RecordMenu(props: RecordMenuProps): ReactElement {
  const { words } = props
  const [menuOpen, setMenuOpen] = useState(false)
  const [asking, setAsking] = useState(false)
  const onExport = (): void => {
    setMenuOpen(false)
    download(`${props.table}-${props.recordId}.csv`, recordCsv(props.fields, props.record))
  }
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="relative flex items-center gap-2">
        <button
          type="button"
          className={CONTROL_CLASS}
          onClick={() => void navigator.clipboard?.writeText(recordAddress(props.recordId))}
        >
          {words['copyLink']}
        </button>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={CONTROL_CLASS}
          onClick={() => setMenuOpen((open) => !open)}
          onKeyDown={(event) => event.key === 'Escape' && setMenuOpen(false)}
        >
          {words['moreActions']}
        </button>
        {menuOpen && (
          <MenuItems
            words={words}
            canDelete={props.canDelete}
            onExport={onExport}
            onDelete={() => {
              setMenuOpen(false)
              setAsking(true)
            }}
          />
        )}
      </div>
      {asking && (
        <InlineConfirmDialog
          prompt={fillPlaceholders(words['deletePrompt'] ?? 'Delete {title}?', {
            title: props.title,
          })}
          confirmLabel={words['delete'] ?? 'Delete'}
          onConfirm={() => void deleteRecord(props)}
          onCancel={() => setAsking(false)}
          {...(props.cancelLabel === undefined ? {} : { cancelLabel: props.cancelLabel })}
        />
      )}
    </div>
  )
}
