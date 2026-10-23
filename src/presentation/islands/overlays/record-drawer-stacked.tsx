/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A record picked under "Linked from", opened STACKED in the sheet it was
 * picked in: its own table's fields — derived and gated for the reader by the
 * server, like the sheet's own — its own read, and its own Save, with a Back
 * control naming the record it was reached from. Saving, cancelling or going
 * back all return to that record; the sheet itself stays open.
 */

import { useCallback, useMemo, useState, type ReactElement } from 'react'
import { fillPlaceholders } from '@/domain/kernel/format/placeholder-format'
import { DrawerContent } from './record-drawer-content'
import { SheetFooter } from './record-drawer-footer'
import { ReadFailed } from './record-drawer-read-failed'
import { useTableRecordRead } from './record-drawer-record-read'
import { useRecordSave } from './record-drawer-save'
import { holdsLoadedValues, type Values } from './record-drawer-values'
import { useDrawerHandlers } from './use-record-drawer-handlers'
import type { LinkedPick } from './record-drawer-linked-from'

/** What a stacked record is drawn with. */
export interface StackedRecordProps {
  readonly pick: LinkedPick
  /** The record it was reached from, which Back names. */
  readonly from: string
  readonly words: Readonly<Record<string, string>>
  readonly save: { readonly label: string; readonly saving: string }
  /** A button field's run words (`action.*`) in the page language, as the sheet's own fields get. */
  readonly actionStrings?: Readonly<Record<string, string>> | undefined
  /** What a failed read says (`recordDrawer.readFailed`). */
  readonly readFailedLabel?: string | undefined
  /** The button that asks it again (`recordDrawer.retry`). */
  readonly retryLabel?: string | undefined
  readonly onBack: () => void
}

/** The way back to the record the stacked one was reached from. */
function BackButton(props: { readonly label: string; readonly onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onBack}
      className="text-muted-foreground hover:text-foreground self-start text-sm font-medium"
    >
      {props.label}
    </button>
  )
}

/** The stacked record's read, its draft, its handlers and its Save. */
function useStackedRecord(
  pick: LinkedPick,
  words: Readonly<Record<string, string>>,
  onBack: () => void
) {
  const { section, recordId } = pick
  const [values, setValues] = useState<Values>({})
  const read = useTableRecordRead({
    open: true,
    table: section.table,
    recordId,
    setValues,
    entries: section.fields,
  })
  const back = useCallback((open: boolean) => (open ? undefined : onBack()), [onBack])
  const handlers = useDrawerHandlers(setValues, back)
  const run = useRecordSave({
    recordFields: section.fields,
    values,
    table: section.table,
    recordId,
    record: read.record,
    setOpen: back,
    setError: handlers.setError,
    setFieldErrors: handlers.setFieldErrors,
    words: { invalidJson: words['invalidJson'] },
  })
  return { values, read, handlers, run }
}

/** The stacked record's body — see the module note. */
export function StackedRecordBody(props: StackedRecordProps): ReactElement {
  const { pick, words, onBack } = props
  const { section } = pick
  const { values, read, handlers, run } = useStackedRecord(pick, words, onBack)
  const save = useMemo(() => ({ ...props.save, run }), [props.save, run])
  const backButton = (
    <BackButton
      label={fillPlaceholders(words['back'] ?? 'Back to {title}', { title: props.from })}
      onBack={onBack}
    />
  )
  if (read.readFailed)
    return (
      <>
        {backButton}
        <ReadFailed
          label={props.readFailedLabel}
          retryLabel={props.retryLabel}
          onRetry={read.retry}
        />
      </>
    )
  return (
    <>
      {backButton}
      <DrawerContent
        fields={section.fields}
        values={values}
        record={read.record}
        canEdit={section.canEdit}
        loading={read.loading}
        onChange={handlers.onChange}
        onSave={run}
        onClose={onBack}
        table={section.table}
        saveLabel={props.save.label}
        savingLabel={props.save.saving}
        fieldErrors={handlers.fieldErrors}
        hideSave
        actionStrings={props.actionStrings}
        {...(handlers.error === undefined ? {} : { error: handlers.error })}
      />
      <SheetFooter
        record={read.record}
        words={words}
        canEdit={section.canEdit}
        loading={read.loading}
        unchanged={holdsLoadedValues(values, read.baseline)}
        save={save}
        onCancel={onBack}
      />
    </>
  )
}
