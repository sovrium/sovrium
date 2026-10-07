/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parseJsonObjectCell } from '@/domain/kernel/sql/sqlite-json-cell'
import { signSigV4 } from './ses-signature-v4'
import type { SendMailOptions } from './nodemailer'
import type { EmailApiProvider, EmailTransport } from '@/domain/models/process-env/email-transport'

/** One mailbox: an address and, optionally, the name shown beside it. */
export interface Mailbox {
  readonly address: string
  readonly name?: string
}

/** A message reduced to what every HTTP email API understands. */
export interface OutgoingMessage {
  readonly from: Mailbox
  readonly to: readonly Mailbox[]
  readonly cc: readonly Mailbox[]
  readonly bcc: readonly Mailbox[]
  readonly replyTo: readonly Mailbox[]
  readonly subject: string
  readonly html?: string
  readonly text?: string
}

/** A request ready for `fetch`, built for one provider. */
export interface EmailApiRequest {
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
  readonly body: string
}

/** The provider name a person reads, in logs and run errors. */
export const PROVIDER_LABEL: Readonly<Record<EmailApiProvider, string>> = {
  brevo: 'Brevo',
  resend: 'Resend',
  ses: 'Amazon SES',
}

/** `"Name" <address>`, `Name <address>` or a bare `address`. */
const MAILBOX_PATTERN = /^\s*"?([^"<]*?)"?\s*<([^<>\s]+)>\s*$/

/** Parse one mailbox written the way a `From:` or `To:` header writes it. */
export const parseMailbox = (raw: string): Mailbox | undefined => {
  const match = MAILBOX_PATTERN.exec(raw)
  if (match !== null) {
    const name = (match[1] ?? '').trim()
    return { address: match[2] ?? '', ...(name !== '' ? { name } : {}) }
  }
  const address = raw.trim()
  return address === '' ? undefined : { address }
}

/**
 * Normalise a nodemailer address field — a string (possibly comma-separated),
 * an `{ name, address }` object, or a list of either — to mailboxes.
 *
 * A comma is a separator only between mailboxes: a quoted display name keeps
 * its own commas.
 */
export const toMailboxes = (raw: unknown): readonly Mailbox[] => {
  if (Array.isArray(raw)) return raw.flatMap((entry: unknown) => toMailboxes(entry))
  if (typeof raw === 'string') return mailboxesOfHeader(raw)
  return addressObjectMailboxes(raw)
}

