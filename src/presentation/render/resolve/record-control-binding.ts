/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { CONTROL_ID_KEY } from '@/domain/models/app/pages/record-control-service'
import type { Component } from '@/domain/models/app/pages/components'

type Row = Readonly<Record<string, unknown>>

/**
 * A conditioned control's props (a `button` the page stamped an id on), told
 * which record it is drawn on as the record is substituted into it: its id,
 * which its press names, and the server's verdict on it (`_disabled`). A row
 * template and a single-record binding hand their children the record only as
 * substituted text, so without this a button there could not know either. A
 * node that already holds a record (`_record`) keeps it; any other node's props
 * are returned as they are.
 */
export const withControlRecord = (
  component: Component,
  props: Component['props'],
  record: Row
): Component['props'] => {
  if (typeof (component as Row)[CONTROL_ID_KEY] !== 'string') return props
  if ((props as Row | undefined)?.['_record'] !== undefined) return props
  const disabled = record['_disabled']
  return {
    ...(props ?? {}),
    _record: { id: record['id'], ...(Array.isArray(disabled) ? { _disabled: disabled } : {}) },
  } as Component['props']
}
