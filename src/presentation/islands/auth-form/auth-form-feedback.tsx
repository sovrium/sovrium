/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  AUTH_ERROR_BANNER_STYLE,
  AUTH_SUCCESS_BANNER_STYLE,
  computeAuthFeedbackBannerClasses,
} from '@/presentation/design/form-layout-classes'
import type { AuthState } from './auth-form-submit'
import type { CredentialRefusal } from '@/domain/models/app/pages/components/action-operations'

/**
 * The next step, with the recovery link in it: where the line already holds
 * the link's words, those words become the link; otherwise the link follows.
 */
function NextStep({ refusal }: { readonly refusal: CredentialRefusal }) {
  const { description = '', recovery } = refusal
  if (recovery === undefined) return description ? <p>{description}</p> : null
  const { label, href } = recovery
  const at = description.indexOf(label)
  const end = at < 0 ? description.length : at + label.length
  return (
    <p>
      {at < 0 ? `${description} ` : description.slice(0, at)}
      <a
        href={href}
        className="underline underline-offset-4"
      >
        {label}
      </a>
      {description.slice(end)}
    </p>
  )
}

/**
 * The result banner of a credential auth form: the error, the success message,
 * or — before any result — an empty hidden slot matching the SSR skeleton. A
 * refused email and password draws the form's `credentialError` when it
 * declares one: the title, then the next step.
 */
export function AuthFormFeedback({
  state,
  refusal,
}: {
  readonly state: AuthState
  readonly refusal?: CredentialRefusal
}) {
  if (state.error) {
    const own = state.code === 'INVALID_EMAIL_OR_PASSWORD' ? refusal : undefined
    return (
      <div
        key="error"
        data-error=""
        role="alert"
        className={computeAuthFeedbackBannerClasses()}
        style={AUTH_ERROR_BANNER_STYLE}
      >
        {own === undefined ? (
          state.error
        ) : (
          <>
            <p className="font-medium">{own.title}</p>
            <NextStep refusal={own} />
          </>
        )}
      </div>
    )
  }
  if (state.success) {
    return (
      <div
        data-error=""
        data-success=""
        role="status"
        className={computeAuthFeedbackBannerClasses()}
        style={AUTH_SUCCESS_BANNER_STYLE}
      >
        {state.success}
      </div>
    )
  }
  // No result yet — an empty, hidden slot, out of layout and byte-identical to
  // the SSR skeleton's `<div data-error hidden />` (the banner is client-side only).
  // Keyed apart from the banner so a result INSERTS a fresh alert rather than
  // unhiding this slot: an inserted alert is announced, and arrives in order
  // before the onError toast.
  return (
    <div
      key="slot"
      data-error=""
      hidden
    />
  )
}
