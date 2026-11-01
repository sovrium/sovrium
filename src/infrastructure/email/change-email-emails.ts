/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeHtmlAttribute } from '@/domain/kernel/sanitize/html-escaping'
import { ENGLISH_WORDS, expiryIn, greetingsOf, type EmailWords } from './email-words'
import { emailLayout, resolveBrand } from './templates'

/** Which of the two emails of an address change. */
export type ChangeEmailStep = 'confirm' | 'verify'

/** What a change-of-address email says, and to whom. */
interface ChangeEmailData {
  readonly step: ChangeEmailStep
  /** The operator's app name, printed as the email header. */
  readonly appName?: string
  readonly userName?: string
  /** The address the account is asked to move to. */
  readonly newEmail: string
  readonly actionUrl: string
  /** The reader's language; English when absent. */
  readonly words?: EmailWords
}

/**
 * The emails of an email-address change, neither of them a welcome.
 *
 * - `confirm` goes to the CURRENT address first: someone asked to move the
 *   account to `newEmail`; confirm, or ignore it and nothing changes.
 * - `verify` goes to the new address once the current one confirmed: verify
 *   this address to finish the change.
 */
export function changeEmailEmail(data: ChangeEmailData): {
  readonly subject: string
  readonly html: string
  readonly text: string
} {
  const words = data.words ?? ENGLISH_WORDS
  const greeting = greetingsOf(words, data.userName)
  const brand = resolveBrand(data.appName)
  const htmlBrand = escapeHtmlAttribute(brand)
  const key = (name: string): string => `changeEmail.${data.step}.${name}`
  const expires = words.t('linkExpires', { expiry: expiryIn(words, '24 hours') })
  const url = escapeHtmlAttribute(data.actionUrl)
  const htmlIntro = words.t(key('intro'), {
    app: htmlBrand,
    newEmail: escapeHtmlAttribute(data.newEmail),
  })

  const content = `
    <div class="content">
      <p>${greeting.html}</p>
      <p>${htmlIntro}</p>
      <p>${words.t(key('cta'))}</p>
      <p style="text-align: center;">
        <a href="${url}" class="button">${words.t(key('button'))}</a>
      </p>
      <p class="link-fallback">
        ${words.t('linkFallback')}<br>
        ${url}
      </p>
      <div class="warning">
        ${expires} ${words.t(key('ignore'), { app: htmlBrand })}
      </div>
    </div>
  `

  const text = [
    greeting.text,
    words.t(key('intro'), { app: brand, newEmail: data.newEmail }),
    `${words.t(key('textCta'))}\n${data.actionUrl}`,
    expires,
    words.t(key('ignore'), { app: brand }),
  ].join('\n\n')

  return {
    subject: words.t(key('subject'), { app: brand }),
    html: emailLayout(content, { appName: data.appName, words }),
    text,
  }
}
