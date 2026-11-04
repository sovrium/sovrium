/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DURATION_PATTERN, durationToMs } from '@/domain/kernel/time/parse-duration'
import { MAX_SIGNERS, SIGNATURE_NAME_PATTERN, SignatureSignerSchema } from './signature-signer'

/**
 * `signatures` — the signing flows an app declares.
 *
 * A flow asks one or more people to sign the document a record holds. When a
 * `signature/send` step runs, the engine freezes the document (it hashes the
 * bytes and keeps its own copy under an evidence key), interpolates the
 * statement once per signer, and sends each signer a link of her own. The
 * flow's `surface.page` is the page those links open. Each signature is stored
 * in that signer's `signature` field, and when every signer has signed the
 * engine writes the signed document, the proof file and the status into the
 * `output` fields. The record never holds anything a client wrote into those
 * fields: only the engine writes them.
 *
 * What the flow produces is a simple electronic signature with an evidence
 * file. The organisation's seal (`SIGNATURE_SEAL_KEY`) and a timestamp
 * authority (`SIGNATURE_TSA_URL`) are optional operator settings; nothing here
 * decides a legal effect.
 *
 * @example
 * ```yaml
 * signatures:
 *   - name: employment_contract
 *     table: contracts
 *     document: { field: draft_pdf }
 *     statement: I have read and accept $record.title.
 *     surface: { page: contract_signing, fields: [title] }
 *     signers:
 *       - name: employee
 *         email: $record.employee_email
 *         field: employee_signature
 *     output: { signedFile: signed_pdf, proofFile: proof_pdf, status: signing_status }
 *     evidence: { keep: 6y, basis: legal-obligation }
 * ```
 */

/** Every status the engine writes into `output.status`, in the order a request moves through them. */
export const SIGNATURE_REQUEST_STATUSES = [
  'sent',
  'in-progress',
  'sealing',
  'completed',
  'declined',
  'cancelled',
  'expired',
] as const

/** Why the evidence is kept, as the processing record names it. */
export const SIGNATURE_EVIDENCE_BASES = [
  'legal-obligation',
  'legal-claims',
  'contract',
  'legitimate-interest',
] as const

/** How long a link stays valid when `expires` is left out. */
export const DEFAULT_SIGNATURE_EXPIRES = '30d'

/** Shortest and longest link lifetime. */
const MIN_EXPIRES_MS = 3_600_000
const MAX_EXPIRES_MS = 365 * 86_400_000

/** Shortest reminder interval, and the most reminders one signer receives. */
const MIN_REMINDER_EVERY_MS = 3_600_000
export const MAX_SIGNATURE_REMINDERS = 20

/** Shortest and longest time the evidence is kept. */
const MIN_KEEP_MS = 86_400_000
const MAX_KEEP_MS = 100 * 365 * 86_400_000

/** A duration in the shared grammar, held between two bounds. */
const boundedDuration = (
  annotations: { readonly description: string; readonly defaultNote?: string },
  bounds: { readonly min: number; readonly max: number; readonly label: string }
) =>
  Schema.String.pipe(
    Schema.annotate({ ...annotations, examples: ['30d', '6y'] }),
    Schema.check(
      Schema.isPattern(DURATION_PATTERN, {
        message:
          'A duration is a whole number and a unit: ms, s, m, h, d or y (a year being 365 days), for example 30d or 6y.',
      })
    ),
    Schema.check(
      Schema.makeFilter((value: string) => {
        const ms = durationToMs(value)
        return ms === undefined || (ms >= bounds.min && ms <= bounds.max)
          ? true
          : `A duration here must be ${bounds.label}; got ${value}.`
      })
    )
  )

export const SignatureFlowNameSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Signing Flow Name',
    description:
      'Name of the flow, as a signature/send step and a signature trigger name it: lowercase letters and digits, words joined by - or _.',
    examples: ['employment_contract', 'quote-approval'],
  }),
  Schema.check(
    Schema.isPattern(SIGNATURE_NAME_PATTERN, {
      message:
        'A signing flow name is lowercase letters and digits, words joined by - or _ (for example employment_contract).',
    })
  )
)

