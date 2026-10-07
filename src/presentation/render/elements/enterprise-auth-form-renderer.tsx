/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { computeFormLayoutClasses } from '@/presentation/design/form-layout-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import {
  SSO_PROVIDERS_KEY,
  type StampedSsoProvider,
} from '@/presentation/render/resolve/sso-provider-stamp'
import {
  resolveOnSuccessRedirect,
  type AuthFormAction,
  type AuthFormRenderContext,
} from './auth-form-action'
import { authSkeletonFormProps, buildAuthWrapperStyle } from './auth-form-renderer'
import { renderOAuthForm } from './oauth-form-renderer'
import type { ElementProps } from './html-element-renderer'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * The single sign-on and passkey sign-in controls. Both share the auth-form
 * island with the credential and social branches; `strategy` (or the
 * `registerPasskey` method) is the discriminant the island dispatches on.
 *
 * Like the social control, neither can do anything without JavaScript — a
 * sign-in through an identity provider answers JSON, and a passkey ceremony is
 * a browser API — so the SSR skeleton draws the controls `disabled` until the
 * island renders its live ones.
 */

/** The island host, wrapping a disabled skeleton the island replaces. */
function islandHost(
  props: ElementProps,
  islandProps: Record<string, unknown>,
  skeleton: ReactElement
) {
  return (
    <div
      data-island="auth-form"
      data-island-props={JSON.stringify({
        ...islandProps,
        'data-testid': props['data-testid'],
        id: props.id,
        className: props.className,
      })}
      data-component-type="form"
      data-testid={props['data-testid'] as string | undefined}
      style={buildAuthWrapperStyle(props.style)}
    >
      {skeleton}
    </div>
  )
}

/** The providers stamped on the component by the page resolver (`sso-provider-stamp.ts`). */
const stampedProviders = (component: Component | undefined): readonly StampedSsoProvider[] => {
  const stamped = (component?.props as Record<string, unknown> | undefined)?.[SSO_PROVIDERS_KEY]
  return Array.isArray(stamped) ? (stamped as readonly StampedSsoProvider[]) : []
}

/**
 * `strategy: sso` — one button per declared provider (or the one `provider`
 * names), plus a work-email field when any of them lists domains.
 */
function renderSsoForm(
  props: ElementProps,
  action: AuthFormAction,
  context: AuthFormRenderContext & { readonly component?: Component } = {}
): ReactElement {
  const providers = stampedProviders(context.component)
  const routesByDomain = providers.some((provider) => (provider.domains ?? []).length > 0)
  const skeleton = (
    <form
      {...authSkeletonFormProps(props)}
      method="post"
      className={resolveClasses(computeFormLayoutClasses(), props.className as string | undefined)}
    >
      {routesByDomain && (
        <button
          type="submit"
          disabled
          className={`${computeButtonDefaultClasses()} w-full`}
        >
          Continue
        </button>
      )}
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          disabled
          data-sso-provider={provider.id}
          className={computeButtonDefaultClasses({ variant: 'secondary' })}
        >
          {provider.label}
        </button>
      ))}
    </form>
  )
  return islandHost(
    props,
    {
      method: 'login',
      strategy: 'sso',
      ssoProviders: providers,
      redirectUrl: resolveOnSuccessRedirect(action, context.landingPath),
    },
    skeleton
  )
}

/**
 * `strategy: passkey` (sign in with a passkey) and `method: registerPasskey`
 * (save one for the signed-in account): one button each.
 */
function renderPasskeyForm(
  props: ElementProps,
  action: AuthFormAction,
  context: AuthFormRenderContext = {}
): ReactElement {
  const registers = action.method === 'registerPasskey'
  const label = resolveInterpreterString(
    registers ? 'passkey.add' : 'passkey.signIn',
    context.lang,
    context.languages
  )
  const skeleton = (
    <form
      {...authSkeletonFormProps(props)}
      method="post"
      className={resolveClasses(computeFormLayoutClasses(), props.className as string | undefined)}
    >
      <button
        type="submit"
        disabled
        className={`${computeButtonDefaultClasses({ variant: registers ? 'default' : 'secondary' })} w-full`}
      >
        {label}
      </button>
    </form>
  )
  return islandHost(
    props,
    {
      method: registers ? 'registerPasskey' : 'login',
      strategy: registers ? undefined : 'passkey',
      submitLabel: label,
      redirectUrl: resolveOnSuccessRedirect(action, context.landingPath),
    },
    skeleton
  )
}

/**
 * The single-control sign-in an auth action asks for — social (OAuth), SSO or
 * passkey — or `undefined` for any other action (the credential form takes it).
 */
export function renderStrategyAuthForm(
  props: ElementProps,
  action: AuthFormAction | undefined,
  context: AuthFormRenderContext & { readonly component?: Component }
): ReactElement | undefined {
  if (action?.type !== 'auth') return undefined
  if (action.strategy === 'oauth') return renderOAuthForm(props, action, context)
  if (action.strategy === 'sso') return renderSsoForm(props, action, context)
  if (action.strategy === 'passkey' || action.method === 'registerPasskey') {
    return renderPasskeyForm(props, action, context)
  }
  return undefined
}
