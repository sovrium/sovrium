/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { PdfEditor } from '@/application/ports/services/pdf-editor'
import { sniffContentType } from '@/domain/kernel/identity/content-sniff'
import { FROM_IMAGES_PAGE_SIZES } from '@/domain/models/app/automations/actions/pdf/from-images'
import { runDocumentAction, typedOwnProp, type Raw } from './document-run'
import { fileRefsOf, type FileRefItem } from './file-ref-origin'
import {
  numberOr,
  outputOf,
  PdfStepError,
  propsOf,
  readFile,
  refuse,
  writePdf,
  type PdfScope,
} from './pdf-step'
import { actionAttributes, type ActionHandler } from './shared'
import type { ImageLayoutRequest } from '@/domain/models/app/automations/actions/pdf/image-page-layout-service'

/**
 * `pdf/fromImages`: a PDF of pictures, one page each, in order. A JPEG or a
 * PNG goes in as it is, a WebP is converted; anything else fails the step
 * naming its position in the list, before anything is written.
 */

const PICTURE_TYPES: ReadonlySet<string> = new Set(['image/jpeg', 'image/png', 'image/webp'])

const oneOf = <T extends string>(choices: readonly T[], value: unknown, fallback: T): T =>
  choices.find((choice) => choice === value) ?? fallback

/** How the pictures are laid out, with the defaults filled in. */
const layoutOf = (props: Raw): Omit<ImageLayoutRequest, 'picture'> => ({
  pageSize: oneOf(FROM_IMAGES_PAGE_SIZES, props['pageSize'], 'A4'),
  orientation: oneOf(['auto', 'portrait', 'landscape'] as const, props['orientation'], 'auto'),
  fit: oneOf(['contain', 'cover', 'stretch'] as const, props['fit'], 'contain'),
  margin: Math.max(numberOr(props['margin'], 0), 0),
})

/** Read the picture at `index` (1-based in messages), refusing what is not a picture. */
const readPicture = (ref: FileRefItem, index: number, scope: PdfScope) =>
  Effect.gen(function* () {
    const label = `image #${index + 1}`
    const read = yield* readFile(ref, label, scope)
    const type = sniffContentType(read.bytes)
    if (type === undefined || !PICTURE_TYPES.has(type)) {
      return yield* refuse(`${label} (${read.filename}) is not a JPEG, a PNG or a WebP`)
    }
    return read.bytes
  })

const fromImages = (props: Raw, scope: PdfScope) =>
  Effect.gen(function* () {
    const refs = fileRefsOf(
      typedOwnProp(props, 'images', scope.runContext),
      'images',
      scope.runContext
    )
    if (refs.length === 0) return yield* refuse('images names no picture')
    const pictures = yield* Effect.forEach(refs, (ref, index) => readPicture(ref, index, scope))
    const built = yield* (yield* PdfEditor).fromImages(pictures, layoutOf(props)).pipe(
      Effect.mapError(
        (error) =>
          new PdfStepError({
            message: error.index < 0 ? error.message : `image #${error.index + 1} ${error.message}`,
          })
      )
    )
    return yield* writePdf(outputOf(props, 'images.pdf'), built, scope)
  })

export const handlePdfFromImages: ActionHandler = (action, app, automation, runContext) =>
  runDocumentAction(
    'pdf.fromImages',
    fromImages(propsOf(action), { app, automation, runContext })
  ).pipe(
    Effect.withSpan('automations.handle-pdf-from-images', { attributes: actionAttributes(action) })
  )
