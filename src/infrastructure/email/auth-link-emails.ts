/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeHtmlAttribute } from '@/domain/kernel/sanitize/html-escaping'
import { ENGLISH_WORDS, greetingsOf, minutesIn, type EmailWords } from './email-words'
import { resolveBrand } from './templates'

/** What a default email built here needs: the app's name and the reader's words. */
interface DefaultEmailContext {
  readonly appName?: string
  /** The reader's language; English when absent. */
  readonly words?: EmailWords
}

/**
 * A link an auth email carries, with its token in it once: the link Better
 * Auth hands over usually names the token already (a magic link's
 * `?token=`, a reset link's path segment), and appending a second copy put
 * it, unencoded, after the encoded callback. A link with a `token` parameter
 * of its own keeps it.
 */
export const withTokenOnce = (url: string, token: string): string =>
  url.includes(token) || /[?&]token=/.test(url)
    ? url
    : `${url}${url.includes('?') ? '&' : '?'}token=${token}`

/**
 * The default magic-link email. The user's name and the link are escaped in
 * the HTML part and left raw in the text part. `expiresInMinutes` is the
 * link's real lifetime (the strategy's `expirationMinutes`).
 */
export const buildMagicLinkDefaultEmail = ({
  userName,
  actionUrl,
  appName,
  expiresInMinutes,
  words = ENGLISH_WORDS,
}: Readonly<{ userName?: string; actionUrl: string; expiresInMinutes: number }> &
  DefaultEmailContext): Readonly<{
  subject: string
  html: string
  text: string
}> => {
  const brand = resolveBrand(appName)
  const greeting = greetingsOf(words, userName)
  const expires = words.t('linkExpires', { expiry: minutesIn(words, expiresInMinutes) })
  return {
    subject: words.t('magicLink.subject', { app: brand }),
    html: `<p>${greeting.html}</p><p>${words.t('magicLink.body', { app: escapeHtmlAttribute(brand) })} <a href="${escapeHtmlAttribute(actionUrl)}">${words.t('magicLink.button')}</a></p><p>${expires}</p>`,
    text: `${greeting.text}\n\n${words.t('magicLink.body', { app: brand })} ${actionUrl}\n\n${expires}`,
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
  const link = `<a href="${escapeHtmlAttribute(url)}">${words.t('invitation.here')}</a>`
  return {
    subject: words.t('invitation.subject', { app: brand }),
    html: `<p>${words.t('greeting', { name: escapeHtmlAttribute(name) })}</p><p>${words.t('invitation.invited', { inviter: escapeHtmlAttribute(inviterName), app: escapeHtmlAttribute(brand) })} ${words.t('invitation.htmlCta', { link })}</p><p>${words.t('invitation.singleUse')}</p>`,
    text: `${words.t('greeting', { name })}\n\n${words.t('invitation.invited', { inviter: inviterName, app: brand })} ${words.t('invitation.textCta')}\n\n${url}\n\n${words.t('invitation.singleUse')}`,
  }
}
