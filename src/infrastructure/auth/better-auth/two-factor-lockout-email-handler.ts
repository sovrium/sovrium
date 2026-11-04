/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { twoFactorLockoutEmail } from '../../email/two-factor-lockout-email'
import { logMailFailure } from './mail-failure-log'
import type { sendEmail } from '../../email/email-service'
import type { EmailWords } from '../../email/email-words'

/** The account a lockout notice goes to. */
export interface LockedAccount {
  readonly email: string
  readonly name?: string
  readonly language?: string | null
}

/** Sends the notice that wrong codes locked an account's second sign-in step. */
export type TwoFactorLockoutNotifier = (account: LockedAccount, minutes: number) => Promise<void>

/**
 * The lockout notice, in the reader's language. Never throws: a notice that
 * could not be sent is logged, and the lock itself stands either way.
 */
export const createTwoFactorLockoutHandler =
  (
    appName: string | undefined,
    send: typeof sendEmail,
    wordsFor: (stored?: string | null) => EmailWords
  ): TwoFactorLockoutNotifier =>
  async (account, minutes) => {
    try {
      await send({
        to: account.email,
        fromName: appName,
        ...twoFactorLockoutEmail({
          appName,
          userName: account.name,
          minutes,
          words: wordsFor(account.language),
        }),
      })
    } catch (error) {
      logMailFailure('two-step lockout notice', account.email, error)
    }
  }
