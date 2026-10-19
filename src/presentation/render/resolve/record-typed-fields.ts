/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import { fillRecordIntoTypedField } from '@/presentation/render/elements/button-navigate-action'
import { withEditSelectRecord } from './edit-select-record'
import { fillProseField } from './record-template-substitution'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * The keys `substituteRecordInComponent` (`record-substitution.ts`) handles
 * itself, whose semantics (escaping, the plain-text pin, filters,
 * `visibility.record`) a blind string replace would destroy.
 */
const RECORD_SUBSTITUTION_OWN_KEYS = ['props', 'content', 'dataSource', 'children'] as const

/**
 * Substitute `$record.*` into a component's own TYPED fields — every string
 * leaf outside the four keys handled explicitly.
 *
 * A button picker's action keeps its field's token for the pick, and the node
 * gains the record's value of that field (`edit-select-record.ts`).
 *
 * Returns a PARTIAL meant to be spread over the component.
 */
export function substituteRecordInTypedFields(
  component: Component,
  record: Record<string, unknown>
): Partial<Component> {
  const substitute = (value: string): string =>
    value.includes('$record.') ? substituteRecordVars(value, record) : value

  return Object.fromEntries(
    Object.entries(withEditSelectRecord(component, record))
      .filter(([key]) => !(RECORD_SUBSTITUTION_OWN_KEYS as readonly string[]).includes(key))
      .map(([key, value]) => [
        key,
        fillProseField(key, value, record) ?? fillRecordIntoTypedField(key, value, substitute),
      ])
  ) as Partial<Component>
}
