/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeHtmlAttribute } from '@/domain/kernel/sanitize/html-escaping'
import { ENGLISH_WORDS, greetingsOf, type EmailWords } from './email-words'
import { emailLayout, resolveBrand } from './templates'

/** The kinds of credential whose addition the account's owner is told about. */
export type AddedCredentialKind = 'apiKey' | 'passkey'

/** What the notice says, and to whom. */
interface CredentialAddedEmailData {
  readonly kind: AddedCredentialKind
  /** The operator's app name, printed as the email header. */
  readonly appName?: string
  readonly userName?: string
  /** The name the credential was given, when it was given one. */
  readonly credentialName?: string
  /** The reader's language; English when absent. */
  readonly words?: EmailWords
}

/**
 * The notice an account's address receives when an API key or a passkey is
 * added to it: what was added, under which name, what it can do, and what to
 * do if it was not the reader. It carries no secret and no link, so it helps
 * nobody who reads it in the owner's stead.
 */
export function credentialAddedEmail(data: CredentialAddedEmailData): {
  readonly subject: string
  readonly html: string
  readonly text: string
} {
  const words = data.words ?? ENGLISH_WORDS
  const greeting = greetingsOf(words, data.userName)
  const brand = resolveBrand(data.appName)
  const htmlBrand = escapeHtmlAttribute(brand)
  const prefix = `credentialAdded.${data.kind}`
  const name = data.credentialName?.trim() ?? ''
  const added = (app: string, credentialName: string) =>
    name === ''
      ? words.t(`${prefix}.addedUnnamed`, { app })
      : words.t(`${prefix}.added`, { app, name: credentialName })
  const notYou = words.t(`${prefix}.notYou`)

  const content = `
    <div class="content">
      <p>${greeting.html}</p>
      <p>${added(htmlBrand, escapeHtmlAttribute(name))}</p>
      <div class="warning">${notYou}</div>
    </div>
  `
  const text = [greeting.text, added(brand, name), notYou].join('\n\n')

  return {
    subject: words.t(`${prefix}.subject`, { app: brand }),
    html: emailLayout(content, {
      appName: data.appName,
      words,
      footerHtml: `<p>${words.t('credentialAdded.footer', { app: htmlBrand })}</p>`,
    }),
    text,
  }
}
