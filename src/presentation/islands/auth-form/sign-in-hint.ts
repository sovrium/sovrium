/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The address a completed password reset hands to the next sign-in form.
 *
 * Client-only, and only from what the reader typed in THIS browser: the
 * "forgot" form remembers its address for an hour (`localStorage`, since the
 * mailed link opens a new tab); a successful new password moves it into a
 * one-shot `sessionStorage` hint (same tab, which the reset navigates); the
 * next sign-in form fills its email, focuses its password and forgets the
 * hint. A link opened on another device simply finds nothing — the reset
 * endpoint names no account, so there is nothing else to read it from.
 *
 * Terse on purpose: every byte here ships with every auth form, and the
 * auth-form island sits at its mount-cost ceiling. Storage can throw (private
 * mode, a blocked origin); a hint that cannot be stored or read is simply
 * absent, so every access is guarded and nothing is reported.
 */

const RESET = 'sovrium:reset-email'
const HINT = 'sovrium:sign-in-email'

/** The "forgot" form's address, remembered (with when) for the reset that follows. */
export function rememberResetEmail(email: string): void {
  try {
    localStorage.setItem(RESET, `${Date.now()} ${email}`)
  } catch {
    // no storage: no hint
  }
}

/** A new password was saved: hand an address remembered within the hour to the next sign-in. */
export function handOverResetEmail(): void {
  try {
    const [at = '0', email] = (localStorage.getItem(RESET) ?? '').split(' ')
    localStorage.removeItem(RESET)
    if (email && Date.now() - Number(at) < 3_600_000) sessionStorage.setItem(HINT, email)
  } catch {
    // no storage: no hint
  }
}

/** A sign-in `form` mounted: fill its email from the hint and focus its password. */
export function applySignInHint(form: Element | null): void {
  try {
    const email = sessionStorage.getItem(HINT)
    sessionStorage.removeItem(HINT)
    const field = form?.querySelector<HTMLInputElement>('input[type=email]')
    if (!email || !field) return
    field.value = email
    form?.querySelector<HTMLInputElement>('input[type=password]')?.focus()
  } catch {
    // no storage: no hint
  }
}
