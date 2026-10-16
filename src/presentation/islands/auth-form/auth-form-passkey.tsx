/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState, type FormEvent } from 'react'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  AUTH_ERROR_BANNER_STYLE,
  AUTH_SUCCESS_BANNER_STYLE,
  computeAuthFeedbackBannerClasses,
  computeFormLayoutClasses,
} from '@/presentation/design/form-layout-classes'
import { pendingControlProps } from '@/presentation/design/pending-state'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { pressWhilePending } from '@/presentation/islands/runtime/pending-control'
import { dispatch as dispatchIslandEvent } from '../runtime/event-bus'

/** Which ceremony the control runs: save a new passkey, or sign in with one. */
export type PasskeyMode = 'register' | 'sign-in'

export interface PasskeyFormProps {
  readonly mode: PasskeyMode
  /** The button's label in the page language, resolved server-side. */
  readonly label?: string
  /** Every word the control reports (`passkey.*`), in the page language, resolved server-side. */
  readonly uiStrings?: Readonly<Record<string, string>>
  readonly callbackUrl?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

/** The catalogue key of each mode's failure. */
const FAILED: Record<PasskeyMode, string> = {
  register: 'passkey.addFailed',
  'sign-in': 'passkey.signInFailed',
}

const getJson = async (path: string): Promise<unknown> => {
  const response = await fetch(path, { credentials: 'same-origin' })
  if (!response.ok) throw new Error(String(response.status))
  return response.json()
}

const postJson = async (path: string, body: unknown): Promise<void> => {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(String(response.status))
}

/** The WebAuthn Level 3 JSON codecs, present in every current browser. */
const supportsJsonCodecs = (): boolean =>
  typeof PublicKeyCredential !== 'undefined' &&
  typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function'

/** The credential the authenticator produced, in the JSON form the server verifies. */
const credentialJson = (credential: Credential | null): unknown => {
  if (!(credential instanceof PublicKeyCredential)) throw new TypeError('no credential')
  return credential.toJSON()
}

/** Save a new passkey for the signed-in account. */
async function registerPasskey(): Promise<void> {
  const json = await getJson('/api/auth/passkey/generate-register-options')
  const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(
    json as PublicKeyCredentialCreationOptionsJSON
  )
  const credential = await navigator.credentials.create({ publicKey })
  await postJson('/api/auth/passkey/verify-registration', { response: credentialJson(credential) })
}

/** Sign in with a passkey the device already holds; no email is asked for. */
async function signInWithPasskey(): Promise<void> {
  const json = await getJson('/api/auth/passkey/generate-authenticate-options')
  const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(
    json as PublicKeyCredentialRequestOptionsJSON
  )
  const credential = await navigator.credentials.get({ publicKey })
  await postJson('/api/auth/passkey/verify-authentication', {
    response: credentialJson(credential),
  })
}

const NO_WORDS: Readonly<Record<string, string>> = {}

interface Outcome {
  readonly error?: string
  readonly success?: string
}

/**
 * Run the mode's ceremony; resolves with what to show, or navigates away on
 * sign-in. Its words are the server's: the island carries no English of its own.
 */
async function runCeremony(
  mode: PasskeyMode,
  words: Readonly<Record<string, string>>,
  callbackUrl?: string
): Promise<Outcome> {
  if (!supportsJsonCodecs()) return { error: words['passkey.unsupported'] }
  try {
    if (mode === 'register') {
      await registerPasskey()
      // A grid or list of the reader's passkeys on this page re-reads.
      dispatchIslandEvent('sovrium:refetch', { id: '/api/account/lists/passkeys' })
      return { success: words['passkey.added'] }
    }
    await signInWithPasskey()
  } catch {
    return { error: words[FAILED[mode]] }
  }
  const target = toSafeRedirectPath(callbackUrl ?? '/')
  if (target !== undefined) window.location.assign(target)
  return {}
}

function PasskeyFeedback({ outcome }: { readonly outcome: Outcome }) {
  if (outcome.error !== undefined) {
    return (
      <div
        role="alert"
        className={computeAuthFeedbackBannerClasses()}
        style={AUTH_ERROR_BANNER_STYLE}
      >
        {outcome.error}
      </div>
    )
  }
  if (outcome.success === undefined) return null
  return (
    <div
      role="status"
      className={computeAuthFeedbackBannerClasses()}
      style={AUTH_SUCCESS_BANNER_STYLE}
    >
      {outcome.success}
    </div>
  )
}

/**
 * The hydrated passkey control: one button. In `register` mode it saves a
 * passkey and reports "Passkey added"; in `sign-in` mode it signs in with one
 * and goes to the action's `onSuccess` destination.
 */
export function PasskeyForm(props: PasskeyFormProps): React.ReactElement {
  const { mode, callbackUrl } = props
  const words = props.uiStrings ?? NO_WORDS
  const [isPending, setIsPending] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>({})

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>): void => {
      if (pressWhilePending(event)) return
      event.preventDefault()
      setIsPending(true)
      setOutcome({})
      void runCeremony(mode, words, callbackUrl).then((next) => {
        setOutcome(next)
        if (next.error !== undefined || next.success !== undefined) setIsPending(false)
      })
    },
    [mode, words, callbackUrl]
  )

  const variant = mode === 'register' ? 'default' : 'secondary'
  return (
    <form
      onSubmit={handleSubmit}
      className={resolveClasses(computeFormLayoutClasses(), props.className)}
      id={props.id}
      data-testid={props['data-testid']}
    >
      <PasskeyFeedback outcome={outcome} />
      <button
        type="submit"
        {...pendingControlProps(isPending)}
        className={`${computeButtonDefaultClasses({ variant })} w-full`}
      >
        {props.label ?? words[mode === 'register' ? 'passkey.add' : 'passkey.signIn']}
      </button>
    </form>
  )
}
