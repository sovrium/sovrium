/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type { Component } from '@/domain/models/app/pages/components'

/** The render-time-only key an SSO sign-in form's providers are stamped under. */
export const SSO_PROVIDERS_KEY = '_ssoProviders'

/** What the sign-in control draws per provider — never its protocol settings or secret. */
export interface StampedSsoProvider {
  readonly id: string
  readonly label: string
  readonly domains?: readonly string[]
}

/**
 * Stamp the providers an `auth` form with `strategy: 'sso'` draws a button for
 * into its props: every `auth.sso` entry, or only the one its `provider` names.
 * Only the id, the label and the domains travel — the domains so the control
 * can route an email without asking the server, and nothing a browser should
 * not hold. Any other component comes back unchanged.
 */
export const withSsoProviders = (component: Component, app: App): Component => {
  const { action } = component as {
    readonly action?: {
      readonly type?: unknown
      readonly strategy?: unknown
      readonly provider?: unknown
    }
  }
  if (component.type !== 'form' || action?.type !== 'auth' || action.strategy !== 'sso') {
    return component
  }
  const providers: readonly StampedSsoProvider[] = (app.auth?.sso ?? [])
    .filter((provider) => typeof action.provider !== 'string' || provider.id === action.provider)
    .map((provider) => ({
      id: provider.id,
      label: provider.label,
      ...(provider.domains === undefined ? {} : { domains: provider.domains }),
    }))
  return {
    ...component,
    props: { ...(component.props ?? {}), [SSO_PROVIDERS_KEY]: providers },
  } as Component
}
