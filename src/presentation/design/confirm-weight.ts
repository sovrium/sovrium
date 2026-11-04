/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computePartButtonClasses, PART_BUTTON_SM } from './button-variant-classes'
import { computeSolidDestructiveButtonClasses } from './destructive-solid-button-classes'

/**
 * Whether an action is destructive — what decides the weight of the button that
 * confirms it.
 *
 * A confirm asks before anything consequential; only a destructive one asks in
 * red. An action is destructive when its author says so (`variant:
 * 'destructive'`) or when it deletes: a request sent with `DELETE`, or a `crud`
 * delete. Pausing, retrying or resending is reversible, and its confirm uses the
 * default button — a red button over a reversible gesture reads as a warning the
 * action does not deserve.
 */
export const isDestructiveAction = (variant: unknown, action: unknown): boolean => {
  if (variant === 'destructive') return true
  if (typeof action !== 'object' || action === null) return false
  const { type, method, operation } = action as Readonly<Record<string, unknown>>
  if (type === 'crud') return operation === 'delete'
  return typeof method === 'string' && method.toUpperCase() === 'DELETE'
}

/**
 * The classes of a confirm's affirming button, at the gate's `sm` size, in its
 * weight: a solid destructive fill when the action cannot be undone, the
 * destructive tint for any other destructive action, the default button
 * otherwise.
 */
export const computeConfirmAffirmClasses = (destructive: boolean, irreversible = false): string =>
  irreversible
    ? computeSolidDestructiveButtonClasses(PART_BUTTON_SM)
    : computePartButtonClasses({ variant: destructive ? 'destructive' : 'default', size: 'sm' })

/** Whether a confirm declares that its action cannot be undone (`confirm.irreversible`). */
export const isIrreversibleConfirm = (confirm: unknown): boolean =>
  typeof confirm === 'object' &&
  confirm !== null &&
  (confirm as Readonly<Record<string, unknown>>)['irreversible'] === true

/**
 * The affirming button of an OBJECT-form confirm, in the weight of the action it
 * confirms (`data-confirm-class`): a solid destructive fill for a confirm declared
 * `irreversible`, the destructive tint for any other destructive action, the
 * default button otherwise. Decided on the server, because the gate is built by the
 * always-loaded client runtime, which carries no variant table.
 */
export const confirmWeightAttribute = (
  componentRaw: Record<string, unknown>
): Record<string, string> => {
  const { confirm } = componentRaw
  if (confirm === null || typeof confirm !== 'object') return {}
  return {
    'data-confirm-class': computeConfirmAffirmClasses(
      isDestructiveAction(componentRaw['variant'], componentRaw['action']),
      isIrreversibleConfirm(confirm)
    ),
  }
}
