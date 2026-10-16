/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a record drawer's surface holds between its title and its close
 * button: a linked record stacked over the one it was reached from, the one
 * state for a record the reader cannot see, a generic sheet's tabs, menu and
 * footer, or the declared sheet's body.
 */

import { useCallback, useMemo, type ReactElement } from 'react'
import { DrawerContent } from './record-drawer-content'
import { GenericSheetBody } from './record-drawer-generic'
import { StackedRecordBody } from './record-drawer-stacked'
import type { DrawerLabels, RecordDrawerIslandProps } from './record-drawer-island'
import type { RecordSheet } from './use-record-drawer-sheet'

const DEFAULT_NOT_FOUND_LABEL = 'This record could not be found.'

/**
 * A record the records API answers `404` — missing, or one its reader may not
 * read — shows the same state either way: nothing to edit, nothing to save.
 */
function NotFound({ label }: { readonly label: string | undefined }): ReactElement {
  return <p className="text-muted-foreground text-md">{label ?? DEFAULT_NOT_FOUND_LABEL}</p>
}

/** The drawer's body — see the module note. */
export function DrawerBody({
  props,
  labels,
  sheet,
}: {
  readonly props: RecordDrawerIslandProps
  readonly labels: DrawerLabels
  readonly sheet: RecordSheet
}): ReactElement {
  const { content, drawer, title, stacked, setStacked } = sheet
  const save = useMemo(
    () => ({ label: labels.save, saving: labels.saving, run: content.onSave }),
    [labels.save, labels.saving, content.onSave]
  )
  const generic = useMemo(() => ({ ...content, hideSave: true }), [content])
  const back = useCallback(() => setStacked(undefined), [setStacked])
  if (stacked !== undefined && props.generic !== undefined) {
    return (
      <StackedRecordBody
        pick={stacked}
        from={title}
        words={props.generic.words}
        save={save}
        actionStrings={props.actionStrings}
        onBack={back}
      />
    )
  }
  if (drawer.notFound) return <NotFound label={props.notFoundLabel} />
  if (props.generic === undefined || props.table === undefined)
    return <DrawerContent {...content} />
  return (
    <GenericSheetBody
      generic={props.generic}
      table={props.table}
      recordId={drawer.recordId}
      creating={drawer.creating}
      title={title}
      content={generic}
      save={save}
      cancelLabel={props.builtInLabels?.cancel}
      onClose={content.onClose}
      onPick={setStacked}
    />
  )
}