/** The mailboxes of a header-style list, splitting on commas outside quotes. */
const mailboxesOfHeader = (raw: string): readonly Mailbox[] =>
  (raw.match(/(?:"[^"]*"|[^,])+/g) ?? [])
    .map((part) => parseMailbox(part))
    .filter((mailbox): mailbox is Mailbox => mailbox !== undefined)

/** A nodemailer `{ name, address }` object as a mailbox, or none. */
const addressObjectMailboxes = (raw: unknown): readonly Mailbox[] => {
  if (typeof raw !== 'object' || raw === null) return []
  const { address, name } = raw as { address?: unknown; name?: unknown }
  if (typeof address !== 'string' || address === '') return []
  return [{ address, ...(typeof name === 'string' && name !== '' ? { name } : {}) }]
}

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

/**
 * Reduce nodemailer options to an {@link OutgoingMessage}. Attachments and raw
 * MIME are SMTP-only: no caller sends them, and an HTTP API would need each
 * vendor's own encoding.
 */
export const toOutgoingMessage = (options: Readonly<SendMailOptions>): OutgoingMessage => {
  const html = stringOrUndefined(options.html)
  const text = stringOrUndefined(options.text)
  return {
    from: toMailboxes(options.from)[0] ?? { address: '' },
    to: toMailboxes(options.to),
    cc: toMailboxes(options.cc),
    bcc: toMailboxes(options.bcc),
    replyTo: toMailboxes(options.replyTo),
    subject: typeof options.subject === 'string' ? options.subject : '',
    ...(html !== undefined ? { html } : {}),
    ...(text !== undefined ? { text } : {}),
  }
}

/** `Name <address>`, or the bare address — the form Resend and SES accept. */
const formatMailbox = (mailbox: Mailbox, encodeName = false): string => {
  if (mailbox.name === undefined) return mailbox.address
  // A header carries ASCII only; SES takes a non-ASCII display name as an
  // RFC 2047 encoded word, the way an SMTP client would write it.
  const name =
    encodeName && /[^\x20-\x7e]/.test(mailbox.name)
      ? `=?UTF-8?B?${Buffer.from(mailbox.name, 'utf8').toString('base64')}?=`
      : mailbox.name.replace(/[<>"]/g, '')
  return `${name} <${mailbox.address}>`
}

/** Drop the keys whose value is `undefined` or an empty list. */
const compact = (record: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(record).filter(
      ([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0)
    )
  )

const brevoMailbox = (mailbox: Mailbox): Readonly<Record<string, string>> => ({
  email: mailbox.address,
  ...(mailbox.name !== undefined ? { name: mailbox.name } : {}),
})

/** Brevo `POST /v3/smtp/email`, keyed with the `api-key` header. */
const brevoRequest = (
  apiKey: string,
  baseUrl: string,
  message: OutgoingMessage
): EmailApiRequest => ({
  url: `${baseUrl}/smtp/email`,
  headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify(
    compact({
      sender: brevoMailbox(message.from),
      to: message.to.map(brevoMailbox),
      cc: message.cc.map(brevoMailbox),
      bcc: message.bcc.map(brevoMailbox),
      // Brevo takes one reply-to mailbox.
      replyTo: message.replyTo[0] !== undefined ? brevoMailbox(message.replyTo[0]) : undefined,
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
    })
  ),
})

/** Resend `POST /emails`, authenticated with the key as a bearer token. */
const resendRequest = (
  apiKey: string,
  baseUrl: string,
  message: OutgoingMessage
): EmailApiRequest => ({
  url: `${baseUrl}/emails`,
  headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
  body: JSON.stringify(
    compact({
      from: formatMailbox(message.from),
      to: message.to.map((mailbox) => formatMailbox(mailbox)),
      cc: message.cc.map((mailbox) => formatMailbox(mailbox)),
      bcc: message.bcc.map((mailbox) => formatMailbox(mailbox)),
      reply_to: message.replyTo.map((mailbox) => formatMailbox(mailbox)),
      subject: message.subject,
      html: message.html,
      text: message.text,
    })
  ),
})

const sesContent = (data: string): Readonly<Record<string, string>> => ({
  Data: data,
  Charset: 'UTF-8',
})

/**
 * Amazon SES API v2 `POST /v2/email/outbound-emails` (SendEmail), a simple
 * content message signed with Signature Version 4 for the service `ses`.
 */
const sesRequest = (
  transport: Extract<EmailTransport, { readonly kind: 'ses' }>,
  message: OutgoingMessage,
  epochMillis: number
): EmailApiRequest => {
  const url = new URL(`${transport.baseUrl}/v2/email/outbound-emails`)
  const body = JSON.stringify(
    compact({
      FromEmailAddress: formatMailbox(message.from, true),
      Destination: compact({
        ToAddresses: message.to.map((mailbox) => formatMailbox(mailbox, true)),
        CcAddresses: message.cc.map((mailbox) => formatMailbox(mailbox, true)),
        BccAddresses: message.bcc.map((mailbox) => formatMailbox(mailbox, true)),
      }),
      ReplyToAddresses: message.replyTo.map((mailbox) => formatMailbox(mailbox, true)),
      Content: {
        Simple: {
          Subject: sesContent(message.subject),
          Body: compact({
            Html: message.html !== undefined ? sesContent(message.html) : undefined,
            Text: message.text !== undefined ? sesContent(message.text) : undefined,
          }),
        },
      },
    })
  )
  const headers = signSigV4(
    { method: 'POST', url, headers: { 'content-type': 'application/json' }, body },
    {
      accessKeyId: transport.accessKeyId,
      secretAccessKey: transport.secretAccessKey,
      region: transport.region,
      service: 'ses',
    },
    epochMillis
  )
  return { url: url.toString(), headers, body }
}

/**
 * Build the provider's request for one message. `epochMillis` is the signing
 * time, read only by SES.
 */
export const buildEmailApiRequest = (
  transport: Exclude<EmailTransport, { readonly kind: 'smtp' }>,
  message: OutgoingMessage,
  epochMillis: number
): EmailApiRequest => {
  if (transport.kind === 'brevo') return brevoRequest(transport.apiKey, transport.baseUrl, message)
  if (transport.kind === 'resend')
    return resendRequest(transport.apiKey, transport.baseUrl, message)
  return sesRequest(transport, message, epochMillis)
}

/** The secrets of a transport, so no message built from a response can carry one. */
export const transportSecrets = (
  transport: Exclude<EmailTransport, { readonly kind: 'smtp' }>
): readonly string[] =>
  transport.kind === 'ses' ? [transport.secretAccessKey, transport.accessKeyId] : [transport.apiKey]

/** Replace every occurrence of a secret with `[redacted]`. */
export const redactSecrets = (text: string, secrets: readonly string[]): string =>
  secrets
    .filter((secret) => secret !== '')
    .reduce((acc, secret) => acc.split(secret).join('[redacted]'), text)

/**
 * The provider's own sentence from an error body — Brevo and Resend answer
 * `{ message }`, SES `{ message }` or `{ Message }` — capped, or `undefined`.
 */
export const providerErrorDetail = (rawBody: string): string | undefined => {
  const record = parseJsonObjectCell(rawBody.trim()) ?? {}
  const detail = [record['message'], record['Message']].find(
    (value): value is string => typeof value === 'string' && value.trim() !== ''
  )
  return detail?.trim().slice(0, 200)
}

/** The id key each provider answers with. */
const MESSAGE_ID_KEY: Readonly<Record<EmailApiProvider, string>> = {
  brevo: 'messageId',
  resend: 'id',
  ses: 'MessageId',
}

/** The message id the provider answered with, or a synthetic one when it sent none. */
export const providerMessageId = (rawBody: string, provider: EmailApiProvider): string => {
  const id = (parseJsonObjectCell(rawBody.trim()) ?? {})[MESSAGE_ID_KEY[provider]]
  return typeof id === 'string' && id !== '' ? id : `${provider}:accepted`
}
