/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { oauthSubmitLabel } from '@/presentation/design/auth-form-types'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  buildAuthWrapperStyle,
  resolveOnSuccessRedirect,
  type AuthFormAction,
  type AuthFormRenderContext,
} from './auth-form-renderer'
import type { ElementProps } from './html-element-renderer'

/**
 * SSR skeleton for a social sign-in form: the author's `<form>` hosting ONE
 * submit button.
 *
 * The button is emitted server-side rather than left to the island so the
 * control exists — and is painted — before hydration, and so the hydrated
 * markup replaces it byte-for-byte. Only the author `style` differs between the
 * two, and deliberately: it stays on the island WRAPPER, which is what keeps
 * the "provider not configured" hide gate in force after the island mounts.
 */
function renderOAuthSkeleton(config: {
  readonly props: ElementProps
  readonly provider: string
}): ReactElement {
  const { props, provider } = config
  return (
    <form {...props}>
      <button
        type="submit"
        data-oauth-provider={provider}
        className={computeButtonDefaultClasses({ variant: 'secondary' })}
      >
        {oauthSubmitLabel(provider)}
      </button>
    </form>
  )
}

/**
 * Renders a social (OAuth) sign-in control as an auth-form island: one submit
 * button that starts Better Auth's social sign-in.
 *
 * ─── IT IS A BUTTON, AND THE BUTTON HAS TO RUN JAVASCRIPT ──────────────────
 *
 * This shipped as `<a href="/api/auth/sign-in/{provider}">` — a GET at a route
 * Better Auth does not declare. Every `/sign-in/*` endpoint it exposes is a
 * literal path, so that URL answered 404 on every run and social sign-in never
 * signed anyone in. A link was the intuitive choice, because the flow does end
 * in a navigation, and it is wrong twice: the endpoint that exists is
 * `POST /sign-in/social`, and it answers with JSON carrying the provider's
 * authorize URL rather than a 3xx — so a plain form POST would render that JSON
 * instead of following it. Whatever starts the flow must be able to READ a
 * response, which is why the control is an island and not markup. What the
 * reader activates is an ACTION, and a button is the element that says so.
 *
 * The action's `onSuccess` destination rides along as Better Auth's
 * `callbackURL`, the field it stores against the OAuth state and redirects to
 * once the provider comes back. It used to be stamped onto the `<form>` as
 * `data-redirect`, which no island, route or script ever read — and which could
 * never have worked, because the destination has to survive a round trip to the
 * provider and markup on a form nobody submits cannot. That attribute is gone.
 *
 * The `<form>` stays as the host for the author's `props` (`id`, `className`,
 * `data-testid`) — `#login-form` and `#oauth-form` resolve to it.
 *
 * KNOWN RESIDUAL: `onSuccess.type: 'role-landing'` resolves through the same
 * `resolveOnSuccessRedirect` the credential path uses, so it needs the app's
 * `auth.landingPath` threaded in via `context`. A caller that omits the context
 * gets the explicit `navigate` path and no per-role landing.
 */
export function renderOAuthForm(
  props: ElementProps,
  action: AuthFormAction,
  context: AuthFormRenderContext = {}
): ReactElement {
  const provider = action.provider ?? ''
  const callbackUrl = resolveOnSuccessRedirect(action, context.landingPath)

  const islandProps = JSON.stringify({
    method: 'login',
    strategy: 'oauth',
    provider,
    redirectUrl: callbackUrl,
    'data-testid': props['data-testid'],
    id: props.id,
    className: props.className,
  })

  return (
    <div
      data-island="auth-form"
      data-island-props={islandProps}
      data-testid={props['data-testid'] as string | undefined}
      style={buildAuthWrapperStyle(props.style)}
    >
      {/* SSR skeleton — the Suspense fallback, and the painted control the
          reader sees before the island mounts. */}
      {renderOAuthSkeleton({ props, provider })}
    </div>
  )
}
