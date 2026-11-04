/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a signer's mark and the proof file say, as text.
 *
 * The proof file is printed with the PDF base font, which draws the Latin
 * characters of Windows-1252 and nothing else. Any other character is printed
 * as its code point, `U+XXXX`, so a name in another script stays readable and
 * exact rather than turning into blanks or a substitute glyph. Every value is
 * text: a name or a statement carrying markup or PDF syntax is printed as the
 * characters it holds, never interpreted.
 *
 * The authoritative evidence is `evidence.json`, embedded in the proof file
 * and kept beside it; the printed pages are its readable copy.
 *
 * Pure: the caller supplies the font's coverage, the signers and the chain.
 */

/** Whether the font can draw one code point. */
export type CanDraw = (codePoint: number) => boolean

/** The code point of `character` spelled `U+XXXX`, four hex digits at least. */
const codePointName = (codePoint: number): string =>
  `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`

/**
 * `text` as the font can print it: line breaks and tabs become spaces, and
 * each character the font cannot draw becomes its code point.
 */
export const printableText = (text: string, canDraw: CanDraw): string =>
  [...text.replace(/[\t\n\r\f\v]/g, ' ')]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return canDraw(codePoint) ? character : codePointName(codePoint)
    })
    .join('')

/** What a mark's annotation says: who signed and when, exactly as recorded. */
export const markContents = (displayName: string, signedAt: string): string =>
  `Signed by ${displayName} on ${signedAt}`

/** The two lines a typed mark draws: the signer's name, then the day she signed. */
export const markLines = (displayName: string, signedAt: string): readonly [string, string] => [
  displayName,
  `Signed ${signedAt.slice(0, 10)}`,
]

/** One signer as the proof file lists her. */
export interface ProofSigner {
  /** Her name within the flow. */
  readonly name: string
  /** The name she was invited under. */
  readonly displayName: string
  readonly statement: string
  readonly signedAt: string
  readonly method: string
  readonly identityKind: string
}

/** One signer who signed, as completion reads her: what the proof prints, and her drawn mark. */
export interface CompletedSigner extends ProofSigner {
  /** The evidence key of the PNG she drew, when she drew one. */
  readonly markKey?: string | undefined
}

/** A `signed` event as the chain holds it: who, when, and what it recorded. */
interface SignedEventShape {
  readonly type: string
  readonly at: string
  readonly signer?: string | undefined
  readonly data: { readonly [key: string]: unknown }
}

const textOf = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value !== '' ? value : fallback

/**
 * Every signer who signed, in signing order, from the request's chain: her
 * instant, method, identification and drawn mark come from her `signed`
 * event; the name she was invited under from `displayNames` (her email
 * address stands in when she was invited under none); her statement from the
 * statements frozen at send.
 */
export const completedSignersOf = (input: {
  readonly events: readonly SignedEventShape[]
  readonly displayNames: Readonly<Record<string, string | undefined>>
  readonly statements: Readonly<Record<string, string>>
}): readonly CompletedSigner[] =>
  input.events
    .filter((event) => event.type === 'signed' && event.signer !== undefined)
    .map((event) => {
      const name = event.signer ?? ''
      const { markKey } = event.data
      return {
        name,
        displayName: textOf(input.displayNames[name], name),
        statement: input.statements[name] ?? '',
        signedAt: event.at,
        method: textOf(event.data['method'], 'unknown'),
        identityKind: textOf(event.data['identity'], 'anonymous'),
        markKey: typeof markKey === 'string' ? markKey : undefined,
      }
    })

/** One event of the request's log, as the proof file lists it. */
export interface ProofEvent {
  readonly seq: number
  readonly type: string
  readonly at: string
  readonly signer?: string | undefined
  readonly hash: string
}

/** Everything a proof file prints. */
export interface ProofInput {
  readonly appName: string
  readonly requestId: string
  readonly flow: string
  readonly documentHash: string
  readonly pages: number
  /** SHA-256 of the signed document the proof accompanies. */
  readonly signedDocumentSha256: string
  readonly sealed: boolean
  readonly signers: readonly ProofSigner[]
  readonly events: readonly ProofEvent[]
  readonly headHash: string
  /** Absent for a signature captured on a record, which keeps no retention of its own. */
  readonly keepUntil?: string | undefined
  readonly basis?: string | undefined
}

/** How a proof line is set: a title, a section heading, running text, or a fingerprint. */
export type ProofLineStyle = 'title' | 'heading' | 'text' | 'fingerprint'

/** One line of the proof file, before it is wrapped to the page. */
export interface ProofLine {
  readonly style: ProofLineStyle
  readonly text: string
}

const line = (style: ProofLineStyle, text: string): ProofLine => ({ style, text })

const blank = line('text', '')

/** The block listing one signer. */
const signerLines = (signer: ProofSigner, index: number): readonly ProofLine[] => [
  line('text', `${String(index + 1)}. ${signer.displayName} (${signer.name})`),
  line('text', `Statement: ${signer.statement}`),
  line('text', `Signed at: ${signer.signedAt}`),
  line('text', `Method: ${signer.method}`),
  line('text', `Identification: ${signer.identityKind}`),
  blank,
]

/** The block listing one event of the log: what, when, for whom, and its hash. */
const eventLines = (event: ProofEvent): readonly ProofLine[] => [
  line(
    'text',
    `${String(event.seq)}. ${event.type} at ${event.at}${event.signer === undefined ? '' : ` (${event.signer})`}`
  ),
  line('fingerprint', event.hash),
]

/** What the proof says about the seal. */
const sealLine = (sealed: boolean): string =>
  sealed
    ? 'The signed document carries the organisation seal.'
    : 'The signed document carries no seal: this server has no seal key configured.'

/** The lines of a proof file, in reading order. */
export const proofLines = (input: ProofInput): readonly ProofLine[] => [
  line('title', 'Signature proof'),
  line('text', `The record of a signing request made in ${input.appName}.`),
  blank,
  line('heading', 'Request'),
  line('text', `Request: ${input.requestId}`),
  line('text', `Flow: ${input.flow}`),
  ...(input.keepUntil === undefined
    ? []
    : [line('text', `Evidence kept until ${input.keepUntil}, basis: ${input.basis ?? ''}.`)]),
  blank,
  line('heading', 'Document'),
  line('text', `Pages: ${String(input.pages)}`),
  line('text', 'Fingerprint of the document every signer signed (SHA-256):'),
  line('fingerprint', input.documentHash),
  line('text', 'Fingerprint of the signed document (SHA-256):'),
  line('fingerprint', input.signedDocumentSha256),
  line('text', sealLine(input.sealed)),
  blank,
  line('heading', 'Signers'),
  ...input.signers.flatMap(signerLines),
  line('heading', 'Event log'),
  ...input.events.flatMap(eventLines),
  blank,
  line('text', 'Head of the log (SHA-256 of the last event):'),
  line('fingerprint', input.headHash),
  blank,
  line(
    'text',
    'The authoritative record is evidence.json, attached to this file and kept with the request evidence.'
  ),
]
