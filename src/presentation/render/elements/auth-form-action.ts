/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'
import type { ButtonVariant } from '@/presentation/design/button-default-classes'

/** Per-field label/placeholder override declared on an auth action. */
export type AuthFieldOverride = {
  readonly name: string
  readonly label?: string
  readonly placeholder?: string
}

/**
 * Auth action shape for form rendering
 */
export type AuthFormAction = {
  readonly type: string
  readonly method?: string
  readonly strategy?: string
  readonly provider?: string
  /** `verifyTwoFactor`: which code it checks, and whether "Trust this device" is offered. */
  readonly factor?: string
  readonly trustDevice?: boolean
  /**
   * Stamped by the page pass on a sign-in form of an app offering passkeys, so
   * its email field invites the browser's passkey autofill. Never authored.
   */
  readonly _passkeyAutofill?: boolean
  /** Stamped by the invitation pass: the query key the page reads its token from. */
  readonly _invitationParam?: string
  /** Custom submit-button label (supports `$t:key`). Overrides the built-in. */
  readonly submitLabel?: string
  /** Custom in-flight (pending) submit-button label (supports `$t:key`). */
  readonly pendingLabel?: string
  /** The submit's weight, in the `button` component's variant vocabulary. */
  readonly submitVariant?: ButtonVariant
  /** Per-field label/placeholder overrides (each supports `$t:key`). */
  readonly fields?: readonly AuthFieldOverride[]
  readonly onSuccess?: {
    /**
     * Post-login redirect mode. `'role-landing'` sends the user to `auth.landingPath`, where the per-role
     * landing resolver redirects each role to its own `defaultLanding`.
     * Other/undefined values fall back to the explicit `navigate` path.
     */
    readonly type?: string
    readonly navigate?: string
    readonly toast?: { readonly message?: string; readonly variant?: string }
    /** `type: 'successPage'`: the page that replaces the form once its request is sent. */
    readonly title?: string
    readonly message?: string
  }
  readonly onError?: {
    readonly toast?: { readonly message?: string; readonly variant?: string }
  }
}

/**
 * Bundle of optional inputs threaded from the section renderer into
 * {@link renderAuthForm}: the bound table + component (for table-backed field
 * resolution) and the active page language + app translations (for `$t:key`
 * localization of submit/field labels). Bundled into one object to keep the
 * renderer parameter count under the ESLint `max-params` ceiling.
 */
export interface AuthFormRenderContext {
  readonly tables?: Tables
  readonly component?: Component
  readonly lang?: string
  readonly languages?: Languages
  /**
   * App-level `auth.landingPath`. When the
   * form's `onSuccess.type === 'role-landing'`, the post-login redirect target
   * resolves to this path; the existing per-role landing resolver
   * (render-page.tsx → resolveLandingPath) then routes each role onward.
   */
  readonly landingPath?: string
}

/**
 * Resolves the post-login redirect target for an auth form.
 *
 * `onSuccess.type === 'role-landing'` sends
 * the user to `auth.landingPath`; the per-role landing resolver then routes
 * each role to its own `defaultLanding`. When `landingPath` is not configured
 * the mode degrades gracefully to no redirect. Any other `onSuccess` shape
 * uses the explicit `navigate` path unchanged.
 */
export function resolveOnSuccessRedirect(
  action: AuthFormAction,
  landingPath?: string
): string | undefined {
  if (action.onSuccess?.type === 'role-landing') return landingPath
  return action.onSuccess?.navigate
}

/**
 * The success page an auth form declares (`onSuccess.type: 'successPage'`), with
 * its title and message — `$form.<field>` in them is filled in by the island
 * from what the reader typed.
 */
export function successPageOf(
  action: AuthFormAction
): { readonly title?: string; readonly message?: string } | undefined {
  const { onSuccess } = action
  if (onSuccess?.type !== 'successPage') return undefined
  return {
    ...(onSuccess.title !== undefined && { title: onSuccess.title }),
    ...(onSuccess.message !== undefined && { message: onSuccess.message }),
  }
}
