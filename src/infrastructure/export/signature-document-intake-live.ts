/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `SignatureDocumentIntake` over pdf-lib.
 *
 * Every check reads the PARSED document, never its bytes: a script stored in a
 * compressed object stream is one more object once the parser has unpacked
 * the stream, so it is found where a byte scan would see only deflated noise.
 * Every object is walked, and every dictionary and array inside it, so an
 * action written inline in the catalog is found as surely as one stored apart.
 *
 * In order, a document is refused when it is too large, cannot be parsed
 * (damaged), is encrypted, has no page or too many, already carries a
 * signature, runs anything when opened or touched (JavaScript, a launch, an
 * import, an additional action, XFA, rich media), or holds optional-content
 * layers (what it shows would depend on which layers a reader turns on).
 *
 * A document that passes is rewritten once, without object streams, so every
 * dictionary of the frozen copy is readable in the clear: each unsigned
 * signature field it brought becomes a plain box keeping its name and
 * rectangle (a place a mark may later be drawn), and one unsigned signature
 * field is declared for the organisation's seal, on the last page.
 */

import { Effect, Layer } from 'effect'
import {
  SignatureDocumentIntake,
  SignatureDocumentRefusal,
} from '@/application/ports/services/signature-document-intake'
import {
  MAX_SIGNATURE_DOCUMENT_BYTES,
  MAX_SIGNATURE_DOCUMENT_PAGES,
  SIGNATURE_DOCUMENT_REFUSAL_MESSAGES,
  SIGNATURE_SEAL_FIELD_NAME,
  type SignatureDocumentRefusalCode,
} from '@/domain/models/app/signatures/signature-request-service'
import { pdfLib, type PdfLib } from './pdf-editor-library'
import type { PreparedSignatureDocument } from '@/application/ports/services/signature-document-intake'
import type { PDFArray, PDFDict, PDFDocument, PDFObject, PDFRef } from '@cantoo/pdf-lib'

/** A refusal raised while a document is read; caught once, at the port. */
class Refused extends Error {
  constructor(readonly code: SignatureDocumentRefusalCode) {
    super(SIGNATURE_DOCUMENT_REFUSAL_MESSAGES[code])
  }
}

/** Keys whose mere presence means the document acts on its own. */
const ACTIVE_KEYS = ['JS', 'JavaScript', 'AA', 'XFA', 'RichMedia', 'RichMediaContent'] as const

/** Action types that run something: a script, a program, an import, a media rendition. */
const ACTIVE_ACTIONS = new Set([
  'JavaScript',
  'Launch',
  'ImportData',
  'Rendition',
  'RichMediaExecute',
])

/** What a walk of the document found, all at once. */
interface Findings {
  readonly signed: boolean
  readonly active: boolean
  readonly hidden: boolean
}

const NONE: Findings = { signed: false, active: false, hidden: false }

const merge = (a: Findings, b: Findings): Findings => ({
  signed: a.signed || b.signed,
  active: a.active || b.active,
  hidden: a.hidden || b.hidden,
})

/** The name a dictionary holds under `key`, without its slash, or `undefined`. */
const nameAt = (lib: PdfLib, dict: PDFDict, key: string): string | undefined => {
  const value = dict.get(lib.PDFName.of(key))
  return value instanceof lib.PDFName ? value.decodeText() : undefined
}

/** What one dictionary says about itself, before its children are read. */
const ownFindings = (lib: PdfLib, dict: PDFDict): Findings => {
  const has = (key: string) => dict.has(lib.PDFName.of(key))
  const type = nameAt(lib, dict, 'Type')
  const action = nameAt(lib, dict, 'S')
  const fieldType = nameAt(lib, dict, 'FT')
  return {
    signed: type === 'Sig' || has('ByteRange') || (fieldType === 'Sig' && has('V')),
    active:
      ACTIVE_KEYS.some(has) ||
      (action !== undefined && ACTIVE_ACTIONS.has(action)) ||
      nameAt(lib, dict, 'Subtype') === 'RichMedia',
    hidden: has('OCProperties'),
  }
}

/** Everything `object` holds, inline dictionaries and arrays included; references are walked apart. */
const findingsIn = (lib: PdfLib, object: PDFObject | undefined, depth = 0): Findings => {
  if (object === undefined || depth > 64) return NONE
  if (object instanceof lib.PDFStream) return findingsIn(lib, object.dict, depth + 1)
  if (object instanceof lib.PDFArray) {
    return object
      .asArray()
      .reduce((found, item) => merge(found, findingsIn(lib, item, depth + 1)), NONE)
  }
  if (!(object instanceof lib.PDFDict)) return NONE
  return object
    .values()
    .reduce(
      (found, value) => merge(found, findingsIn(lib, value, depth + 1)),
      ownFindings(lib, object)
    )
}

/** What the whole document holds, read object by object after the parser unpacked every stream. */
const documentFindings = (lib: PdfLib, doc: PDFDocument): Findings =>
  doc.context
    .enumerateIndirectObjects()
    .reduce(
      (found, [, object]) => merge(found, findingsIn(lib, object)),
      findingsIn(lib, doc.context.trailerInfo.Root)
    )

