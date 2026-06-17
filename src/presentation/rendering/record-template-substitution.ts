/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { substituteRecordVars } from './data-source-resolver'


export function substituteRecordInInputData(
  inputData: Record<string, unknown>,
  record: Readonly<Record<string, unknown>>,
  substitute: (value: string, record: Readonly<Record<string, unknown>>) => string
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(inputData).map(([key, value]) => [
      key,
      typeof value === 'string' ? substitute(value, record) : value,
    ])
  )
}

export function substituteRecordInProps(
  props: Record<string, unknown>,
  record: Record<string, unknown>
): Record<string, unknown> {
  return substituteRecordInInputData(props, record, substituteRecordVars)
}

function substituteRecordInAction(action: unknown, record: Record<string, unknown>): unknown {
  if (action === null || typeof action !== 'object') return action
  const { inputData } = action as { inputData?: unknown }
  if (inputData === null || typeof inputData !== 'object' || Array.isArray(inputData)) return action
  const substituted = substituteRecordInInputData(
    inputData as Record<string, unknown>,
    record,
    substituteRecordVars
  )
  return { ...(action as Record<string, unknown>), inputData: substituted }
}

function substituteRecordInFields(fields: unknown, record: Record<string, unknown>): unknown {
  if (!Array.isArray(fields)) return undefined
  return fields.map((field) => {
    if (field === null || typeof field !== 'object') return field
    const { defaultValue } = field as { defaultValue?: unknown }
    if (typeof defaultValue !== 'string') return field
    return {
      ...(field as Record<string, unknown>),
      defaultValue: substituteRecordVars(defaultValue, record),
    }
  })
}

export function buildRecordTemplatePatch(
  component: { readonly action?: unknown; readonly fields?: unknown },
  record: Record<string, unknown>
): { action?: unknown; fields?: unknown } {
  const action = substituteRecordInAction(component.action, record)
  const fields = substituteRecordInFields(component.fields, record)
  return {
    ...(action !== undefined && { action }),
    ...(fields !== undefined && { fields }),
  }
}
