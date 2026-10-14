/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record-creation dialog a "Create new record in <table>" quick action
 * opens: one labelled text control per text column the reader may read, posted
 * to the table's records endpoint.
 *
 * It exists only while open, so its labelled controls never collide with a
 * real form's fields on the page (`getByLabel('Name')` would otherwise resolve
 * twice). Its words come from the page language, stamped into the config.
 */

import { Dialog } from '@base-ui/react/dialog'
import {
  computeDialogContentClasses,
  computeDialogFooterClasses,
  computeDialogOverlayClasses,
  computeDialogTitleClasses,
} from '@/presentation/design/dialog-default-classes'
import { createTitle, type PaletteConfig } from './command-actions-data'
import type { ReactElement } from 'react'

const CONTROL =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

const BUTTON =
  'inline-flex h-8 items-center justify-center rounded-lg border px-2.5 text-sm font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

/** One labelled text control. */
function FieldRow({
  id,
  field,
}: {
  readonly id: string
  readonly field: { readonly name: string; readonly label?: string }
}): ReactElement {
  return (
    <div className="grid gap-2">
      <label
        htmlFor={id}
        className="text-sm font-medium"
      >
        {field.label ?? field.name}
      </label>
      <input
        id={id}
        name={field.name}
        type="text"
        className={CONTROL}
      />
    </div>
  )
}

export function CreateRecordDialog({
  config,
  table,
  onOpenChange,
}: {
  readonly config: PaletteConfig
  readonly table: string | undefined
  readonly onOpenChange: (open: boolean) => void
}): ReactElement {
  const fields = config.tables.find((candidate) => candidate.name === table)?.fields ?? []
  const title = table === undefined ? '' : createTitle(config, table)
  return (
    <Dialog.Root
      open={table !== undefined}
      onOpenChange={onOpenChange}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={computeDialogOverlayClasses()} />
        <Dialog.Popup
          data-create-record-dialog={table}
          data-slot="dialog-content"
          className={computeDialogContentClasses()}
        >
          <Dialog.Title className={computeDialogTitleClasses()}>{title}</Dialog.Title>
          <form
            method="post"
            action={`/api/tables/${table ?? ''}/records`}
            className="grid gap-4"
          >
            {fields.map((field) => (
              <FieldRow
                key={field.name}
                id={`create-${table ?? ''}-${field.name}`}
                field={field}
              />
            ))}
            <div className={computeDialogFooterClasses()}>
              <Dialog.Close
                type="button"
                data-create-record-close="true"
                className={`${BUTTON} border-border bg-background hover:bg-muted`}
              >
                {config.strings['cancel'] ?? 'Cancel'}
              </Dialog.Close>
              <button
                type="submit"
                className={`${BUTTON} bg-primary text-primary-foreground hover:bg-primary/80 border-transparent`}
              >
                {config.strings['create'] ?? 'Create'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
