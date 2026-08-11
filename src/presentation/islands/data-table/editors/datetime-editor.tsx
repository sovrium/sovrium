/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable unicorn/no-null --
   `null` is the value that CLEARS a column: it is SQL NULL on the wire, while
   `undefined` is dropped by JSON.stringify and reaches the endpoint as "leave
   this field alone". The two are not interchangeable here — swapping them turns
   every clear gesture into a silent no-op. */

/* eslint-disable react-perf/jsx-no-new-function-as-prop --
   Cell-level editor: mounted per open cell, torn down on commit or cancel, and
   its handlers close over the draft instant. */

import { useState } from 'react'
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
 */

/** The zone used when the field declares none: the reader's own. */
const LOCAL_ZONE = 'local'

/**
 * Format an instant as the `YYYY-MM-DDTHH:mm` a `datetime-local` input holds,
 * with the wall-clock reading taken in `zone`.
 *
 * `Intl` is what does the zone arithmetic. Hand-rolling an offset would be
 * wrong twice a year for every zone that observes DST.
 */
function toLocalInputValue(value: unknown, zone: string): string {
  if (value === null || value === undefined || value === '') return ''
  const instant = new Date(String(value))
  if (Number.isNaN(instant.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-CA', {
    ...(zone !== LOCAL_ZONE && { timeZone: zone }),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instant)

  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? ''
  // `hour12: false` can render midnight as `24` in some ICU builds.
  const hour = part('hour') === '24' ? '00' : part('hour')
  return `${part('year')}-${part('month')}-${part('day')}T${hour}:${part('minute')}`
}

/**
 * Read a `datetime-local` wall-clock reading back as an instant in `zone`.
 *
 * The offset is measured by asking what wall-clock time the naive-UTC reading
 * lands on in the target zone, and correcting by the difference. That is the
 * inverse of {@link toLocalInputValue} and, unlike a fixed offset table, it is
 * right on both sides of a DST boundary.
 */
function fromLocalInputValue(local: string, zone: string): string | null {
  if (local.trim() === '') return null
  const naive = new Date(`${local}Z`)
  if (Number.isNaN(naive.getTime())) return null
  if (zone === LOCAL_ZONE) {
    const asLocal = new Date(local)
    return Number.isNaN(asLocal.getTime()) ? null : asLocal.toISOString()
  }

  const asZoned = new Date(toLocalInputValue(naive.toISOString(), zone) + 'Z')
  const offsetMs = asZoned.getTime() - naive.getTime()
  return new Date(naive.getTime() - offsetMs).toISOString()
}

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
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          commitLocal()
        }}
        className="border-primary focus:ring-focus-ring w-full rounded border px-1 py-0.5 text-sm focus:ring-1 focus:outline-none"
      />
    </EditorPopover>
  )
}
