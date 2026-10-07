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

/**
 * The result banner of a credential auth form: the error, the success message,
 * or — before any result — an empty hidden slot matching the SSR skeleton.
 */
export function AuthFormFeedback({ state }: { readonly state: AuthState }) {
  if (state.error) {
    return (
      <div
        data-error=""
        role="alert"
        className={computeAuthFeedbackBannerClasses()}
        style={AUTH_ERROR_BANNER_STYLE}
      >
        {state.error}
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
  return (
    <div
      data-error=""
      hidden
    />
  )
}
