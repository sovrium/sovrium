/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { PdfEditor } from '@/application/ports/services/pdf-editor'
import { runDocumentAction } from './document-run'
import { fileRefProp, propsOf, readFile, PdfStepError, type PdfScope } from './pdf-step'
import { actionAttributes, type ActionHandler } from './shared'
import type { FileRefItem } from './file-ref-origin'

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

export const handlePdfInspect: ActionHandler = (action, app, automation, runContext) =>
  runDocumentAction(
    'pdf.inspect',
    inspectFile(fileRefProp(propsOf(action), 'file', { app, automation, runContext }), {
      app,
      automation,
      runContext,
    })
  ).pipe(
    Effect.withSpan('automations.handle-pdf-inspect', { attributes: actionAttributes(action) })
  )
