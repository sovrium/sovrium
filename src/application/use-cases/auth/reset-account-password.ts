/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Result } from 'effect'
import {
  AccountProvisioner,
  type PasswordReset,
} from '@/application/ports/services/account-provisioner'
import { isValidEmail } from '@/domain/kernel/sanitize/email-validation'

/** What one reset did: done, or refused with a message; `unknownAccount` when no account has the address. */
export type PasswordResetOutcome =
  | { readonly ok: true; readonly email: string }
  | {
      readonly ok: false
      readonly email: string
      readonly message: string
      readonly unknownAccount?: boolean
    }

const refusal = (email: string, message: string): PasswordResetOutcome => ({
  ok: false,
  email,
  message,
})

const resetOne = (
  reset: Readonly<PasswordReset>
): Effect.Effect<PasswordResetOutcome, never, AccountProvisioner> =>
  Effect.gen(function* () {
    if (!isValidEmail(reset.email)) {
      return refusal(reset.email, `Invalid email address: ${reset.email}`)
    }
    if (reset.password.length < 8) {
      return refusal(reset.email, 'Password must be at least 8 characters')
    }
    const done = yield* (yield* AccountProvisioner).resetPassword(reset).pipe(Effect.result)
    if (Result.isFailure(done)) {
      const { cause } = done.failure
      return refusal(reset.email, cause instanceof Error ? cause.message : String(cause))
    }
    return done.success.found
      ? { ok: true, email: reset.email }
      : {
          ok: false,
          email: reset.email,
          message: `No account has the address ${reset.email}.`,
          unknownAccount: true,
        }
  })

/**
 * `sovrium admin reset-password <email>`: give each existing account a new
 * password and sign every one of its sessions out.
 *
 * The recovery for a lost password, which `admin create` cannot be — it is
 * idempotent, and changes nothing for an address that already has an account.
 * An address with no account is refused: a reset never creates one. Every
 * failure is an outcome, never the error channel, as the seed account runs are.
 */
export const resetAccountPasswords = (
  resets: readonly PasswordReset[]
): Effect.Effect<readonly PasswordResetOutcome[], never, AccountProvisioner> =>
  Effect.forEach(resets, resetOne).pipe(Effect.withSpan('auth.reset-account-passwords'))
