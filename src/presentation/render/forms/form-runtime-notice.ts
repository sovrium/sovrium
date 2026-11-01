/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { INLINE_TOAST_POLICY_RUNTIME } from '../registry/inline-toast-policy-runtime'

/**
 * A hosted form's toasts, drawn in the page's shared notice region
 * (`[data-sonner-toaster]`, a `role="status"` live region) like every other
 * toast of the page, rather than as a loose element after the form. The toast
 * policy — timing, the dismiss control of a persistent toast, an assertive
 * failure — is the one transcription the other inline runtimes splice
 * (`inline-toast-policy-runtime.ts`).
 *
 * Each toast keeps the `data-form-toast="<form name>"` mark, so the field-error
 * pass can clear the form's last notice before the next submission.
 *
 * Assumes the surrounding IIFE provides `formName`, `removeIfPresent` and the
 * `S` strings map;
 * provides `renderToast(message, variant)`.
 */
export const FORM_RUNTIME_NOTICE_SCRIPT = `
${INLINE_TOAST_POLICY_RUNTIME}
  function renderToast(message, variant) {
    removeIfPresent(document.querySelector('[data-form-toast="' + formName + '"]'))
    // A page with no toast container of its own gets one named in its language.
    var region = ensureToastContainer()
    if (S['toast.dismiss'] && !region.getAttribute('data-dismiss-label')) {
      region.setAttribute('data-dismiss-label', S['toast.dismiss'])
    }
    showToast(message, variant || 'success')
    var shown = document.querySelectorAll('[data-sonner-toaster] [data-toast]')
    var toast = shown[shown.length - 1]
    if (toast) toast.setAttribute('data-form-toast', formName)
  }
`
