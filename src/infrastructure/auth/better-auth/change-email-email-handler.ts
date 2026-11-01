/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { withTokenOnce } from '../../email/auth-link-emails'
import { changeEmailEmail, type ChangeEmailStep } from '../../email/change-email-emails'
import { sendEmail } from '../../email/email-service'
import { recipientEmailWords, type EmailWords } from '../../email/email-words'
import { logError } from '../../logging'
import type { Auth } from '@/domain/models/app/auth'
import type { Languages } from '@/domain/models/app/languages'

/** The account an email-change message is about. */
export interface ChangeEmailUser {
  readonly email: string
  readonly name?: string
  readonly language?: string | null
}

/** A link Better Auth asks to be mailed: the account it was minted for, the link, its token. */
export interface MailedLink {
  readonly user: ChangeEmailUser
  readonly url: string
  readonly token: string
}

export type VerificationSender = (link: MailedLink) => Promise<void>

interface ChangeEmailMailer {
  readonly appName: string | undefined
  readonly send: typeof sendEmail
  readonly wordsFor: (stored?: string | null) => EmailWords
}

/**
 * Send one email of the change, to `to`. Never throws: a message that could
 * not be sent is logged, as every auth email is, so the answer to the request
 * says nothing about whether the mail left.
 */
const sendStep = async (
  mailer: ChangeEmailMailer,
  step: ChangeEmailStep,
  link: MailedLink & { readonly to: string; readonly newEmail: string }
): Promise<void> => {
  try {
    await mailer.send({
      to: link.to,
      fromName: mailer.appName,
      ...changeEmailEmail({
        step,
        appName: mailer.appName,
        userName: link.user.name,
        newEmail: link.newEmail,
        actionUrl: withTokenOnce(link.url, link.token),
        words: mailer.wordsFor(link.user.language),
      }),
    })
  } catch (error) {
    logError(`[EMAIL] Failed to send email-change ${step} email to ${link.to}`, error)
  }
}

/**
 * The first step of an email change, Better Auth's `sendChangeEmailConfirmation`:
 * the CURRENT address is told someone asked to move the account to `newEmail`,
 * and holds the only link that lets the change go on. Nothing is sent to the
 * new address until that link is followed.
 */
const changeEmailConfirmationHandler =
  (mailer: ChangeEmailMailer) =>
  async (data: MailedLink & { readonly newEmail: string }): Promise<void> =>
    sendStep(mailer, 'confirm', { ...data, to: data.user.email })

/** The `requestType` an email-verification token was minted for, read from its own payload. */
const requestTypeOf = (token: string): string | undefined => {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as {
      readonly requestType?: unknown
    }
    return typeof payload.requestType === 'string' ? payload.requestType : undefined
  } catch {
    // Not a token Better Auth minted for a change: the sign-up verification.
    return undefined
  }
}

/**
 * Better Auth sends the new address's verification through the same callback
 * as a sign-up's (`emailVerification.sendVerificationEmail`), with the account
 * already carrying the new address. The token says which it is: a change goes
 * out as the built-in change message, never as a welcome, unless the app
 * declares its own `verification` template, whose words then serve both (the
 * operator's choice). Anything else goes to `signUp`.
 */
const withChangeEmailVerification =
  (
    signUp: VerificationSender,
    mailer: ChangeEmailMailer,
    customTemplate: boolean
  ): VerificationSender =>
  async (link) =>
    !customTemplate && requestTypeOf(link.token) === 'change-email-verification'
      ? sendStep(mailer, 'verify', { ...link, to: link.user.email, newEmail: link.user.email })
      : signUp(link)

/** What {@link changeEmailMailers} reads of the app. */
interface ChangeEmailApp {
  readonly name?: string
  readonly languages?: Languages
}

/**
 * The two senders an instance hands Better Auth for a change of address, in
 * the reader's language, through the shared mailer: `confirmation` for the
 * current address, and `verification`, which mails a change as a change and
 * passes every other verification to the app's own `signUp` sender. `send`
 * is the transport, injected by a unit test.
 */
export const changeEmailMailers = (
  signUp: VerificationSender,
  authConfig: Auth | undefined,
  app: ChangeEmailApp | undefined,
  send: typeof sendEmail = sendEmail
): {
  readonly confirmation: ReturnType<typeof changeEmailConfirmationHandler>
  readonly verification: VerificationSender
} => {
  const mailer: ChangeEmailMailer = {
    appName: app?.name,
    send,
    wordsFor: (stored) => recipientEmailWords(app?.languages, stored),
  }
  // The template counts as declared when it has a subject, as the sign-up sender reads it.
  const custom = authConfig?.emailTemplates?.verification?.subject !== undefined
  return {
    confirmation: changeEmailConfirmationHandler(mailer),
    verification: withChangeEmailVerification(signUp, mailer, custom),
  }
}