export const SignatureDocumentSchema = Schema.Struct({
  field: Schema.String.pipe(
    Schema.annotate({
      description:
        'The single-attachment field of the table that holds the PDF to sign. Its bytes are copied and hashed when the request is sent, and every signer signs that copy. While a request is open, a client write to this field is refused; once it has ended the field takes a new file. Files over 25 MiB or 500 pages, encrypted, already signed, running scripts, holding switchable layers or damaged are refused when the request is sent.',
      examples: ['draft_pdf'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
}).pipe(
  Schema.annotate({
    identifier: 'SignatureDocument',
    title: 'Document To Sign',
    description: 'Where the document to sign is read from when the request is sent.',
  })
)

export const SignatureRemindersSchema = Schema.Struct({
  every: boundedDuration(
    {
      description:
        'How long after the link was sent, then after each reminder, a signer who has not signed is reminded. At least one hour.',
    },
    { min: MIN_REMINDER_EVERY_MS, max: MAX_EXPIRES_MS, label: 'between 1h and 1y' }
  ),
  max: Schema.Finite.pipe(
    Schema.annotate({
      description: `The most reminders one signer receives, from 1 to ${String(MAX_SIGNATURE_REMINDERS)}. No reminder is sent once the link has expired.`,
    }),
    Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: MAX_SIGNATURE_REMINDERS }))
  ),
}).pipe(
  Schema.annotate({
    identifier: 'SignatureReminders',
    title: 'Signature Reminders',
    description:
      'Reminders mailed to a signer whose turn has come and who has not signed yet, at the address frozen when the request was sent. Each reminder carries a new link, and the link of every earlier message stops working. None is sent once the request has ended or expired. Left out, no reminder is sent.',
  })
)

export const SignatureSmsVerificationSchema = Schema.Struct({
  connection: Schema.String.pipe(
    Schema.annotate({
      description:
        'The declared connection that sends the text messages. Every signer of the flow then needs a phone.',
      examples: ['twilio-main'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  from: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'The sender the messages come from: a phone number in international format, or a messaging service id (MG followed by 32 characters). Accepts $env.VAR. The provider refuses a message without a sender it knows.',
        examples: ['+33612345678', '$env.SIGNING_SMS_FROM'],
      }),
      Schema.check(Schema.isMinLength(1), Schema.isMaxLength(64))
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'SignatureSmsVerification',
    title: 'Text-Message Verification',
    description:
      'Send a one-time code by text message to the phone frozen for the signer when the request was sent. The limits are those of the email code: valid ten minutes, a new one after a minute, three per signer and request, ten an hour per network address, five wrong codes lock her verification. A message the provider refuses or cannot take (its sending budget spent, or an outage) is answered SMS_UNAVAILABLE, and she may ask again after a minute.',
  })
)

export const SignatureVerifySchema = Schema.Struct({
  email: Schema.optional(
    Schema.Boolean.annotate({
      defaultNote: 'false',
      description:
        'Send a six-digit code to the address frozen on the request before the signer signs. A code is valid ten minutes; a new one may be asked after a minute, three per signer and request, ten an hour per network address; five wrong codes lock that signer for the request.',
    })
  ),
  sms: Schema.optional(SignatureSmsVerificationSchema),
}).pipe(
  Schema.annotate({
    identifier: 'SignatureVerify',
    title: 'Signer Verification',
    description:
      'One-time codes a signer must enter before her signature is accepted. Every channel declared is required: with both, she enters the email code and then the text-message code. Left out, holding the link is the only check.',
    howTo:
      'Declare email: true, an sms connection, or both. Codes need SIGNATURE_OTP_SECRET set on the server.',
  }),
  Schema.check(
    Schema.makeFilter((verify) =>
      verify.email === true || verify.sms !== undefined
        ? true
        : 'verify declares no channel: set email: true, an sms connection, or remove verify'
    )
  )
)

export const SignatureSurfaceSchema = Schema.Struct({
  page: Schema.String.pipe(
    Schema.annotate({
      description:
        'Name of the declared page a signing link opens. Its path must carry a :token segment. Opened through a valid link, the page is served without sign-in and its components read the request as $signing; an unknown, expired, used or revoked link shows the same not-found page.',
      examples: ['contract_signing'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  fields: Schema.optional(
    Schema.Array(
      Schema.String.pipe(
        Schema.annotate({ description: 'A field of the flow’s table' }),
        Schema.check(Schema.isMinLength(1))
      )
    ).pipe(
      Schema.annotate({
        defaultNote: '[]',
        description:
          'Fields of the record the signing page may read, as $signing.record.<field>. Left out, none: the page shows the frozen document ($signing.document) and the statement, never the live record.',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'SignatureSurface',
    title: 'Signing Page',
    description: 'The page a signer opens from her link, and what of the record it may show.',
  })
)

export const SignatureOutputSchema = Schema.Struct({
  signedFile: Schema.String.pipe(
    Schema.annotate({
      description:
        'Single-attachment field the signed PDF is written to once every signer has signed. Only the engine writes it; a write from any client is refused.',
      examples: ['signed_pdf'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  proofFile: Schema.String.pipe(
    Schema.annotate({
      description:
        'Single-attachment field the proof file is written to: a PDF listing each signer, the statement, the document fingerprint and every event of the request. Only the engine writes it.',
      examples: ['proof_pdf'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  status: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: `Field the request status is written to: a single-line-text field, or a single-select or status field whose options include every status (${SIGNATURE_REQUEST_STATUSES.join(', ')}). Only the engine writes it.`,
        examples: ['signing_status'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'SignatureOutput',
    title: 'Signing Output',
    description:
      'The fields of the record the engine writes as the request moves on. A client write to any of them is refused, whatever the client’s permissions.',
  })
)

export const SignatureEvidenceSchema = Schema.Struct({
  keep: boundedDuration(
    {
      description:
        'How long the evidence is kept, counted from the end of the request (completed, declined, cancelled, or expired at its expiry instant): the frozen document, the signed document, the proof file and the event log. It is deleted for good within the hour after this time has passed, and not before, even when the record is deleted. A signature-pad signing a field outside any flow keeps no retention of its own: its evidence follows the record and the person. Between one day and 100 years.',
    },
    { min: MIN_KEEP_MS, max: MAX_KEEP_MS, label: 'between 1d and 100y' }
  ),
  basis: Schema.Literals(SIGNATURE_EVIDENCE_BASES).pipe(
    Schema.annotate({
      description:
        'Why the evidence is kept, as recorded in the evidence file and the processing record: legal-obligation, legal-claims, contract or legitimate-interest. Choosing it is the operator’s decision.',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'SignatureEvidence',
    title: 'Evidence Retention',
    description:
      'How long the evidence of each request is kept and on what basis. Required, with no default: the retention period is a decision for whoever runs the app.',
    howTo:
      'A signer may ask for her data to be erased before keep ends: an administrator posts her signer name to the request erasures endpoint, her contact details, codes and the salts that tie her to the log are deleted and the record cell is redacted, while the log still verifies. Deleting her account does the same.',
  })
)

const findDuplicate = (names: readonly string[]): string | undefined =>
  names.find((name, index) => names.indexOf(name) !== index)

interface FlowShape {
  readonly expires?: string
  readonly verify?: { readonly sms?: unknown }
  readonly signers: readonly {
    readonly name: string
    readonly field: string
    readonly phone?: string
  }[]
  readonly evidence: { readonly keep: string }
}

const signerError = (flow: FlowShape): string | undefined => {
  const duplicateSigner = findDuplicate(flow.signers.map((signer) => signer.name))
  if (duplicateSigner !== undefined) return `signer name "${duplicateSigner}" is declared twice`
  const duplicateField = findDuplicate(flow.signers.map((signer) => signer.field))
  if (duplicateField !== undefined)
    return `two signers store their signature in "${duplicateField}"`
  const phoneless = flow.verify?.sms === undefined ? undefined : flow.signers.find((s) => !s.phone)
  return phoneless === undefined
    ? undefined
    : `signer "${phoneless.name}" has no phone, and verify.sms needs one for every signer`
}

const keepError = (flow: FlowShape): string | undefined => {
  const expires = flow.expires ?? DEFAULT_SIGNATURE_EXPIRES
  const expiresMs = durationToMs(expires) ?? 0
  const keepMs = durationToMs(flow.evidence.keep) ?? 0
  return keepMs > expiresMs
    ? undefined
    : `evidence.keep (${flow.evidence.keep}) must be longer than expires (${expires})`
}

/** Rules a flow can check from its own contents. */
const validateFlowShape = (flow: FlowShape): true | string =>
  signerError(flow) ?? keepError(flow) ?? true

export const SignatureFlowSchema = Schema.Struct({
  name: SignatureFlowNameSchema,
  table: Schema.String.pipe(
    Schema.annotate({
      description: 'The table whose records are signed. One request is sent per record.',
      examples: ['contracts'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  document: SignatureDocumentSchema,
  statement: Schema.String.pipe(
    Schema.annotate({
      description:
        'The sentence each signer agrees to, shown above the signing well and stored with her signature. $record.<field> references and a $t: key are resolved once, when the request is sent, in each signer’s language; the resolved text is frozen on the request.',
      examples: ['I have read and accept $record.title.'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  order: Schema.optional(
    Schema.Literals(['sequential', 'parallel']).pipe(
      Schema.annotate({
        defaultNote: 'sequential',
        description:
          'sequential sends each signer her link once the one before her has signed, in the order of signers; parallel sends every link at once.',
      })
    )
  ),
  expires: Schema.optional(
    boundedDuration(
      {
        defaultNote: DEFAULT_SIGNATURE_EXPIRES,
        description:
          'How long the request stays open after it is sent. Once passed, every unused link stops working and the request is expired. Between one hour and one year.',
      },
      { min: MIN_EXPIRES_MS, max: MAX_EXPIRES_MS, label: 'between 1h and 1y' }
    )
  ),
  reminders: Schema.optional(SignatureRemindersSchema),
  verify: Schema.optional(SignatureVerifySchema),
  surface: SignatureSurfaceSchema,
  signers: Schema.Array(SignatureSignerSchema).pipe(
    Schema.annotate({
      description: `Who signs, from 1 to ${String(MAX_SIGNERS)} signers. With order: sequential, they sign in this order.`,
    }),
    Schema.check(Schema.isMinLength(1), Schema.isMaxLength(MAX_SIGNERS))
  ),
  output: SignatureOutputSchema,
  evidence: SignatureEvidenceSchema,
}).pipe(
  Schema.annotate({
    identifier: 'SignatureFlow',
    title: 'Signing Flow',
    description:
      'One signing flow: the table and document it signs, the statement, who signs and in what order, how signers are verified, the page they sign on, the fields the engine writes back, and how long the evidence is kept.',
  }),
  Schema.check(Schema.makeFilter(validateFlowShape))
)

/** @public */
export type SignatureFlow = Schema.Schema.Type<typeof SignatureFlowSchema>

export const SignaturesSchema = Schema.Array(SignatureFlowSchema).pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.annotate({
    identifier: 'Signatures',
    title: 'Signing Flows',
    description:
      'Signing flows: ask people to sign the PDF a record holds, each through a link of her own, and keep an evidence file of every step. Produces a simple electronic signature with an evidence file. At least one flow when present; names are unique.',
  }),
  Schema.check(
    Schema.makeFilter((flows) => {
      const duplicate = findDuplicate(flows.map((flow) => flow.name))
      return duplicate === undefined ? true : `signing flow name "${duplicate}" is declared twice`
    })
  )
)

/** @public */
export type Signatures = Schema.Schema.Type<typeof SignaturesSchema>
