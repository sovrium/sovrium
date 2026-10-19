/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computePartButtonClasses } from './button-variant-classes'

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

/** The classes of a confirm's affirming button, at the gate's `sm` size, in its weight. */
export const computeConfirmAffirmClasses = (destructive: boolean): string =>
  computePartButtonClasses({ variant: destructive ? 'destructive' : 'default', size: 'sm' })

/**
 * The affirming button of an OBJECT-form confirm, in the weight of the action it
 * confirms (`data-confirm-class`): destructive for a destructive action, the
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
      isDestructiveAction(componentRaw['variant'], componentRaw['action'])
    ),
  }
}
