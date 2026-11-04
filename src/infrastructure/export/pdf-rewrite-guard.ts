/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The refusal every `pdf/*` save site makes before it rewrites a signed file.
 *
 * A signature covers the file's bytes as they stand (`/ByteRange`): any
 * rewrite (a fill, a mark, a rotation, a page copied into another file)
 * breaks it, and a sealed signed document would leave the step looking valid
 * to nobody. So a document holding a signature value is refused, with words
 * the operator can act on, and the step fails.
 *
 * A signature value is an indirect object, a dictionary or a stream's
 * dictionary, holding both `/ByteRange` and `/Contents`: the `/Type /Sig`
 * dictionary a signature field's `/V` points at. Objects kept in object
 * streams are read too: pdf-lib unpacks them on load. An EMPTY signature
 * field (`/FT /Sig` with no `/V`), as a document frozen for signing declares
 * for the seal, holds no signature and is not refused.
 */

import { EditRefusal, type PdfLib } from './pdf-editor-library'
import type { PDFDocument } from '@cantoo/pdf-lib'

/** The words of the refusal: the step's error. */
export const SIGNED_PDF_REFUSAL =
  'This PDF carries a signature: rewriting it would break the signature, so it is refused.'

/** A save refused because the document carries a signature. */
export class SignedPdfRefusal extends EditRefusal {
  constructor() {
    super(SIGNED_PDF_REFUSAL)
    this.name = 'SignedPdfRefusal'
  }
}

/** Whether `document` holds a signature value (`/ByteRange` and `/Contents` on one object). */
export const carriesSignature = (lib: PdfLib, document: PDFDocument): boolean =>
  document.context.enumerateIndirectObjects().some(([, object]) => {
    const dict =
      object instanceof lib.PDFDict
        ? object
        : object instanceof lib.PDFStream
          ? object.dict
          : undefined
    return (
      dict !== undefined &&
      dict.has(lib.PDFName.of('ByteRange')) &&
      dict.has(lib.PDFName.of('Contents'))
    )
  })

/** Throw {@link SignedPdfRefusal} when `document` carries a signature. */
export const assertRewritable = (lib: PdfLib, document: PDFDocument): void => {
  if (carriesSignature(lib, document)) throw new SignedPdfRefusal()
}