/** Whether `bytes` parse as an encrypted document, read leniently. */
const isEncryptedDocument = async (lib: PdfLib, bytes: Uint8Array): Promise<boolean> => {
  const lenient = await lib.PDFDocument.load(bytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  }).catch(() => undefined)
  return (
    lenient !== undefined &&
    (lenient.isEncrypted || lenient.context.trailerInfo.Encrypt !== undefined)
  )
}

/** Parse `bytes`, refusing what is encrypted or cannot be read. */
const parse = async (lib: PdfLib, bytes: Uint8Array): Promise<PDFDocument> => {
  if (await isEncryptedDocument(lib, bytes)) throw new Refused('document-encrypted')
  return lib.PDFDocument.load(bytes, {
    ignoreEncryption: true,
    updateMetadata: false,
    throwOnInvalidObject: true,
  }).catch(() => {
    throw new Refused('document-malformed')
  })
}

/** The page count, refusing a document with none (it parsed to nothing) or too many. */
const pageCountOf = (doc: PDFDocument): number => {
  const count = ((): number => {
    try {
      return doc.getPageCount()
    } catch {
      return 0
    }
  })()
  if (count === 0) throw new Refused('document-malformed')
  if (count > MAX_SIGNATURE_DOCUMENT_PAGES) throw new Refused('document-too-many-pages')
  return count
}

/** Drop the object streams and cross-reference streams the parser kept: the copy is written plain. */
const dropContainerStreams = (lib: PdfLib, doc: PDFDocument): void => {
  doc.context
    .enumerateIndirectObjects()
    .filter(([, object]) => {
      const type = object instanceof lib.PDFStream ? nameAt(lib, object.dict, 'Type') : undefined
      return type === 'ObjStm' || type === 'XRef'
    })
    .forEach(([ref]) => doc.context.delete(ref))
}

/** Every unsigned signature field becomes a plain box, kept by name and rectangle; the form stops listing it. */
const flattenUnsignedFields = (lib: PdfLib, doc: PDFDocument): void => {
  const signatureFields = doc.context
    .enumerateIndirectObjects()
    .filter(
      (entry): entry is [PDFRef, PDFDict] =>
        entry[1] instanceof lib.PDFDict && nameAt(lib, entry[1], 'FT') === 'Sig'
    )
  signatureFields.forEach(([, dict]) => {
    ;['FT', 'V', 'Lock', 'SV', 'Ff'].forEach((key) => dict.delete(lib.PDFName.of(key)))
  })
  const removed = new Set(signatureFields.map(([ref]) => ref.toString()))
  const form = doc.catalog.lookupMaybe(lib.PDFName.of('AcroForm'), lib.PDFDict)
  const fields = form?.lookupMaybe(lib.PDFName.of('Fields'), lib.PDFArray)
  if (form === undefined || fields === undefined) return
  const kept = fields.asArray().filter((ref) => !removed.has(ref.toString()))
  form.set(lib.PDFName.of('Fields'), doc.context.obj(kept) as PDFArray)
}

/** Declare the organisation's seal: one unsigned, invisible signature field on the last page. */
const declareSealField = (lib: PdfLib, doc: PDFDocument): void => {
  const pages = doc.getPages()
  const last = pages[pages.length - 1]
  if (last === undefined) throw new Refused('document-malformed')
  const widget = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    T: lib.PDFString.of(SIGNATURE_SEAL_FIELD_NAME),
    F: 132,
    Rect: [0, 0, 0, 0],
    P: last.ref,
  })
  const ref = doc.context.register(widget)
  last.node.addAnnot(ref)
  doc.catalog.getOrCreateAcroForm().addField(ref)
}

/** Check `bytes` and write the copy every signer signs. */
const prepareDocument = async (bytes: Uint8Array): Promise<PreparedSignatureDocument> => {
  if (bytes.length > MAX_SIGNATURE_DOCUMENT_BYTES) throw new Refused('document-too-large')
  const lib = await pdfLib()
  const doc = await parse(lib, bytes)
  const pages = pageCountOf(doc)
  const found = documentFindings(lib, doc)
  if (found.signed) throw new Refused('document-signed')
  if (found.active) throw new Refused('document-active-content')
  if (found.hidden) throw new Refused('document-hidden-content')
  dropContainerStreams(lib, doc)
  flattenUnsignedFields(lib, doc)
  declareSealField(lib, doc)
  const frozen = await doc.save({
    useObjectStreams: false,
    updateFieldAppearances: false,
    addDefaultPage: false,
  })
  return { bytes: frozen, pages }
}

/** The refusal of a failed preparation; anything unexpected reads as a damaged document. */
const refusalOf = (cause: unknown): SignatureDocumentRefusal => {
  const code = cause instanceof Refused ? cause.code : 'document-malformed'
  return new SignatureDocumentRefusal({ code, message: SIGNATURE_DOCUMENT_REFUSAL_MESSAGES[code] })
}

export const SignatureDocumentIntakeLive = Layer.succeed(
  SignatureDocumentIntake,
  SignatureDocumentIntake.of({
    prepare: (bytes) =>
      Effect.tryPromise({ try: () => prepareDocument(bytes), catch: refusalOf }).pipe(
        Effect.withSpan('signatures.prepare-document', { attributes: { bytes: bytes.length } })
      ),
  })
)
