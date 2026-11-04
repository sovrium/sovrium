/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { credentialAddedEmail, type AddedCredentialKind } from '../../email/credential-added-email'
import { sendEmail } from '../../email/email-service'
import { recipientEmailWords, type EmailWords } from '../../email/email-words'
import { logMailFailure } from './mail-failure-log'
import type { Languages } from '@/domain/models/app/languages'

/** The account a credential was added to. */
interface CredentialOwner {
  readonly email: string
  readonly name?: string
  readonly language?: string | null
}

/** Tells an account's owner that an API key or a passkey was added to it. */
export type CredentialAddedNotifier = (
  owner: CredentialOwner,
  kind: AddedCredentialKind,
  credentialName: string | undefined
) => Promise<void>

/**
 * The notice, in the reader's language. Never throws: a notice that could not
 * be sent is logged, and the credential stands either way.
 */
const createCredentialAddedHandler =
  (
    appName: string | undefined,
    send: typeof sendEmail,
    wordsFor: (stored?: string | null) => EmailWords
  ): CredentialAddedNotifier =>
  async (owner, kind, credentialName) => {
    try {
      await send({
        to: owner.email,
        fromName: appName,
        ...credentialAddedEmail({
          kind,
          appName,
          userName: owner.name,
          credentialName,
          words: wordsFor(owner.language),
        }),
      })
    } catch (error) {
      logMailFailure('credential notice', owner.email, error)
    }
  }

/** The notice as an instance sends it: the app's name, through the shared mailer, in the reader's language. */
export const credentialAddedNotifierFor = (
  appName: string | undefined,
  languages: Languages | undefined
): CredentialAddedNotifier =>
  createCredentialAddedHandler(appName, sendEmail, (stored) =>
    recipientEmailWords(languages, stored)
  )
