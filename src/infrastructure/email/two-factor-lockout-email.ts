/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeHtmlAttribute } from '@/domain/kernel/sanitize/html-escaping'
import { ENGLISH_WORDS, greetingsOf, type EmailWords } from './email-words'
import { emailLayout, resolveBrand } from './templates'

/** What the lockout notice says, and to whom. */
export interface TwoFactorLockoutEmailData {
  /** The operator's app name, printed as the email header. */
  readonly appName?: string
  readonly userName?: string
  /** How long the second step stays locked, in whole minutes. */
  readonly minutes: number
  /** The reader's language; English when absent. */
  readonly words?: EmailWords
}

/**
 * The notice an account's address receives when wrong codes lock its second
 * sign-in step: the step is paused, for how long, that an administrator can
 * clear it, and what to do if the attempts were not the reader's. It carries
 * no code and no link — nothing in it helps whoever typed the wrong codes.
 */
export function twoFactorLockoutEmail(data: TwoFactorLockoutEmailData): {
  readonly subject: string
  readonly html: string
  readonly text: string
} {
  const words = data.words ?? ENGLISH_WORDS
  const greeting = greetingsOf(words, data.userName)
  const brand = resolveBrand(data.appName)
  const htmlBrand = escapeHtmlAttribute(brand)
  const duration = words.t('expiry.minutes', { count: String(data.minutes) })
  const paused = (app: string) => words.t('twoFactorLocked.paused', { app, duration })
  const after = (app: string) => words.t('twoFactorLocked.after', { app })
  const notYou = words.t('twoFactorLocked.notYou')

  const content = `
    <div class="content">
      <p>${greeting.html}</p>
      <p>${paused(htmlBrand)}</p>
      <p>${after(htmlBrand)}</p>
      <div class="warning">${notYou}</div>
    </div>
  `
  const text = [greeting.text, paused(brand), after(brand), notYou].join('\n\n')

  return {
    subject: words.t('twoFactorLocked.subject', { app: brand }),
    html: emailLayout(content, {
      appName: data.appName,
      words,
      footerHtml: `<p>${words.t('twoFactorLocked.footer', { app: htmlBrand })}</p>`,
    }),
    text,
  }
}
