/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { hasStrategy } from './auth'
import type { App } from '.'

/**
 * Recursively collect every action type in an automation, descending into the
 * `path` and `loop` action wrappers that nest their own action arrays.
 */
const collectActionTypes = (
  actions: ReadonlyArray<{ readonly type: string; readonly props?: unknown }>
): readonly string[] =>
  actions.flatMap((action) => {
    const { props } = action as { readonly props?: Record<string, unknown> }

    const pathTypes =
      action.type === 'path' && props !== undefined
        ? ((
            props as {
              readonly paths?: ReadonlyArray<{
                readonly actions: ReadonlyArray<{ readonly type: string; readonly props?: unknown }>
              }>
            }
          ).paths?.flatMap((p) => collectActionTypes(p.actions)) ?? [])
        : []

    const loopTypes =
      action.type === 'loop' && props !== undefined
        ? collectActionTypes(
            (
              props as {
                readonly actions?: ReadonlyArray<{
                  readonly type: string
                  readonly props?: unknown
                }>
              }
            ).actions ?? []
          )
        : []

    return [action.type, ...pathTypes, ...loopTypes]
  })

/**
 * Determine whether an app configuration declares any capability that sends
 * outgoing email.
 *
 * Pure predicate over the app schema — it never reads `SMTP_HOST` or any other
 * environment variable. It only inspects the app's declared intent so callers
 * (e.g. the startup SMTP warning) can decide whether unconfigured email is a
 * problem worth surfacing.
 *
 * Returns `true` when ANY of the following hold:
 * - auth uses the `emailAndPassword` strategy (password reset / verification)
 * - auth uses the `magicLink` strategy (email-delivered sign-in links)
 * - any automation action (including nested in `path`/`loop`) is type `email`
 */
export const appRequiresEmail = (app: App): boolean => {
  if (hasStrategy(app.auth, 'emailAndPassword')) return true
  if (hasStrategy(app.auth, 'magicLink')) return true

  const hasEmailAction =
    app.automations?.some((automation) =>
      collectActionTypes(automation.actions).includes('email')
    ) ?? false

  return hasEmailAction
}
