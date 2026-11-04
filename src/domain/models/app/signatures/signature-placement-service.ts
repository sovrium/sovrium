/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where each signer's mark goes on the frozen document.
 *
 * A placement names a field the PDF already holds (`pdfField`), whose box
 * the mark fills, or a page and a point (`page`, `at`, `width`): the point is
 * the mark's top-left corner, in points from the page's top-left corner, the
 * way a person measures a printed page. PDF space runs the other way (its
 * origin is the page's bottom-left corner), so the box is turned over here,
 * once, against the page's own media box.
 *
 * A placement the document cannot hold refuses the send before anything is
 * written: a page past the end (`placement-page-missing`) or a field the PDF
 * does not contain (`placement-field-missing`). `page: last` is the last page
 * of the frozen copy, which no later step changes.
 *
 * Pure: the caller reads the layout from the frozen copy.
 */

import { DEFAULT_SIGNATURE_MARK_WIDTH } from './signature-signer'
import type { SignatureSigner } from './signature-signer'

/** Why a signer's mark cannot be placed on the document. */
export const SIGNATURE_PLACEMENT_REFUSAL_CODES = [
  'placement-field-missing',
  'placement-page-missing',
] as const

/** One of {@link SIGNATURE_PLACEMENT_REFUSAL_CODES}. */
export type SignaturePlacementRefusalCode = (typeof SIGNATURE_PLACEMENT_REFUSAL_CODES)[number]

/** Height over width of a typed mark: a name on one line, the signing day under it. */
export const TYPED_MARK_ASPECT = 1 / 3

/** A page's media box, in PDF points: its lower-left corner and its size. */
export interface PdfPageBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** A named box the document holds, on page `page` (from 0): `[x1, y1, x2, y2]` in PDF points. */
export interface PdfFieldBox {
  readonly name: string
  readonly page: number
  readonly rect: readonly [number, number, number, number]
}

/** What a placement is resolved against: the pages of the frozen copy and its named boxes. */
export interface SignatureDocumentLayout {
  readonly pages: readonly PdfPageBox[]
  readonly fields: readonly PdfFieldBox[]
}

/** Where one mark is drawn: page `page` (from 0), lower-left corner and size, in PDF points. */
export interface MarkBox {
  readonly page: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** A placement resolved: the box its mark fills, or why the document cannot hold it. */
export type PlacementVerdict =
  | { readonly placed: true; readonly box: MarkBox }
  | {
      readonly placed: false
      readonly code: SignaturePlacementRefusalCode
      readonly message: string
    }

type Placement = NonNullable<SignatureSigner['placement']>

const refused = (code: SignaturePlacementRefusalCode, message: string): PlacementVerdict => ({
  placed: false,
  code,
  message,
})

/** The box of a field, its corners put in order whatever order the PDF wrote them in. */
const fieldMarkBox = (field: PdfFieldBox): MarkBox => {
  const [x1, y1, x2, y2] = field.rect
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  return { page: field.page, x, y, width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }
}

/** The page index `page` names: `last`, or a number counted from 1. */
const pageIndexOf = (page: number | 'last', pageCount: number): number =>
  page === 'last' ? pageCount - 1 : page - 1

/**
 * The box a signer's mark fills. `aspect` is the mark's height over its width
 * (the drawn image's, or {@link TYPED_MARK_ASPECT}); a field placement fills
 * the field's box whatever the aspect, the drawing being fitted inside it.
 */
export const placeMark = (
  placement: Placement,
  layout: SignatureDocumentLayout,
  aspect: number
): PlacementVerdict => {
  if ('pdfField' in placement) {
    const field = layout.fields.find((candidate) => candidate.name === placement.pdfField)
    return field === undefined
      ? refused(
          'placement-field-missing',
          `the document has no field named ${placement.pdfField} to draw the mark in`
        )
      : { placed: true, box: fieldMarkBox(field) }
  }
  const index = pageIndexOf(placement.page, layout.pages.length)
  const page = layout.pages[index]
  if (page === undefined || index < 0) {
    return refused(
      'placement-page-missing',
      `the document has ${String(layout.pages.length)} pages, so page ${String(placement.page)} does not exist`
    )
  }
  const width = placement.width ?? DEFAULT_SIGNATURE_MARK_WIDTH
  const height = width * aspect
  const top = page.y + page.height - placement.at.y
  return {
    placed: true,
    box: { page: index, x: page.x + placement.at.x, y: top - height, width, height },
  }
}

/** The first signer whose placement the document cannot hold, with the refusal; none when all fit. */
export const placementRefusalOf = (
  signers: readonly Pick<SignatureSigner, 'name' | 'placement'>[],
  layout: SignatureDocumentLayout
): { readonly code: SignaturePlacementRefusalCode; readonly message: string } | undefined =>
  signers
    .map((signer) =>
      signer.placement === undefined
        ? undefined
        : placeMark(signer.placement, layout, TYPED_MARK_ASPECT)
    )
    .flatMap((verdict) =>
      verdict === undefined || verdict.placed
        ? []
        : [{ code: verdict.code, message: verdict.message }]
    )
    .at(0)

/** Whether any signer of the flow places a mark on the document. */
export const placesAnyMark = (signers: readonly Pick<SignatureSigner, 'placement'>[]): boolean =>
  signers.some((signer) => signer.placement !== undefined)
