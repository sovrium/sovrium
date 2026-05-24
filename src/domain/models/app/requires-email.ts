/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { hasStrategy } from './auth'
import type { App } from '.'

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

export const appRequiresEmail = (app: App): boolean => {
  if (hasStrategy(app.auth, 'emailAndPassword')) return true
  if (hasStrategy(app.auth, 'magicLink')) return true

  const hasEmailAction =
    app.automations?.some((automation) =>
      collectActionTypes(automation.actions).includes('email')
    ) ?? false

  return hasEmailAction
}
