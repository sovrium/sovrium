/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The seal's place in a PDF about to be saved: a signature dictionary
 * (`/Filter /Adobe.PPKLite`, `/SubFilter /ETSI.CAdES.detached`) set as the
 * `/V` of a signature field, with a `/ByteRange` and a `/Contents` of fixed
 * width (`signature-seal-service.ts`), filled in once the saved bytes are
 * known. `/SigFlags 3` tells a reader the document is signed and that only
 * incremental updates keep the signature.
 *
 * A signed document's field is the one the frozen copy declared
 * ({@link sealFieldOf}); a proof file is built fresh, so it gets its own
 * invisible field on its first page ({@link addProofSealField}).
 */

import {
  BYTE_RANGE_PLACEHOLDER,
  SEAL_CONTENTS_BYTES,
} from '@/domain/models/app/signatures/signature-seal-service'
import type { PdfLib } from './pdf-editor-library'
import type { PDFDict, PDFDocument } from '@cantoo/pdf-lib'

/** Widget flags of the proof's seal field: printed (4) and locked (128); its box is empty, so nothing shows. */
const INVISIBLE_FIELD_FLAGS = 132

/** The signature field of `doc` named `name`, or `undefined`. */
export const sealFieldOf = (lib: PdfLib, doc: PDFDocument, name: string): PDFDict | undefined => {
  const form = doc.catalog.lookupMaybe(lib.PDFName.of('AcroForm'), lib.PDFDict)
  const fields = form?.lookupMaybe(lib.PDFName.of('Fields'), lib.PDFArray)
  return fields
    ?.asArray()
    .map((ref) => doc.context.lookup(ref))
    .filter((field): field is PDFDict => field instanceof lib.PDFDict)
    .find((field) => {
      const title = field.lookup(lib.PDFName.of('T'))
      const text =
        title instanceof lib.PDFString || title instanceof lib.PDFHexString
          ? title.decodeText()
          : undefined
      return text === name && field.lookup(lib.PDFName.of('FT')) === lib.PDFName.of('Sig')
    })
}

/** Add an invisible signature field named `name` on the first page of `doc`; the field. */
export const addProofSealField = (lib: PdfLib, doc: PDFDocument, name: string): PDFDict => {
  const page = doc.getPage(0)
  const widget = doc.context.obj({
    ...{ Type: 'Annot', Subtype: 'Widget', FT: 'Sig', F: INVISIBLE_FIELD_FLAGS },
    ...{ T: lib.PDFString.of(name), Rect: [0, 0, 0, 0], P: page.ref },
  })
  const ref = doc.context.register(widget)
  page.node.addAnnot(ref)
  doc.catalog.getOrCreateAcroForm().addField(ref)
  return widget
}

/** Make `field` the seal of `doc`: its `/V` a signature dictionary holding the placeholder. */
export const declareSealPlaceholder = (
  lib: PdfLib,
  doc: PDFDocument,
  field: PDFDict,
  signedAt: Date
): void => {
  const signature = doc.context.obj({
    ...{ Type: 'Sig', Filter: 'Adobe.PPKLite', SubFilter: 'ETSI.CAdES.detached' },
    ByteRange: [0, BYTE_RANGE_PLACEHOLDER, BYTE_RANGE_PLACEHOLDER, BYTE_RANGE_PLACEHOLDER],
    Contents: lib.PDFHexString.of('0'.repeat(SEAL_CONTENTS_BYTES * 2)),
    M: lib.PDFString.fromDate(signedAt),
  })
  field.set(lib.PDFName.of('V'), doc.context.register(signature))
  doc.catalog.getOrCreateAcroForm().dict.set(lib.PDFName.of('SigFlags'), lib.PDFNumber.of(3))
}
