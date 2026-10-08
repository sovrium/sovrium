/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sniffContentType } from '@/domain/kernel/identity/content-sniff'
import { layImageOnPage } from '@/domain/models/app/automations/actions/pdf/image-page-layout-service'
import { convertImage } from '@/infrastructure/storage/image-processor'
import { pdfLib } from './pdf-editor-library'
import type { BuiltPdf } from '@/application/ports/services/pdf-editor'
import type { ImageLayoutRequest } from '@/domain/models/app/automations/actions/pdf/image-page-layout-service'
import type { PDFDocument, PDFImage } from '@cantoo/pdf-lib'

/**
 * `pdf/fromImages`: one page per picture. A JPEG or a PNG is embedded as it
 * is; a WebP is re-encoded as a PNG on the way in (pdf-lib embeds only the
 * first two). The layout itself — page size, orientation, fit — is the pure
 * `layImageOnPage`.
 */

/** A picture that could not be used; `index` is its 0-based position. */
export class PictureRefusal extends Error {
  constructor(
    readonly index: number,
    message: string
  ) {
    super(message)
  }
}

const embedPicture = async (
  document: PDFDocument,
  bytes: Uint8Array,
  index: number
): Promise<PDFImage> => {
  const type = sniffContentType(bytes)
  if (type === 'image/jpeg') return document.embedJpg(bytes)
  if (type === 'image/png') return document.embedPng(bytes)
  if (type === 'image/webp') return document.embedPng(await convertImage(bytes, 'png'))
  throw new PictureRefusal(index, 'is not a JPEG, a PNG or a WebP')
}

/** Lay one embedded picture on a new page of `document`. */
const addPicturePage = async (
  document: PDFDocument,
  image: PDFImage,
  layout: Omit<ImageLayoutRequest, 'picture'>
): Promise<void> => {
  const lib = await pdfLib()
  const placed = layImageOnPage({
    ...layout,
    picture: { width: image.width, height: image.height },
  })
  const page = document.addPage([placed.page.width, placed.page.height])
  if (layout.fit !== 'cover') {
    page.drawImage(image, placed.picture)
    return
  }
  const { clip } = placed
  page.pushOperators(
    lib.pushGraphicsState(),
    lib.rectangle(clip.x, clip.y, clip.width, clip.height),
    lib.clip(),
    lib.endPath()
  )
  page.drawImage(image, placed.picture)
  page.pushOperators(lib.popGraphicsState())
}

/** A PDF of the pictures, in order, each on its own page. */
export const buildPdfFromPictures = async (
  pictures: readonly Uint8Array[],
  layout: Omit<ImageLayoutRequest, 'picture'>
): Promise<BuiltPdf> => {
  const { PDFDocument: Document } = await pdfLib()
  const document = await Document.create()
  const images = await Promise.all(
    pictures.map((bytes, index) =>
      embedPicture(document, bytes, index).catch((cause: unknown) => {
        if (cause instanceof PictureRefusal) throw cause
        throw new PictureRefusal(index, 'could not be read as a picture')
      })
    )
  )
  await images.reduce(async (previous, image) => {
    await previous
    await addPicturePage(document, image, layout)
  }, Promise.resolve())
  return { bytes: await document.save(), pages: document.getPageCount() }
}
