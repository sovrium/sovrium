/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { PdfEditor } from '@/application/ports/services/pdf-editor'
import { decodedHandler } from '../decoded-handler'
import { runDocumentAction } from '../document/run'
import { actionAttributes } from '../shared'
import { PdfInspectSettings } from './settings'
import { fileRefProp, readFile, PdfStepError, type PdfScope } from './step'
import type { FileRefItem } from '../file/ref-origin'

/**
 * `pdf/inspect`: report what a PDF holds — pages, their sizes and rotations,
 * metadata, encryption and form fields — and write nothing. An encrypted file
 * is reported, not refused, so a later step can branch on it.
 */

const inspectFile = (file: FileRefItem, scope: PdfScope) =>
  Effect.gen(function* () {
    const read = yield* readFile(file, 'file', scope)
    return yield* (yield* PdfEditor)
      .inspect(read.bytes)
      .pipe(
        Effect.mapError(
          (error) => new PdfStepError({ message: `file (${read.filename}) ${error.message}` })
        )
      )
  })

export const handlePdfInspect = decodedHandler(
  PdfInspectSettings,
  (action, app, automation, runContext) => {
    const scope = { app, automation, runContext }
    return runDocumentAction(
      'pdf.inspect',
      inspectFile(fileRefProp(action.props.file, 'file', scope), scope)
    ).pipe(
      Effect.withSpan('automations.handle-pdf-inspect', { attributes: actionAttributes(action) })
    )
  }
)
