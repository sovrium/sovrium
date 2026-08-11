/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { substituteRecordVars } from './data-source-resolver'

/**
 * `$record.*` template substitution for the non-prop/content/children surfaces of
 * a collection-bound component — an action's `inputData` map and a form's
 * `fields[].defaultValue`. Kept in its own module so `data-source-resolver.ts`
 * stays under its `max-lines` cap.
 */

/**
 * Map every string value of a flat key→value map through a `$record.*`
 * substitution, leaving non-string values untouched. The substitution function
 * is injected so the two callers keep their own `null`-coercion contract:
 *   - the page renderer's `data-source-resolver.substituteRecordVars` (null → `'null'`),
 *   - the button renderer's `domain/utils.substituteRecordVars` (null → `''`).
 *
 * Both `substituteRecordInProps` / `substituteRecordInAction` (here) and the
 * automation-button renderer's `resolveInputDataRecordVars` share this loop.
 */
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

/** Substitute `$record.*` tokens in every string value of a props map. */
export function substituteRecordInProps(
  props: Record<string, unknown>,
  record: Record<string, unknown>
): Record<string, unknown> {
  return substituteRecordInInputData(props, record, substituteRecordVars)
}

/**
 * Substitute `$record.*` tokens inside an action's `inputData` map (used by
 * automation / fetch buttons). Returns the action unchanged when it has no
 * templated `inputData`. Non-string values pass through untouched.
 */
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

/**
 * Substitute `$record.*` tokens inside a form's `fields[]` (today: the
 * `defaultValue` of a hidden field that carries a parent FK). Returns `undefined`
 * when `fields` is not an array (so the caller can skip the spread).
 */
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

/**
 * Build the spreadable `{ action?, fields? }` patch for a collection-template
 * component — substituting `$record.*` in an action's `inputData` and a form's
 * `fields[].defaultValue`. Keys are present only when there is something to
 * spread, so the caller can `...patch` without clobbering absent fields.
 */
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
