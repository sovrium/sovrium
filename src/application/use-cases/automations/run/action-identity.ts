/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The identity of an expanded action: what a step record is named after.
 *
 * The run loop works on actions after `$ref` expansion, where the decoded
 * action union is no longer a guarantee (template variables have been
 * substituted into the tree). These three fields are read with a type check
 * rather than a cast, so a non-string `operator` is dropped instead of being
 * recorded as one.
 */
export type ActionIdentity = {
  readonly name: string
  readonly type: string
  readonly operator?: string
}

export const readActionIdentity = (
  rawAction: Readonly<Record<string, unknown>>
): ActionIdentity => {
  const { name, type, operator } = rawAction
  return {
    name: String(name ?? ''),
    type: String(type ?? ''),
    ...(typeof operator === 'string' ? { operator } : {}),
  }
}

/**
 * Whether the action is a `webhook/response` step of a run no webhook started.
 * Such a step answers the webhook caller; a run another trigger started has no
 * caller waiting, so the step is passed over — at the top level and inside a
 * `path` or a `loop` alike.
 */
export const answersNoCaller = (
  rawAction: Readonly<Record<string, unknown>>,
  triggerType: string
): boolean =>
  rawAction['type'] === 'webhook' &&
  rawAction['operator'] === 'response' &&
  triggerType !== 'webhook'
