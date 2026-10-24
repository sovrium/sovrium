/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Everything a record drawer draws from, in one hook: its open lifecycle and
 * record (`useRecordDrawer`), the entries it shows — a new record's writable
 * ones, required ones marked — its handlers and Save, the body props every
 * surface shares, its name, and the linked record stacked over it.
 */

import { useEffect, useMemo, useState } from 'react'
import { createModeFields, optionalBodyProps, sheetTitle } from './record-drawer-body-props'
import { drawerHeaderParts, type SheetHeaderParts } from './record-drawer-navigation-slot'
import { EMPTY_RECORD } from './record-drawer-record-read'
import { useRelatedSlot } from './record-drawer-related-slot'
import { useRecordSave } from './record-drawer-save'
import { visibleForRecord } from './record-drawer-visibility'
import { useDrawerRecord, useRecordDrawer } from './use-record-drawer'
import { useDrawerHandlers } from './use-record-drawer-handlers'
import type { DrawerAction } from './record-drawer-actions'
import type { DrawerContentProps } from './record-drawer-content'
import type { RecordDrawerField } from './record-drawer-field'
import type { DrawerLabels, RecordDrawerIslandProps } from './record-drawer-island'
import type { LinkedPick } from './record-drawer-linked-from'

const EMPTY_FIELDS: ReadonlyArray<RecordDrawerField> = []
const EMPTY_ACTIONS: ReadonlyArray<DrawerAction> = []

/** The drawer's state, as `useRecordSheet` assembles it. */
export interface RecordSheet {
  readonly drawer: ReturnType<typeof useRecordDrawer>
  readonly content: DrawerContentProps
  readonly title: string
  /** The navigation and the record's place, drawn in the header beside the title. */
  readonly header: SheetHeaderParts
  readonly stacked: LinkedPick | undefined
  readonly setStacked: (pick: LinkedPick | undefined) => void
  /** The record read failed (after its one retry): there is no record to draw. */
  readonly readFailed: boolean
  /** Ask a failed table-record read again; absent for a system detail read. */
  readonly retry: (() => void) | undefined
}

/** The Save of the opened record — or of the new one. */
function useSheetSave(
  props: RecordDrawerIslandProps,
  state: {
    readonly drawer: ReturnType<typeof useRecordDrawer>
    readonly recordFields: ReadonlyArray<RecordDrawerField>
    readonly handlers: ReturnType<typeof useDrawerHandlers>
  }
) {
  const { drawer, recordFields, handlers } = state
  const words = props.generic?.words
  const saveWords = useMemo(
    () => ({
      failed: props.saveFailedLabel,
      // A sheet listing its own fields draws no generic words: the built-in one says it.
      createFailed: words?.['createFailed'] ?? props.builtInLabels?.createFailed,
      invalidJson: words?.['invalidJson'],
      refused: props.builtInLabels?.saveRefused,
    }),
    [
      props.saveFailedLabel,
      props.builtInLabels?.saveRefused,
      props.builtInLabels?.createFailed,
      words,
    ]
  )
  return useRecordSave({
    ...{ recordFields, values: drawer.values, table: props.table, recordId: drawer.recordId },
    loaded: drawer.loaded,
    ...{ creating: drawer.creating, setOpen: drawer.setOpen },
    ...{ setError: handlers.setError, setFieldErrors: handlers.setFieldErrors, words: saveWords },
  })
}

/**
 * The entries and footer actions the open record keeps under their
 * `visibleWhen`: what it hides is neither drawn nor saved. A record that has
 * not loaded yet keeps only the unconditional ones.
 */
function useVisibleEntries(
  props: RecordDrawerIslandProps,
  declaredFields: ReadonlyArray<RecordDrawerField>,
  creating: boolean,
  shown: Readonly<Record<string, unknown>>
) {
  const known = creating || Object.keys(shown).length > 0
  const recordFields = useMemo(
    () =>
      visibleForRecord(creating ? createModeFields(declaredFields) : declaredFields, shown, known),
    [creating, declaredFields, shown, known]
  )
  const actions = useMemo(
    () =>
      creating ? EMPTY_ACTIONS : visibleForRecord(props.actions ?? EMPTY_ACTIONS, shown, known),
    [creating, props.actions, shown, known]
  )
  return { recordFields, actions }
}

/** The request a server error failed the save under, as a body prop; absent when none. */
const failedRequestProp = (
  id: string | undefined,
  generic: RecordDrawerIslandProps['generic']
): Pick<DrawerContentProps, 'failedRequest'> =>
  id === undefined ? {} : { failedRequest: { id, words: generic?.words } }

/** The drawer's state — see the module note. */
export function useRecordSheet(props: RecordDrawerIslandProps, labels: DrawerLabels): RecordSheet {
  const { id, table, system } = props
  const declaredFields = props.recordFields ?? EMPTY_FIELDS
  const deepLink = props.deepLink !== false
  const drawer = useRecordDrawer({ id, table, system, deepLink, entries: declaredFields })
  const { open, recordId, creating } = drawer
  const [stacked, setStacked] = useState<LinkedPick | undefined>()
  useEffect(() => setStacked(undefined), [recordId, open])
  const { record, readFailed: systemFailed } = useDrawerRecord(
    system,
    recordId,
    drawer.record,
    props.recordText
  )
  const shown = creating ? EMPTY_RECORD : record
  const { recordFields, actions } = useVisibleEntries(props, declaredFields, creating, shown)
  const handlers = useDrawerHandlers(drawer.setValues, drawer.setOpen)
  const onSave = useSheetSave(props, { drawer, recordFields, handlers })
  const slotState = { open, recordId, save: labels.save, saving: labels.saving }
  const slot = useRelatedSlot(props, slotState, handlers.onClose)
  const header = creating ? {} : drawerHeaderParts(props, { record, recordId })
  const content: DrawerContentProps = {
    ...{
      fields: recordFields,
      values: drawer.values,
      record: shown,
      canEdit: props.canEdit ?? true,
    },
    ...{ loading: drawer.loading, unchanged: drawer.unchanged, actions },
    ...{ onChange: handlers.onChange, onSave, onClose: handlers.onClose },
    ...{ saveLabel: labels.save, savingLabel: labels.saving, labels: props.builtInLabels },
    fieldErrors: handlers.fieldErrors,
    ...(props.actionStrings === undefined ? {} : { actionStrings: props.actionStrings }),
    ...optionalBodyProps(handlers.error, table, props.childrenHtml, creating ? undefined : slot),
    ...failedRequestProp(handlers.requestId, props.generic),
  }
  const title = sheetTitle(
    {
      title: labels.title,
      fromRecord: props.titleFromRecord === true,
      creating,
      newLabel: props.generic?.newLabel,
      fields: declaredFields,
    },
    shown
  )
  const readFailed = systemFailed || drawer.readFailed
  const retry = drawer.readFailed ? drawer.retry : undefined
  return { drawer, content, title, header, stacked, setStacked, readFailed, retry }
}
