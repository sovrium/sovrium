/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sniffContentType } from '@/domain/kernel/identity/content-sniff'
import {
  hexToRgb,
  markOrigin,
  type MarkGeometry,
} from '@/domain/models/app/automations/actions/pdf/mark-placement-service'
import { assertDrawable, EditRefusal, pdfLib } from './pdf-editor-library'
import type { BuiltPdf, PdfMarkRequest } from '@/application/ports/services/pdf-editor'
import type { PDFDocument, PDFImage, PDFPage } from '@cantoo/pdf-lib'

/**
 * `pdf/watermark` and `pdf/stamp`: one mark drawn on chosen pages, placed by
 * the shared geometry (`markOrigin`) in the page's MediaBox. Opacity is the
 * fill opacity of an ExtGState (`/ca`), which pdf-lib writes for `opacity`.
 */

type Lib = Awaited<ReturnType<typeof pdfLib>>
type Draw = (page: PDFPage, text: string) => void

/** The geometry of a mark of `box` on `page`, with the request's angle and placement. */
const geometryOn = (
  page: PDFPage,
  request: PdfMarkRequest,
  box: MarkGeometry['box'],
  below: number
): MarkGeometry => {
  const media = page.getMediaBox()
  return {
    page: { width: media.width, height: media.height },
    box,
    below,
    angle: request.angle,
    placement: request.placement,
  }
}

/** Where to draw from, in the page's own coordinates (its MediaBox may not start at 0, 0). */
const drawAt = (
  page: PDFPage,
  geometry: MarkGeometry
): { readonly x: number; readonly y: number } => {
  const media = page.getMediaBox()
  const origin = markOrigin(geometry)
  return { x: media.x + origin.x, y: media.y + origin.y }
}

const textDrawer = async (
  lib: Lib,
  document: PDFDocument,
  request: PdfMarkRequest
): Promise<Draw> => {
  if (request.content.kind !== 'text') throw new EditRefusal('a text mark carries no text')
  const { fontSize: size, color } = request.content
  const font = await document.embedFont(lib.StandardFonts.Helvetica)
  assertDrawable(
    font,
    request.pages.map((page) => page.text ?? '')
  )
  const ascent = font.heightAtSize(size, { descender: false })
  const full = font.heightAtSize(size)
  const { r, g, b } = hexToRgb(color)
  return (page, text) => {
    const box = { width: font.widthOfTextAtSize(text, size), height: full }
    page.drawText(text, {
      ...drawAt(page, geometryOn(page, request, box, full - ascent)),
      size,
      font,
      color: lib.rgb(r, g, b),
      opacity: request.opacity,
      rotate: lib.degrees(request.angle),
    })
  }
}

const embedPicture = async (document: PDFDocument, bytes: Uint8Array): Promise<PDFImage> => {
  const type = sniffContentType(bytes)
  if (type === 'image/png') return document.embedPng(bytes)
  if (type === 'image/jpeg') return document.embedJpg(bytes)
  throw new EditRefusal('image is not a PNG or a JPEG')
}

const imageDrawer = async (document: PDFDocument, request: PdfMarkRequest): Promise<Draw> => {
  if (request.content.kind !== 'image') throw new EditRefusal('an image mark carries no image')
  const lib = await pdfLib()
  const { width: asked } = request.content
  const image = await embedPicture(document, request.content.bytes)
  return (page) => {
    const pageWidth = page.getMediaBox().width
    const width = asked === 'half-page' ? pageWidth / 2 : asked === 'natural' ? image.width : asked
    const box = { width, height: (width * image.height) / image.width }
    page.drawImage(image, {
      ...drawAt(page, geometryOn(page, request, box, 0)),
      ...box,
      opacity: request.opacity,
      rotate: lib.degrees(request.angle),
    })
  }
}

/** Draw the request's mark on its pages and save. */
export const drawPdfMark = async (
  document: PDFDocument,
  request: PdfMarkRequest
): Promise<BuiltPdf> => {
  const lib = await pdfLib()
  const draw =
    request.content.kind === 'text'
      ? await textDrawer(lib, document, request)
      : await imageDrawer(document, request)
  request.pages.forEach(({ index, text }) => draw(document.getPage(index), text ?? ''))
  return { bytes: await document.save(), pages: document.getPageCount() }
}
