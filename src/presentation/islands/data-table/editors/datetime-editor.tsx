/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop --
   Cell-level editor: mounted per open cell, torn down on commit or cancel, and
   its handlers close over the draft instant. */

import { useState } from 'react'
import { computeTableAddRowInputClasses } from '@/presentation/design/table-default-classes'
import {
  fromLocalInputValue,
  LOCAL_ZONE,
  toLocalInputValue,
} from '@/presentation/design/zoned-datetime'
import { resolvePageLocale } from '../../runtime/page-locale'
import { editMetaOf, type CellEditorProps } from './editor-contract'
import { EditorPopover } from './editor-popover'
import type { ReactElement } from 'react'

/**
 * The `datetime` cell editor.
 *
 * `datetime` was the worst of the eight fall-throughs: its sibling `date` got a
 * real picker while it got a plain text box, so the one type that most needs a
 * picker was the one that silently accepted prose and wrote it into a
 * `TIMESTAMPTZ`.
 *
 * The control DISPLAYS the instant resolved into the field's declared zone and
 * STORES an ISO-8601 instant. The zone comes from `timeZone` (capital Z) —
 * the same spelling `display-formatter.ts` reads — so the editor and the
 * read-only cell beside it agree by construction rather than by coincidence.
 * `DateTimeFieldSchema` also declares a lowercase `timezone` with no reader
 * anywhere; it is inert, and it is deliberately not forwarded to the browser so
 * that configuring it cannot look like it works.
 *
 * The zone arithmetic lives in `design/zoned-datetime`, shared with the form's
 * `datetime` control so the two surfaces agree on which instant a reading means.
 */

export function DateTimeEditor(props: CellEditorProps): ReactElement {
  const { value, commit, cancel, tabNext, fieldMeta, fieldName } = props
  const zone = editMetaOf(fieldMeta).timeZone ?? LOCAL_ZONE
  const [local, setLocal] = useState(() => toLocalInputValue(value, zone))

  const commitLocal = (): void => commit(fromLocalInputValue(local, zone))

  return (
    <EditorPopover
      label={`Edit ${fieldName ?? 'date and time'}`}
      cancel={cancel}
      tabValue={() => fromLocalInputValue(local, zone)}
      {...(tabNext && { tabNext })}
    >
      <input
        type="datetime-local"
        name={fieldName}
        // The picker's month names follow the page, where the browser honours it.
        lang={resolvePageLocale()}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          commitLocal()
        }}
        className={computeTableAddRowInputClasses()}
      />
    </EditorPopover>
  )
}
