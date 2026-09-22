/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { printJournalWarning } from '@/infrastructure/logging/cli-output'
import { logWarning } from '@/infrastructure/logging/logger'
import { isProduction } from '@/infrastructure/process/env'
import type { SendMailOptions } from './nodemailer'

/**
 * What to say about a message that was composed and then dropped because there
 * is no SMTP transport.
 *
 * ── TWO AUDIENCES, TWO ANSWERS ─────────────────────────────────────────────
 *
 * The same event is reported two different ways, and the difference is not
 * verbosity — it is who reads the stream.
 *
 * In **development** the terminal belongs to one person, who is at that moment
 * blocked. Dropping the message silently is what makes local work on an auth
 * flow impossible: the reset link they need in order to click it exists for one
 * instant inside the process and is then discarded, and the one-line notice
 * they used to get named the recipient and the subject but not the URL — the
 * one part of the message nobody can reconstruct by hand. So the whole message
 * joins the journal they are already watching.
 *
 * In **production** the log is shipped, retained, and read by people who are
 * not the developer. A reset link is a BEARER CREDENTIAL: writing one into a
 * retained log hands account takeover to anyone with log access. So production
 * keeps the single line it has always had, with no body and no links, and that
 * asymmetry is the point rather than an inconsistency to tidy away.
 *
 * [internal ref] (the dev journal carries To/Subject/body/Link) against
 * [internal ref] (production carries none of them).
 */

/**
 * The dev headline. One structural em dash, guidance after it (T16/T17/T19),
 * and it deliberately does NOT reuse the banner's `Email sending disabled`
 * wording: that phrase is the boot-time phase, and a grep for it should keep
 * landing there.
 */
const DEV_HEADLINE =
  'Email not sent — SMTP not configured (set SMTP_HOST to enable); the message follows'

/** The journal tag. Lowercase kebab, like every other tag (T34). */
const JOURNAL_TAG = 'email'

/** Absolute `http`/`https` URLs, greedily up to the first whitespace. */
const URL_PATTERN = /https?:\/\/\S+/g

/**
 * Punctuation a URL can pick up from the prose around it — a closing quote from
 * an `href`, a full stop from a sentence, a bracket from a parenthetical. Only
 * TRAILING characters are trimmed: any of them is legal inside a URL, so
 * stripping them anywhere else would corrupt the one string that has to be
 * copy-pasteable.
 */
const TRAILING_URL_PUNCTUATION = /["'<>)\]}.,;:]+$/

/** `<style>` / `<script>` bodies, which are markup rather than message. */
const NON_CONTENT_BLOCKS = /<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi

/** The handful of entities a hand-written email template actually emits. */
const HTML_ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
}

/** Render a nodemailer address value as one human-readable string. */
// eslint-disable-next-line functional/prefer-immutable-types -- nodemailer's Address is mutable by library design, like its Transporter
const describeRecipient = (to: SendMailOptions['to']): string => {
  if (to === undefined || to === null) return 'unknown'
  if (typeof to === 'string') return to
  if (Array.isArray(to)) return to.map((one) => describeRecipient(one)).join(', ')
  const { address, name } = to
  return name ? `${name} <${address}>` : address
}

/** A nodemailer body part may be a Buffer or a stream; only a string is text. */
const asText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined

/**
 * Turn an HTML body into something readable in a terminal: drop the markup,
 * keep the sentences.
 *
 * Deliberately NOT a sanitizer and not a renderer — nothing here is served to a
 * browser (S2's single canonical sanitizer governs that path, not this one).
 * `<style>`/`<script>` bodies go first because the email layout carries a full
 * stylesheet, and dumping it row by row would bury the message inside it.
 */
const stripHtml = (html: string): string =>
  Object.entries(HTML_ENTITIES)
    .reduce(
      (text, [entity, char]) => text.replaceAll(entity, char),
      html.replace(NON_CONTENT_BLOCKS, ' ').replace(/<[^>]*>/g, ' ')
    )
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')

/**
 * Every distinct absolute URL the message carries, in the order it carries
 * them.
 *
 * Read off the RAW body rather than the rendered one: an HTML-only message
 * keeps its links in `href` attributes, which tag-stripping throws away — and
 * the link is the half of this whole feature that matters.
 */
const collectLinks = (raw: string): readonly string[] => [
  ...new Set(
    (raw.match(URL_PATTERN) ?? []).map((url) => url.replace(TRAILING_URL_PUNCTUATION, ''))
  ),
]

/**
 * Report a message that could not be sent.
 *
 * @param options - the message as it was composed, exactly as it would have
 *   been handed to the transport.
 */
export const reportUndeliverableMessage = (options: Readonly<SendMailOptions>): void => {
  const recipient = describeRecipient(options.to)
  const subject = asText(options.subject) ?? ''

  if (isProduction()) {
    logWarning(
      `[${JOURNAL_TAG}] Email sending disabled (SMTP not configured) — ` +
        `skipped sending to "${recipient}" with subject "${subject}"`
    )
    return
  }

  const rawBody = asText(options.text) ?? asText(options.html) ?? ''
  const body = asText(options.text) ?? (asText(options.html) ? stripHtml(String(options.html)) : '')
  const links = collectLinks(`${rawBody}\n${subject}`).map((url) => `Link: ${url}`)

  // ONE entry, so all of its rows share one clock and one tag and no concurrent
  // emitter can land a line in the middle of them. `printJournalWarning` splits
  // the text into one stamped row per line, drops the blanks, and puts the
  // severity word on the first row only (T39/T40/T44).
  printJournalWarning(
    JOURNAL_TAG,
    [DEV_HEADLINE, `To: ${recipient}`, `Subject: ${subject}`, body, ...links].join('\n')
  )
}
