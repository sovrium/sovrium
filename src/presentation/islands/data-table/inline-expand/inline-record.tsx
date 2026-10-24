/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMemo, useState, type ReactElement } from 'react'
import { DrawerContent } from '../../overlays/record-drawer-content'
import { useRecordSave } from '../../overlays/record-drawer-save'
import { toEntryFormValues, type Values } from '../../overlays/record-drawer-values'
import { useDrawerHandlers } from '../../overlays/use-record-drawer-handlers'
import { FieldIdScope } from '../../parts/crud-form/field-id-scope'
import type { InlineExpandConfig } from './inline-expand-context'
import type { TableRecord } from '../../runtime/types'

const doNothing = (): void => undefined
const NO_WORDS = {}

/**
 * A row's record drawn under it: the record drawer's own body — the same
 * fields, the same controls, the same Save, which PATCHes the record through
 * its record route exactly as the panel does — seeded from the row the grid
 * already holds, so opening a row sends no request. Its draft's errors are kept
 * as the panel keeps them (`useDrawerHandlers`): an edit clears the banner and
 * that field's own message. A save re-reads the grid, which draws the saved
 * values. Its fields' lines are scoped by the record, so several rows open at
 * once never share an id.
 */
export default function InlineRecord({
  record,
  config,
  table,
}: {
  readonly record: TableRecord
  readonly config: InlineExpandConfig
  readonly table: string | undefined
}): ReactElement {
  const fields = config.recordFields
  // What the row last read: a save leaves out a link list still holding it.
  const loaded = useMemo(() => toEntryFormValues(record, fields), [record, fields])
  const [values, setValues] = useState<Values>(loaded)
  const handlers = useDrawerHandlers(setValues, doNothing)
  const recordId = record['id'] === undefined ? undefined : String(record['id'])
  const onSave = useRecordSave({
    recordFields: fields,
    values,
    loaded,
    table,
    recordId,
    setOpen: doNothing,
    setError: handlers.setError,
    setFieldErrors: handlers.setFieldErrors,
    words: NO_WORDS,
  })
  return (
    <FieldIdScope.Provider value={recordId === undefined ? '' : `record-${recordId}-`}>
      <DrawerContent
        fields={fields}
        values={values}
        record={record}
        canEdit={config.canEdit}
        onChange={handlers.onChange}
        onSave={onSave}
        onClose={doNothing}
        {...(table === undefined ? {} : { table })}
        saveLabel={config.saveLabel}
        {...(config.savingLabel === undefined ? {} : { savingLabel: config.savingLabel })}
        {...(config.actionStrings === undefined ? {} : { actionStrings: config.actionStrings })}
        {...(handlers.error === undefined ? {} : { error: handlers.error })}
        fieldErrors={handlers.fieldErrors}
      />
    </FieldIdScope.Provider>
  )
}
