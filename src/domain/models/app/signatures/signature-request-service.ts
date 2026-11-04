/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The life of a signing request, as rules: what a document must be to be put
 * to signature, what a send refuses with, how the stored statuses read, who is
 * invited when, the statement and the contacts frozen at send, where a link
 * points, and what a signature trigger receives.
 *
 * Pure: the caller reads the record, the clock and the rows.
 */

import type { SignaturePlacementRefusalCode } from './signature-placement-service'
import type { App } from '@/domain/models/app'

/** The largest document a request accepts, in bytes (25 MiB). */
export const MAX_SIGNATURE_DOCUMENT_BYTES = 25 * 1024 * 1024

/** The most pages a document put to signature may have. */
export const MAX_SIGNATURE_DOCUMENT_PAGES = 500

/** Why a document cannot be put to signature. */
export const SIGNATURE_DOCUMENT_REFUSAL_CODES = [
  'document-too-large',
  'document-too-many-pages',
  'document-malformed',
  'document-encrypted',
  'document-signed',
  'document-active-content',
  'document-hidden-content',
] as const

/** One of {@link SIGNATURE_DOCUMENT_REFUSAL_CODES}. */
export type SignatureDocumentRefusalCode = (typeof SIGNATURE_DOCUMENT_REFUSAL_CODES)[number]

/** Why a `signature/send` step starts no request: the document's refusals, and the step's own. */
export type SignatureSendRefusalCode =
  | SignatureDocumentRefusalCode
  | 'flow-unknown'
  | 'record-missing'
  | 'document-missing'
  | 'request-open'
  | 'signer-contact-missing'
  | SignaturePlacementRefusalCode

/** What each document refusal tells the workflow author. */
export const SIGNATURE_DOCUMENT_REFUSAL_MESSAGES: Readonly<
  Record<SignatureDocumentRefusalCode, string>
> = {
  'document-too-large': `the document is larger than ${String(MAX_SIGNATURE_DOCUMENT_BYTES / 1024 / 1024)} MiB`,
  'document-too-many-pages': `the document has more than ${String(MAX_SIGNATURE_DOCUMENT_PAGES)} pages`,
  'document-malformed': 'the document is damaged and cannot be read as a PDF',
  'document-encrypted': 'the document is encrypted: remove its password before sending it',
  'document-signed': 'the document already carries a signature, which a new request would break',
  'document-active-content': 'the document runs scripts or actions when opened',
  'document-hidden-content':
    'the document holds layers a reader can switch on or off, so what it shows is not fixed',
}

/** The name of the one signature field a frozen document declares: the organisation's seal. */
export const SIGNATURE_SEAL_FIELD_NAME = 'organisation_seal'

/** The statuses a request is stored under, in the order it moves through them. */
export const STORED_REQUEST_STATUSES = [
  'pending',
  'signing',
  'sealing',
  'completed',
  'declined',
  'cancelled',
  'expired',
] as const

/** One of {@link STORED_REQUEST_STATUSES}. */
export type StoredRequestStatus = (typeof STORED_REQUEST_STATUSES)[number]

/** The statuses of a request that may still be signed, declined, cancelled or expired. */
export const OPEN_STORED_REQUEST_STATUSES = ['pending', 'signing'] as const

/** The statuses of a request that has not ended: open, or every signature given and being sealed. */
export const UNENDED_STORED_REQUEST_STATUSES = ['pending', 'signing', 'sealing'] as const

/** A request status as the API and `output.status` say it. */
export type RequestStatus =
  'sent' | 'in-progress' | 'sealing' | 'completed' | 'declined' | 'cancelled' | 'expired'

/** A stored request status as the API says it; an unknown one reads as the stored word. */
export const requestStatusOf = (stored: string): RequestStatus => {
  if (stored === 'pending') return 'sent'
  if (stored === 'signing') return 'in-progress'
  return stored as RequestStatus
}

/** Whether a request stored as `stored` has not ended. */
export const isUnendedRequest = (stored: string): boolean =>
  (UNENDED_STORED_REQUEST_STATUSES as readonly string[]).includes(stored)

