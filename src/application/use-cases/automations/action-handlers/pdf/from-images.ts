/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { PdfEditor } from '@/application/ports/services/pdf-editor'
import { sniffContentType } from '@/domain/kernel/identity/content-sniff'
import { decodedHandler, type DecodedAction } from '../decoded-handler'
import { runDocumentAction, typedOwnProp } from '../document/run'
import { fileRefsOf, type FileRefItem } from '../file/ref-origin'
import { actionAttributes } from '../shared'
import { PdfFromImagesSettings } from './settings'
import { PdfStepError, readFile, refuse, writePdf, type PdfScope } from './step'
import type { ImageLayoutRequest } from '@/domain/models/app/automations/actions/pdf/image-page-layout-service'

/**
 * `pdf/fromImages`: a PDF of pictures, one page each, in order. A JPEG or a
 * PNG goes in as it is, a WebP is converted; anything else fails the step
 * naming its position in the list, before anything is written.
 */

const PICTURE_TYPES: ReadonlySet<string> = new Set(['image/jpeg', 'image/png', 'image/webp'])

type FromImagesProps = DecodedAction<typeof PdfFromImagesSettings>['props']

/** How the pictures are laid out, with the defaults filled in. */
const layoutOf = (props: FromImagesProps): Omit<ImageLayoutRequest, 'picture'> => ({
  pageSize: props.pageSize ?? 'A4',
  orientation: props.orientation ?? 'auto',
  fit: props.fit ?? 'contain',
  margin: props.margin ?? 0,
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

const fromImages = (props: FromImagesProps, scope: PdfScope) =>
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
    return yield* writePdf(props.output, built, scope)
  })

export const handlePdfFromImages = decodedHandler(
  PdfFromImagesSettings,
  (action, app, automation, runContext) =>
    runDocumentAction(
      'pdf.fromImages',
      fromImages(action.props, { app, automation, runContext })
    ).pipe(
      Effect.withSpan('automations.handle-pdf-from-images', {
        attributes: actionAttributes(action),
      })
    )
)
