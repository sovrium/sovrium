/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The auth action of a button (today: logout): its type guard and the
 * attributes the client runtime dispatches it from. A sibling of
 * `button-action-builders.ts`, as `button-navigate-action.ts` is.
 */

export type AuthButtonAction = {
  type: 'auth'
  method: string
  onSuccess?: { navigate?: string }
}

/**
 * Returns true if the given action is an auth action (e.g. a logout button).
 */
export function isAuthAction(action: unknown): action is AuthButtonAction {
  return (action as { type?: string })?.type === 'auth'
}

/**
 * Build data attributes for an auth-action button (today: logout). The client
 * runtime reads `data-auth-method` to dispatch the Better Auth call and
 * `data-auth-navigate` for the post-action redirect.
 */
export function buildAuthDataAttributes(action: AuthButtonAction): Record<string, string> {
  return {
    'data-action-type': 'auth',
    'data-auth-method': action.method,
    ...(action.onSuccess?.navigate && { 'data-auth-navigate': action.onSuccess.navigate }),
  }
}
