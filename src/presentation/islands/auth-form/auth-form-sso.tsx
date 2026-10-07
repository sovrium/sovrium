/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState, type FormEvent } from 'react'
import { toSafeAssetUrl } from '@/domain/kernel/url/asset-url-safety'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { emailDomainOf, ssoProviderForEmail } from '@/domain/models/app/auth/sso/sso-service'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  AUTH_ERROR_BANNER_STYLE,
  computeAuthFeedbackBannerClasses,
  computeFormLayoutClasses,
} from '@/presentation/design/form-layout-classes'
import { computeInputDefaultClasses } from '@/presentation/design/input-default-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'

/** One identity provider as the sign-in control needs it: no secret ever reaches the browser. */
export interface SsoButtonProvider {
  readonly id: string
  readonly label: string
  readonly domains?: readonly string[]
}

export interface SsoSignInFormProps {
  readonly providers: readonly SsoButtonProvider[]
  readonly callbackUrl?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

const SIGN_IN_FAILED = 'Sign in failed. Please try again.'

/**
 * Start an SSO sign-in and follow it to the provider. The server answers the
 * provider's authorize URL (OIDC) or sign-on URL (SAML) as JSON; the browser
 * is then sent there. Resolves with an error message when nothing started.
 */
async function startSsoSignIn(
  providerId: string,
  callbackUrl?: string
): Promise<string | undefined> {
  const response = await fetch('/api/auth/sign-in/sso', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      providerId,
      callbackURL: toSafeRedirectPath(callbackUrl) ?? '/',
      errorCallbackURL: window.location.pathname,
    }),
  }).catch(() => undefined)
  if (response === undefined || !response.ok) return SIGN_IN_FAILED
  const body = (await response.json().catch(() => ({}))) as { readonly url?: unknown }
  const target = toSafeAssetUrl(body.url)
  if (target === undefined) return SIGN_IN_FAILED
  window.location.assign(target)
  return undefined
}

/** The message for an address no provider owns. */
const unroutableMessage = (email: string): string => {
  const domain = emailDomainOf(email)
  return domain === undefined
    ? 'Enter your work email address.'
    : `No sign-in provider is set up for ${domain}.`
}

function ProviderButton(props: {
  readonly provider: SsoButtonProvider
  readonly disabled: boolean
  readonly onStart: (providerId: string) => void
}) {
  const { provider, onStart } = props
  const handleClick = useCallback(() => onStart(provider.id), [onStart, provider.id])
  return (
    <button
      type="button"
      disabled={props.disabled}
      data-sso-provider={provider.id}
      onClick={handleClick}
      className={computeButtonDefaultClasses({ variant: 'secondary' })}
    >
      {provider.label}
    </button>
  )
}

function WorkEmailField(props: { readonly inputId: string; readonly disabled: boolean }) {
  return (
    <>
      <label htmlFor={props.inputId}>Work email</label>
      <input
        id={props.inputId}
        name="email"
        type="email"
        autoComplete="email"
        className={computeInputDefaultClasses({ state: 'default' })}
      />
      <button
        type="submit"
        disabled={props.disabled}
        className={`${computeButtonDefaultClasses()} w-full`}
      >
        Continue
      </button>
    </>
  )
}

function SsoError({ message }: { readonly message: string | undefined }) {
  if (message === undefined) return null
  return (
    <div
      role="alert"
      className={computeAuthFeedbackBannerClasses()}
      style={AUTH_ERROR_BANNER_STYLE}
    >
      {message}
    </div>
  )
}

/**
 * The hydrated SSO control: one button per provider, labelled with its
 * `label`, and — when any provider lists domains — a "Work email" field whose
 * domain picks the provider. An address on a domain no provider owns raises an
 * alert naming the domain and contacts nobody.
 */
export function SsoSignInForm(props: SsoSignInFormProps): React.ReactElement {
  const { providers, callbackUrl } = props
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const start = useCallback(
    (providerId: string): void => {
      setIsPending(true)
      setError(undefined)
      void startSsoSignIn(providerId, callbackUrl).then((failure) => {
        if (failure === undefined) return
        setError(failure)
        setIsPending(false)
      })
    },
    [callbackUrl]
  )

  const handleEmail = useCallback(
    (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault()
      const email = String(new FormData(event.currentTarget).get('email') ?? '').trim()
      const provider = ssoProviderForEmail(providers, email)
      if (provider === undefined) setError(unroutableMessage(email))
      else start(provider.id)
    },
    [providers, start]
  )

  return (
    <form
      onSubmit={handleEmail}
      className={resolveClasses(computeFormLayoutClasses(), props.className)}
      id={props.id}
      data-testid={props['data-testid']}
      noValidate
    >
      {providers.some((provider) => (provider.domains ?? []).length > 0) && (
        <WorkEmailField
          inputId={`${props.id ?? 'sso'}-work-email`}
          disabled={isPending}
        />
      )}
      <SsoError message={error} />
      {providers.map((provider) => (
        <ProviderButton
          key={provider.id}
          provider={provider}
          disabled={isPending}
          onStart={start}
        />
      ))}
    </form>
  )
}