/** A signer status as the API says it: an invited or verified signer's link is `sent`. */
export const signerStatusOf = (stored: string): 'waiting' | 'sent' | 'signed' | 'declined' => {
  if (stored === 'invited' || stored === 'verified') return 'sent'
  if (stored === 'signed' || stored === 'declined') return stored
  return 'waiting'
}

/** The positions invited when a request is sent: the first signer in sequence, every one in parallel. */
export const positionsInvitedAtSend = (
  order: 'sequential' | 'parallel',
  signerCount: number
): readonly number[] =>
  order === 'parallel' ? Array.from({ length: signerCount }, (_, index) => index) : [0]

/** The status a request takes once `signed` of its `total` signers have signed. */
export const statusAfterSignatures = (signed: number, total: number): StoredRequestStatus =>
  signed >= total ? 'sealing' : 'signing'

/** A flow, as the request rules read it. */
interface LooseFlow {
  readonly name: string
  readonly signers: ReadonlyArray<{
    readonly name: string
    readonly email: string
    readonly displayName?: string | undefined
    readonly phone?: string | undefined
    readonly field: string
  }>
  readonly verify?: { readonly sms?: unknown } | undefined
}

/** The flow named `name`, or `undefined`. */
export const signatureFlowNamed = (app: App, name: string) =>
  app.signatures?.find((flow) => flow.name === name)

/** One signer as a request is sent to her: her contact read from the record once. */
export interface FrozenSigner {
  readonly name: string
  readonly position: number
  readonly field: string
  readonly email: string
  readonly displayName: string
  /** Her phone, read only when the flow sends codes by text message. */
  readonly phone?: string | undefined
}

/**
 * The flow's signers as the record names them now, each `$record.<field>`
 * read through `resolve`; a blank address is kept blank.
 */
export const frozenSigners = (
  flow: LooseFlow,
  resolve: (template: string) => string
): readonly FrozenSigner[] =>
  flow.signers.map((signer, position) => {
    const email = resolve(signer.email).trim()
    const displayName =
      signer.displayName === undefined ? email : resolve(signer.displayName).trim()
    const phone =
      flow.verify?.sms === undefined || signer.phone === undefined
        ? undefined
        : normalizedPhone(resolve(signer.phone).trim())
    return {
      ...{ name: signer.name, position, field: signer.field, email, displayName },
      ...(phone === undefined ? {} : { phone }),
    }
  })

/** A loose shape test for an address: something, an at sign, something with a dot. */
const ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The first signer whose address cannot be written to, or `undefined`. */
export const signerWithoutContact = (signers: readonly FrozenSigner[]): FrozenSigner | undefined =>
  signers.find((signer) => !ADDRESS_PATTERN.test(signer.email))

/** A phone a text message can be sent to: international format, a plus and 8 to 15 digits. */
const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/

/** A phone as a provider takes it: spaces, dots, dashes and brackets dropped. */
export const normalizedPhone = (phone: string): string => phone.replaceAll(/[\s.()-]/g, '')

/**
 * The first signer of a flow sending codes by text message whose phone is
 * missing or not in international format, or `undefined`.
 */
export const signerWithoutPhone = (
  flow: { readonly verify?: { readonly sms?: unknown } | undefined },
  signers: readonly FrozenSigner[]
): FrozenSigner | undefined =>
  flow.verify?.sms === undefined
    ? undefined
    : signers.find((signer) => !PHONE_PATTERN.test(normalizedPhone(signer.phone ?? '')))

/** The path segment a signing page's path carries the token in. */
export const SIGNING_TOKEN_SEGMENT = ':token'

/** The path a signing link opens: the page's path with the token in its `:token` segment. */
export const signingLinkPath = (pagePath: string, token: string): string =>
  pagePath
    .split('/')
    .map((segment) => (segment === SIGNING_TOKEN_SEGMENT ? token : segment))
    .join('/')

/** The paths of the signing pages the flows of `app` open, each carrying `:token`. */
export const signingPagePaths = (app: App): readonly string[] => {
  const names = new Set((app.signatures ?? []).map((flow) => flow.surface.page))
  return (app.pages ?? [])
    .filter((page) => names.has(page.name))
    .map((page) => page.path)
    .filter(
      (path): path is string =>
        typeof path === 'string' && path.split('/').includes(SIGNING_TOKEN_SEGMENT)
    )
}

