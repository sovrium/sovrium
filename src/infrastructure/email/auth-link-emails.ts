/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeHtml } from '@/domain/kernel/markdown/markdown-renderer'
import { ENGLISH_WORDS, type EmailWords } from './email-words'
import { resolveBrand } from './templates'

/** What a default email built here needs: the app's name and the reader's words. */
interface DefaultEmailContext {
  readonly appName?: string
  /** The reader's language; English when absent. */
  readonly words?: EmailWords
}

/**
 * The default magic-link email. The user's name and the link are escaped in
 * the HTML part and left raw in the text part.
 */
export const buildMagicLinkDefaultEmail = ({
  userName,
  actionUrl,
  appName,
  words = ENGLISH_WORDS,
}: Readonly<{ userName?: string; actionUrl: string }> & DefaultEmailContext): Readonly<{
  subject: string
  html: string
  text: string
}> => {
  const brand = resolveBrand(appName)
  const greet = (name: string | undefined): string =>
    userName === undefined ? words.t('greetingThere') : words.t('greeting', { name: name ?? '' })
  const expires = words.t('linkExpires', { expiry: words.t('expiry.minutes10') })
  return {
    subject: words.t('magicLink.subject', { app: brand }),
    html: `<p>${greet(userName && escapeHtml(userName))}</p><p>${words.t('magicLink.body', { app: escapeHtml(brand) })} <a href="${escapeHtml(actionUrl)}">${words.t('magicLink.button')}</a></p><p>${expires}</p>`,
    text: `${greet(userName)}\n\n${words.t('magicLink.body', { app: brand })} ${actionUrl}\n\n${expires}`,
  }
}

/**
 * The default invitation email. The invitee's and the inviter's names and the
 * link are escaped in the HTML part and left raw in the text part. An invitee
 * has chosen no language yet, so the app's default language decides.
 */
export const buildInvitationDefaultEmail = ({
  name,
  url,
  inviterName,
  appName,
  words = ENGLISH_WORDS,
}: Readonly<{ name: string; url: string; inviterName: string }> & DefaultEmailContext): Readonly<{
  subject: string
  html: string
  text: string
}> => {
  const brand = resolveBrand(appName)
  const link = `<a href="${escapeHtml(url)}">${words.t('invitation.here')}</a>`
  return {
    subject: words.t('invitation.subject', { app: brand }),
    html: `<p>${words.t('greeting', { name: escapeHtml(name) })}</p><p>${words.t('invitation.invited', { inviter: escapeHtml(inviterName), app: escapeHtml(brand) })} ${words.t('invitation.htmlCta', { link })}</p><p>${words.t('invitation.singleUse')}</p>`,
    text: `${words.t('greeting', { name })}\n\n${words.t('invitation.invited', { inviter: inviterName, app: brand })} ${words.t('invitation.textCta')}\n\n${url}\n\n${words.t('invitation.singleUse')}`,
  }
}
