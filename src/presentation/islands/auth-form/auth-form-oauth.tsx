/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState, type FormEvent } from 'react'
import { oauthSubmitLabel } from '@/presentation/design/auth-form-types'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { startSocialSignIn } from './auth-form-submit'

export interface OAuthSignInFormProps {
  /** Provider handle from the action's `provider` field, e.g. `google`. */
  readonly provider: string
  /**
   * Where the reader lands once the provider comes back — the action's
   * resolved `onSuccess` destination, handed to Better Auth as `callbackURL`.
   * Absent when the action declares no destination, in which case Better Auth
   * applies its own default.
   */
  readonly callbackUrl?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

/**
 * The hydrated social sign-in control: ONE submit button inside the author's
 * form.
 *
 * The handler sits on the form's `onSubmit` rather than on the button's
 * `onClick` so a keyboard Enter starts the flow exactly like a pointer click,
 * and so `preventDefault` reliably suppresses the native GET the SSR skeleton's
 * `type="submit"` would otherwise fire.
 *
 * The markup is deliberately byte-identical to the skeleton the renderer emits
 * (`renderOAuthSkeleton` in `auth-form-renderer.tsx`) apart from the author
 * `style`, which stays on the island WRAPPER so the "provider not configured"
 * hide gate survives hydration. Matching markup is what keeps the button from
 * reflowing or losing its ground when the island mounts.
 */
export function OAuthSignInForm(props: OAuthSignInFormProps): React.ReactElement {
  const { provider, callbackUrl } = props
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault()
      setIsPending(true)
      // Better Auth's own client performs the navigation on success (see
      // `startSocialSignIn`). On a credentialed failure the flow simply does
      // not leave the page; the button is re-enabled so it can be retried.
      void startSocialSignIn({ provider, callbackURL: callbackUrl }).then((error) => {
        if (error) setIsPending(false)
      })
    },
    [provider, callbackUrl]
  )

  return (
    <form
      onSubmit={handleSubmit}
      className={props.className}
      id={props.id}
      data-testid={props['data-testid']}
    >
      <button
        type="submit"
        disabled={isPending}
        data-oauth-provider={provider}
        className={computeButtonDefaultClasses({ variant: 'secondary' })}
      >
        {oauthSubmitLabel(provider)}
      </button>
    </form>
  )
}