/** An event a signature trigger starts on. */
export type SignatureTriggerEvent =
  'sent' | 'signed' | 'declined' | 'cancelled' | 'completed' | 'sealed' | 'expired'

/** What a request event hands its signature triggers, as `$trigger.signature`. */
export interface SignatureTriggerPayload {
  readonly requestId: string
  readonly event: SignatureTriggerEvent
  readonly status: RequestStatus
  readonly signer?: string
  readonly reason?: string
}

/** The `$trigger.signature` of one event: no contact detail, no link, only names and status. */
export const signatureTriggerPayload = (input: {
  readonly requestId: string
  readonly event: SignatureTriggerEvent
  readonly status: RequestStatus
  readonly signer?: string | undefined
  readonly reason?: string | undefined
}): SignatureTriggerPayload => ({
  ...{ requestId: input.requestId, event: input.event, status: input.status },
  ...(input.signer === undefined ? {} : { signer: input.signer }),
  ...(input.reason === undefined || input.reason === '' ? {} : { reason: input.reason }),
})

/** Where a signing session stands, as its rows say. */
export interface SigningSessionState {
  readonly requestStatus: string
  readonly signerStatus: string
  readonly tokenExpiresAt?: string | undefined
  readonly requestExpiresAt?: string | undefined
}

/** Whether an instant `iso`, when there is one, is still ahead of `nowMs`. */
const ahead = (iso: string | undefined, nowMs: number): boolean =>
  iso === undefined || Date.parse(iso) > nowMs

/**
 * Whether a session may still sign or decline: its request open, its signer
 * invited and not yet signed, neither the link nor the request past its
 * deadline. Anything else answers as an unknown link.
 */
export const isSigningSessionLive = (state: SigningSessionState, nowMs: number): boolean =>
  (OPEN_STORED_REQUEST_STATUSES as readonly string[]).includes(state.requestStatus) &&
  (state.signerStatus === 'invited' || state.signerStatus === 'verified') &&
  ahead(state.tokenExpiresAt, nowMs) &&
  ahead(state.requestExpiresAt, nowMs)

/**
 * Whether a signer who already signed may be answered her signature again: a
 * second post of the same signature, while her request has not been declined,
 * cancelled or expired.
 */
export const mayReplaySignature = (state: SigningSessionState): boolean =>
  state.signerStatus === 'signed' &&
  (isUnendedRequest(state.requestStatus) || state.requestStatus === 'completed')

/** The storage key of a signer's mark, under her request's evidence. */
export const signatureMarkName = (signer: string, evidenceId: string): string =>
  `marks/${signer}-${evidenceId}.png`

/**
 * The instant a request ended, which its retention counts from: an expired
 * request ended at its deadline, whenever the sweep noticed; any other end at
 * the instant it was made (`nowMs`). One rule for the expiry, the evidence
 * date it sets, and the status a reader is shown.
 */
export const requestEndedAtMs = (input: {
  readonly status: string
  readonly expiresAtMs: number | undefined
  readonly nowMs: number
}): number =>
  input.status === 'expired' && input.expiresAtMs !== undefined && input.expiresAtMs <= input.nowMs
    ? input.expiresAtMs
    : input.nowMs

/**
 * The account each frozen signer is linked to: the one whose address is the
 * signer's, case and surrounding spaces ignored as sign-in ignores them.
 * `accountsByEmail` is keyed by the address lowercased. The link reaches her
 * data export and her account's erasure; it changes nothing about how she
 * proves who she is when she signs.
 */
export const signerAccountLinks = (
  signers: readonly Pick<FrozenSigner, 'name' | 'email'>[],
  accountsByEmail: ReadonlyMap<string, string>
): readonly { readonly signerName: string; readonly userId: string }[] =>
  signers.flatMap((signer) => {
    const userId = accountsByEmail.get(signer.email.trim().toLowerCase())
    return userId === undefined ? [] : [{ signerName: signer.name, userId }]
  })
