/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  substituteRecordVars,
  withDisplayLabels,
} from '@/domain/models/app/pages/substitute-record-vars'
import {
  recordTitleOf,
  type TitleCandidateField,
} from '@/domain/models/app/tables/record-title-service'
import type { DrawerContentProps } from './record-drawer-content'
import type { RecordDrawerField } from './record-drawer-field'
import type { RawRecord } from './record-drawer-record-read'
import type { ReactElement } from 'react'

/**
 * Two values the record drawer derives for its body: the optional props it
 * spreads only when set, and its title with the record's tokens resolved.
 */

/**
 * The body props that must be ABSENT rather than `undefined`.
 * `exactOptionalPropertyTypes` distinguishes the two, so each is spread in only
 * when it has a value.
 */
export function optionalBodyProps(
  error: string | undefined,
  table: string | undefined,
  childrenHtml: string | undefined,
  related: ReactElement | undefined
): Partial<Pick<DrawerContentProps, 'error' | 'table' | 'childrenHtml' | 'related'>> {
  return {
    ...(error === undefined ? {} : { error }),
    ...(table === undefined ? {} : { table }),
    ...(childrenHtml === undefined ? {} : { childrenHtml }),
    ...(related === undefined ? {} : { related }),
  }
}

/**
 * The drawer's name for the record it holds: a title may name that record
 * (`$record.name`, `Role of $record.name`), and follows it when the drawer
 * opens on another one. A title with no token is returned as written.
 */
export function recordTitle(title: string, record: RawRecord): string {
  return substituteRecordVars(title, withDisplayLabels(record))
}

/** What names the sheet: its record , a new record's label, or the declared title. */
export interface SheetTitleInputs {
  /** The declared title, or — for an untitled table sheet — the server's best name. */
  readonly title: string
  /** The sheet declares no title: its record names it. */
  readonly fromRecord: boolean
  readonly creating: boolean
  /** "New quote", for a sheet opened to create a record. */
  readonly newLabel: string | undefined
  readonly fields: ReadonlyArray<TitleCandidateField>
}

/**
 * The sheet's name for what it holds. A new record goes by "New <label>"; an
 * untitled table sheet by its record's first text field holding a value, else
 * its id (`recordTitleOf`) — and, until the record lands, by the name the
 * server read for an address that opened it; a declared title is resolved
 * against the record as it always was.
 */
export function sheetTitle(inputs: SheetTitleInputs, record: RawRecord): string {
  if (inputs.creating && inputs.newLabel !== undefined) return inputs.newLabel
  if (!inputs.fromRecord) return recordTitle(inputs.title, record)
  const named = recordTitleOf(inputs.fields, record)
  return named === '' ? inputs.title : named
}

/**
 * A new record's entries: the ones its reader writes, a required one's label
 * marked `*` (`requiredMark`, drawn outside its accessible name) — its refusal
 * worded with the label as declared.
 */
export function createModeFields(
  fields: ReadonlyArray<RecordDrawerField>
): ReadonlyArray<RecordDrawerField> {
  return fields
    .filter((field) => field.readOnly !== true && field.presence === undefined && !field.button)
    .map((field) => {
      if (field.required !== true) return field
      const label = field.label ?? field.name
      return {
        ...field,
        requiredMark: true,
        requiredMessage: field.requiredMessage ?? `${label} is required`,
      }
    })
}
