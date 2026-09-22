/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mapStringsDeep } from '@/domain/models/app/languages/translation-resolver'
import { substituteRecordVars } from '@/presentation/render/resolve/data-source-contracts'

/**
 * `$record.*` template substitution for the non-prop/content/children surfaces of
 * a collection-bound component — an action's `inputData` map and a form's
 * `fields[].defaultValue`. Kept in its own module so `data-source-resolver.ts`
 * stays under its `max-lines` cap.
 */

/**
 * Map every string value of a flat key→value map through a `$record.*`
 * substitution, leaving non-string values untouched.
 *
 * The substitution function stays INJECTED even though both callers now reach
 * the same implementation — the page renderer re-exports
 * `domain/utils.substituteRecordVars` and the button renderer imports it
 * directly. It used to be injected because the two disagreed on `null` (the
 * renderer's copy rendered the literal `'null'`); it is injected now because
 * this loop has no business knowing which substitutor its caller wants, and an
 * inlined import would silently re-fix that choice here.
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

/**
 * The constructs a record-supplied style declaration may not introduce.
 *
 * The same four `validateTailwindClassList` refuses inside an arbitrary class
 * value, for the same reason and minus `@import`, which a style declaration
 * cannot express. A style value cannot introduce a selector, but `url(` in one
 * is still a request to a third party made on the reader's behalf out of a value
 * the operator never saw.
 */
const EXTERNAL_REFERENCE = /url\(|image-set\(|attr\(|expression\(/i

/**
 * Substitute a style object's leaves, dropping any DECLARATION whose value came
 * from the record and smuggles an external reference.
 *
 * The declaration and not the element: losing a whole row to one bad value
 * leaves an operator with nothing to look at and no idea why.
 *
 * Only a value the record supplied is checked. A style the OPERATOR authored is
 * their own config and is left exactly as written — the exposure this closes is
 * a table field, which is the one row value an operator does not author.
 */
function substituteRecordInStyle(style: unknown, record: Record<string, unknown>): unknown {
  if (style === null || typeof style !== 'object' || Array.isArray(style)) {
    return mapStringsDeep(style, (value) => substituteRecordVars(value, record))
  }
  return Object.fromEntries(
    Object.entries(style as Record<string, unknown>).flatMap(([property, value]) => {
      if (typeof value !== 'string') return [[property, value] as const]
      const resolved = substituteRecordVars(value, record)
      const fromRecord = value.includes('$record.')
      if (fromRecord && EXTERNAL_REFERENCE.test(resolved)) return []
      return [[property, resolved] as const]
    })
  )
}

/**
 * Substitute `$record.*` tokens in every string LEAF of a props map.
 *
 * Deep, and it has to be. `props` is the one surface a row template has for
 * carrying a per-row VALUE — a bar drawn at its own width has nowhere else to
 * put it, since a config page has no arithmetic and no class it could compose
 * per row — and `style` is a nested object. A top-level-only pass left
 * `style: { width: '$record.value' }` in the response as literal text, which is
 * the failure mode that looks most like success: the element draws, at its
 * default size.
 *
 * `$param` was widened to every leaf for the reason its own module gives —
 * enumerating the keys a value is useful in means the pass silently stops
 * covering each new one — and `$record` was the last of the four `$`-references
 * still enumerating one.
 */
export function substituteRecordInProps(
  props: Record<string, unknown>,
  record: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => [
      key,
      key === 'style'
        ? substituteRecordInStyle(value, record)
        : mapStringsDeep(value, (str) => substituteRecordVars(str, record)),
    ])
  )
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
