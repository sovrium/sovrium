/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { callerTableOf, updatableFieldsOf } from './caller-table-inputs'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * The date fields a timeline's reader may move by dragging a bar's ends.
 *
 * Only a `resizable: true` timeline bound to a declared table offers any — a
 * system source is read-only — and only on the fields the records API would
 * let her change on a stored record: none when the table's `update` refuses
 * her, otherwise those whose write rule admits her (`updatableFieldsOf`, the
 * stamp the page made for her). Without a stamp (no auth, the full-access
 * model) both dates. `undefined` when it offers none.
 */
export function timelineResizeFields(component: Component): readonly string[] | undefined {
  const props = (component.props ?? {}) as Readonly<Record<string, unknown>>
  const binding = component.dataSource as { readonly table?: unknown } | undefined
  if (props['resizable'] !== true || typeof binding?.table !== 'string') return undefined
  const dates = [props['startField'], props['endField']].filter(
    (field): field is string => typeof field === 'string' && field !== ''
  )
  const callerTable = callerTableOf(component)
  const writable =
    callerTable === undefined
      ? dates
      : dates.filter((f) => updatableFieldsOf(callerTable).includes(f))
  return writable.length === 0 ? undefined : writable
}
