/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A generic record sheet's footer, held at the bottom of the sheet while its
 * fields scroll: when and by whom the record last changed — "Edited 2 hours
 * ago by Hugo Renard", read from the table's updated-at and updated-by stamps,
 * and absent on a table that stamps none — then Cancel, which closes the sheet
 * and drops the edit, and Save.
 */

import { fillPlaceholders } from '@/domain/kernel/format/placeholder-format'
import { withDisplayLabels } from '@/domain/models/app/pages/substitute-record-vars'
import { DrawerSaveButton } from './record-drawer-content'
import { relativeTimeText } from './record-drawer-relative-time'
import type { ReactElement } from 'react'

type RawRecord = Readonly<Record<string, unknown>>

const FOOTER_CLASS =
  'border-border bg-background sticky bottom-0 -mx-4 -mb-4 mt-auto flex items-center gap-2 border-t px-4 py-3'
const CANCEL_CLASS =
  'border-border text-foreground hover:bg-muted text-md rounded border px-4 py-2 font-medium'
const SAVE_CLASS =
  'bg-primary text-primary-foreground text-md rounded px-4 py-2 font-medium disabled:cursor-not-allowed'

type Stamps = { readonly at: string; readonly by?: string }

/**
 * The name of the account that last changed the record, as the records API
 * labels it: the account id of the updated-by stamp, answered with its name
 * under `_display` for a reader who may read that stamp. `undefined` when the
 * record carries no such label (no stamp, an account since deleted).
 */
function editorName(record: RawRecord, stamps: Stamps | undefined): string | undefined {
  if (stamps?.by === undefined) return undefined
  const name = withDisplayLabels(record)[stamps.by]
  return typeof name === 'string' && name !== '' && name !== record['updatedBy'] ? name : undefined
}

/** "Edited <when> by <who>", or `undefined` when the record carries no stamp to read. */
function editedText(
  record: RawRecord,
  stamps: Stamps | undefined,
  name: string | undefined,
  edited: string | undefined
): string | undefined {
  if (stamps === undefined || edited === undefined || name === undefined) return undefined
  const time = relativeTimeText(record[stamps.at])
  return time === '' ? undefined : fillPlaceholders(edited, { time, name })
}

/** The sticky footer: the last change, then Cancel and Save for a reader who may edit. */
export function SheetFooter({
  record,
  stamps,
  words,
  canEdit,
  loading,
  unchanged,
  save,
  onCancel,
}: {
  readonly record: RawRecord
  readonly stamps?: Stamps | undefined
  readonly words: Readonly<Record<string, string>>
  readonly canEdit: boolean
  readonly loading: boolean
  /** The opened record still holds what it loaded: Save stays off. */
  readonly unchanged?: boolean | undefined
  readonly save: {
    readonly label: string
    readonly saving: string
    readonly run: () => Promise<void> | void
  }
  readonly onCancel: () => void
}): ReactElement {
  const name = editorName(record, stamps)
  const edited = editedText(record, stamps, name, words['edited'])
  return (
    <div className={FOOTER_CLASS}>
      {edited !== undefined && <p className="text-muted-foreground text-sm">{edited}</p>}
      <div className="ml-auto flex items-center gap-2">
        {canEdit && (
          <button
            type="button"
            className={CANCEL_CLASS}
            onClick={onCancel}
          >
            {words['cancel']}
          </button>
        )}
        {canEdit && (
          <DrawerSaveButton
            label={save.label}
            savingLabel={save.saving}
            loading={loading}
            unchanged={unchanged}
            onSave={save.run}
            className={SAVE_CLASS}
          />
        )}
      </div>
    </div>
  )
}
