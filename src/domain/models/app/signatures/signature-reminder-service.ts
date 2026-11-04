/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The reminders of a signing flow, as rules.
 *
 * A signer whose turn has come and who has not signed is reminded once
 * `reminders.every` has passed since her last message (the invitation is
 * message zero), at most `reminders.max` times, and never once the request
 * has ended or its deadline has passed. Each reminder is a `reminded` event
 * of the chain, so the count survives a restart and is part of the evidence;
 * each carries a new link, since a link is stored only as its digest.
 */

import { escapeHtmlAttribute } from '@/domain/kernel/sanitize/html-escaping'

/** One reminder's timing, as the sweep reads it. */
export interface ReminderTiming {
  /** When she last received a message: her link, or a reminder. */
  readonly lastNotifiedAtMs: number | undefined
  readonly everyMs: number
  /** When the request stops accepting signatures; `undefined` for none. */
  readonly expiresAtMs: number | undefined
  readonly nowMs: number
  /** Reminders she has received for this request. */
  readonly sent: number
  readonly max: number
}

/** Whether a signer is due her next reminder now. */
export const isReminderDue = (timing: ReminderTiming): boolean =>
  timing.lastNotifiedAtMs !== undefined &&
  timing.sent < timing.max &&
  timing.nowMs >= timing.lastNotifiedAtMs + timing.everyMs &&
  (timing.expiresAtMs === undefined || timing.nowMs < timing.expiresAtMs)

/** The reminders a chain records for `signer`: its `reminded` events of hers. */
export const remindersSentTo = (
  events: ReadonlyArray<{ readonly type: string; readonly signer?: string | undefined }>,
  signer: string
): number => events.filter((event) => event.type === 'reminded' && event.signer === signer).length

/**
 * The reminder one signer receives: neutral words, her new link, and when it
 * stops working. It names neither the document nor what it says.
 */
export const signatureReminderMail = (input: {
  readonly appName: string
  readonly displayName: string
  readonly link: string
  readonly expiresAt: string | undefined
}): { readonly subject: string; readonly text: string; readonly html: string } => {
  const until =
    input.expiresAt === undefined
      ? ''
      : ` It works until ${new Date(input.expiresAt).toUTCString()}.`
  const greeting = input.displayName === '' ? 'Hello,' : `Hello ${input.displayName},`
  const body = 'A document is still waiting for your signature.'
  const replaced = 'This link replaces the one in earlier messages, which no longer works.'
  return {
    subject: `${input.appName}: reminder, a document is waiting for your signature`,
    text: `${greeting}\n\n${body} Open it and sign here:\n${input.link}\n\n${replaced} It is yours alone: do not forward it.${until}`,
    html: `<p>${escapeHtmlAttribute(greeting)}</p><p>${body}</p><p><a href="${escapeHtmlAttribute(input.link)}">Open the document and sign</a></p><p>${replaced} It is yours alone: do not forward it.${escapeHtmlAttribute(until)}</p>`,
  }
}
