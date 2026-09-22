/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop --
   One picker is mounted per declaration and its handlers close over that
   picker's draft link set and search term, which is the state that re-renders
   it. Hoisting them would add indirection without removing render work. */

import { useId, type ReactElement } from 'react'
import { LinkedChips } from '../crud-form/record-picker-chrome'
import { LinkCountStrip, PickerSearchRow, ReadOnlyLinks } from './record-picker-chrome'
import { PickerSuggestions } from './record-picker-suggestions'
import { useStandalonePicker, type StandalonePicker } from './use-standalone-picker'
import type { CandidateScope } from '../record-candidates'

/**
 * `record-picker` — search another table and link the row you find.
 *
 * The UNBOUND picker. A `relationship` column already dispatches to
 * one wherever it is bound, and that is unchanged; what had no way to exist was
 * the same control on a page that is not a crud-form — a filter bar, a console
 * panel, a step in a wizard that writes somewhere else.
 *
 * It is not a `select`. A select resolves its options SERVER-side before render
 * and inlines them, which is why it is capped; this inlines nothing and fetches
 * one capped page per keystroke. Everything it shows came back from a search,
 * and the search is the server's: the author's `filter` travels in the request,
 * so a caller who replays that request cannot widen the candidate set past it.
 */

interface RecordPickerIslandProps {
  readonly dataSource?: {
    readonly table?: string
    readonly displayField?: string
    readonly filter?: CandidateScope['filter']
    readonly sort?: CandidateScope['sort']
    readonly pageSize?: number
  }
  readonly allowCreate?: boolean
  readonly multiple?: boolean
  readonly maxLinked?: number
  readonly placeholder?: string
  readonly readOnly?: boolean
  readonly label?: string
  readonly className?: string
  readonly id?: string
}

/** The author's narrowing and paging, as the shared candidate fetch takes it. */
function scopeOf(dataSource: RecordPickerIslandProps['dataSource']): CandidateScope {
  return {
    ...(dataSource?.filter && { filter: dataSource.filter }),
    ...(dataSource?.sort && { sort: dataSource.sort }),
    ...(dataSource?.pageSize !== undefined && { pageSize: dataSource.pageSize }),
  }
}

/** What is already linked: chips to unlink from, or the unset state in words. */
function LinkedRow({
  picker,
  placeholder,
}: {
  readonly picker: StandalonePicker
  readonly placeholder: string | undefined
}): ReactElement | undefined {
  const { linked } = picker
  if (linked.length === 0) {
    return placeholder === undefined ? undefined : (
      <span className="text-foreground-muted text-sm">{placeholder}</span>
    )
  }
  return (
    <LinkedChips
      ids={linked.map((entry) => entry.value)}
      labelOfId={(key) => linked.find((entry) => entry.value === key)?.label ?? key}
      onRemove={picker.remove}
    />
  )
}

/**
 * The editable picker: what is linked, the search, and what it is offering.
 *
 * AT THE CAP THE SEARCH CLOSES — it is not merely disabled. An affordance that
 * accepts input and discards it is worse than one that is not there: the reader
 * types a name, sees it match, clicks, and nothing happens.
 */
function PickerBody({
  picker,
  displayField,
  multiple,
  maxLinked,
  placeholder,
}: {
  readonly picker: StandalonePicker
  readonly displayField: string | undefined
  readonly multiple: boolean
  readonly maxLinked: number | undefined
  readonly placeholder: string | undefined
}): ReactElement {
  const listboxId = useId()
  return (
    <>
      <LinkedRow
        picker={picker}
        placeholder={placeholder}
      />
      {!picker.atCap && (
        <PickerSearchRow
          listboxId={listboxId}
          term={picker.search.term}
          expanded={picker.open}
          hasDisplayField={displayField !== undefined}
          onTerm={picker.setTerm}
          onOpen={picker.openPopup}
        />
      )}
      {!picker.atCap && picker.open && (
        <PickerSuggestions
          listboxId={listboxId}
          picker={picker}
          multiple={multiple}
        />
      )}
      {picker.createError !== undefined && (
        <span
          role="alert"
          className="text-foreground text-sm"
        >
          {picker.createError}
        </span>
      )}
      {maxLinked !== undefined && (
        <LinkCountStrip
          linked={picker.linked.length}
          maxLinked={maxLinked}
        />
      )}
    </>
  )
}

export default function RecordPickerIsland({
  dataSource,
  allowCreate,
  multiple,
  maxLinked,
  placeholder,
  readOnly,
  label,
  className,
  id,
}: RecordPickerIslandProps): ReactElement {
  const displayField = dataSource?.displayField
  const picker = useStandalonePicker({
    table: dataSource?.table ?? '',
    displayField,
    scope: scopeOf(dataSource),
    allowCreate: allowCreate === true,
    multiple: multiple === true,
    maxLinked,
  })

  if (readOnly === true) {
    return (
      <ReadOnlyLinks
        id={id}
        className={className}
        label={label}
        links={picker.linked}
        placeholder={placeholder}
      />
    )
  }

  return (
    <div
      id={id}
      className={`flex flex-col gap-1.5 ${className ?? ''}`}
      onClick={picker.openPopup}
    >
      {label !== undefined && <span className="text-foreground text-sm font-medium">{label}</span>}
      <PickerBody
        picker={picker}
        displayField={displayField}
        multiple={multiple === true}
        maxLinked={maxLinked}
        placeholder={placeholder}
      />
    </div>
  )
}
