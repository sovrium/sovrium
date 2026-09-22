/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getStrategy, hasStrategy } from './auth'
import type { App } from '.'

/**
 * Recursively collect every action type in an automation, descending into the
 * `path` and `loop` action wrappers that nest their own action arrays.
 *
 * Exported for `appRequiresAi`, which asks the same question of the same tree
 * about a different literal. A nested `path`/`loop` walk that two predicates
 * both need is exactly the kind of thing that drifts when it is copied.
 */
export const collectActionTypes = (
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
 * Determine whether outgoing email is LOAD-BEARING for an app configuration —
 * i.e. whether something the app declares stops working when there is no
 * transport.
 *
 * Pure predicate over the app schema — it never reads `SMTP_HOST` or any other
 * environment variable. It only inspects the app's declared intent so callers
 * (the startup SMTP warning) can decide whether unconfigured email is a
 * degradation worth surfacing.
 *
 * Returns `true` when ANY of the following hold:
 * - auth uses the `magicLink` strategy — the message IS the credential, so
 *   without a transport nobody can sign in at all;
 * - email OTP is configured (`auth.emailTemplates.emailOtp`), which is what
 *   mounts the OTP plugin (`plugins/email-otp.ts`) — same reasoning;
 * - `emailAndPassword` declares `requireEmailVerification: true`, which holds a
 *   new account until it has verified an address it can never receive;
 * - any automation action (including nested in `path`/`loop`) is type `email` —
 *   an action the operator wrote that will now silently not happen.
 *
 * ── WHY BARE `emailAndPassword` IS NOT ON THAT LIST ────────────────────────
 *
 * It used to be, and the warning it produced had outlived its subject.
 * Passwords are the credential there; email is only ever a convenience, and
 * Sovrium already PRUNES the recovery affordances that would need a transport
 * when there is none — the forgot-password and reset-password routes are not
 * mounted and the recovery link is absent from the sign-in card. Nothing in the
 * running app is degraded, so there is nothing for the operator to act on. A
 * warning that survives the condition it described is noise, and the boot
 * banner is where noise costs the most: it trains an operator to skim the ⚠
 * block. Pinned by [internal ref] (silence) against [internal ref]
 * (a `magicLink` app still warns).
 *
 * The NAME still reads true under the narrowing: an app that sends a courtesy
 * message it can do without does not *require* email.
 */
export const appRequiresEmail = (app: App): boolean => {
  if (hasStrategy(app.auth, 'magicLink')) return true
  if (app.auth?.emailTemplates?.emailOtp !== undefined) return true
  if (getStrategy(app.auth, 'emailAndPassword')?.requireEmailVerification === true) return true

  const hasEmailAction =
    app.automations?.some((automation) =>
      collectActionTypes(automation.actions).includes('email')
    ) ?? false

  return hasEmailAction
}
