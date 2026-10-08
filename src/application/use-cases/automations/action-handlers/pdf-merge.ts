/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { PdfToolkit } from '@/application/ports/services/pdf-toolkit'
import { selectPages } from '@/domain/models/app/automations/page-range-service'
import {
  DEFAULT_RENDERER_MAX_OUTPUT_BYTES,
  DEFAULT_RENDERER_MAX_PAGES,
  parseRendererEnv,
  renderLimitRefusal,
} from '@/domain/models/process-env/renderer'
import { resolveFileRef, type FileRefScope } from './document-file-ref'
import { writeGeneratedFile } from './document-output'
import {
  actionPropsOf,
  isRecord,
  outputPropOf,
  runDocumentAction,
  typedOwnProp,
  type Raw,
} from './document-run'
import { fileRefsOf, type FileRefItem } from './file-ref-origin'
import { actionAttributes, type ActionHandler } from './shared'

/**
 * `pdf/merge`: join PDFs, or chosen pages of them, into one, in the declared
 * order — inside the binary, with no engine.
 *
 * Each input is a file reference, or `{ file, pages }`. `inputs` may also be
 * one template that resolves to a list at run time (a loop's outputs). An
 * input that is not a PDF fails the step naming its position; a `pages`
 * range past its input's last page fails naming the range and the count.
 * Nothing is written when the step fails.
 *
 * A merge is bounded like a render: at most {@link MAX_MERGE_INPUTS} inputs,
 * at most `RENDERER_MAX_PAGES` pages taken from them all, and an output of at
 * most `RENDERER_MAX_OUTPUT_BYTES` — each refusal names its limit.
 */

/** The most inputs one merge reads. */
export const MAX_MERGE_INPUTS = 100

/** The page and size limits a merge shares with the renderer (`RENDERER_MAX_*`). */
const mergeLimits = (): { readonly maxPages: number; readonly maxOutputBytes: number } => {
  const parsed = parseRendererEnv(process.env)
  return parsed.ok
    ? parsed.config
    : { maxPages: DEFAULT_RENDERER_MAX_PAGES, maxOutputBytes: DEFAULT_RENDERER_MAX_OUTPUT_BYTES }
}

/** A merge input could not be used; the message names its position. */
class MergeInputError extends Data.TaggedError('MergeInputError')<{
  readonly message: string
}> {}

/** An input as written: the file it reads and the pages it takes. */
const inputParts = (input: unknown): { readonly file: unknown; readonly pages?: string } =>
  isRecord(input) && 'file' in input
    ? {
        file: input['file'],
        ...(typeof input['pages'] === 'string' ? { pages: input['pages'] } : {}),
      }
    : { file: input }

/** Read, load and select the pages of the input at `index` (1-based in messages). */
const prepareInput = (input: FileRefItem, index: number, scope: FileRefScope) =>
  Effect.gen(function* () {
    const position = `input #${index + 1}`
    const { file, pages } = inputParts(input.ref)
    const read = yield* resolveFileRef({ ...input, ref: file }, scope).pipe(
      Effect.mapError((error) => new MergeInputError({ message: `${position}: ${error.message}` }))
    )
    const pdf = yield* (yield* PdfToolkit)
      .load(read.bytes, index)
      .pipe(
        Effect.mapError(
          () => new MergeInputError({ message: `${position} (${read.filename}) is not a PDF` })
        )
      )
    const selection = selectPages(pages, pdf.pageCount)
    if (!selection.ok) {
      return yield* new MergeInputError({
        message: `${position}: pages "${selection.range}" go past its last page; it has ${pdf.pageCount} page${pdf.pageCount === 1 ? '' : 's'}`,
      })
    }
    return { pdf, pages: selection.indexes }
  })

const mergeInputs = (props: Raw, scope: FileRefScope) =>
  Effect.gen(function* () {
    const { runContext } = scope
    const inputs = fileRefsOf(typedOwnProp(props, 'inputs', runContext), 'inputs', runContext)
    if (inputs.length === 0) {
      return yield* new MergeInputError({ message: 'inputs names no file to merge' })
    }
    if (inputs.length > MAX_MERGE_INPUTS) {
      return yield* new MergeInputError({
        message: `inputs names ${String(inputs.length)} files, above the ${String(MAX_MERGE_INPUTS)}-input limit of a merge`,
      })
    }
    const limits = mergeLimits()
    // Read one input at a time, stopping at the first that takes the page total past the limit.
    const parts = yield* Effect.reduce(
      inputs,
      (): ReadonlyArray<Effect.Success<ReturnType<typeof prepareInput>>> => [],
      (prepared, input, index) =>
        prepareInput(input, index, scope).pipe(
          Effect.flatMap((part) => {
            const pages = [...prepared, part].reduce((sum, p) => sum + p.pages.length, 0)
            const refusal = renderLimitRefusal(limits, { bytes: 0, pages })
            return refusal === undefined
              ? Effect.succeed([...prepared, part])
              : Effect.fail(new MergeInputError({ message: `input #${index + 1}: ${refusal}` }))
          })
        )
    )
    const merged = yield* (yield* PdfToolkit).merge(parts)
    const refusal = renderLimitRefusal(limits, { bytes: merged.bytes.length, pages: merged.pages })
    if (refusal !== undefined) return yield* new MergeInputError({ message: refusal })
    return { bytes: merged.bytes, contentType: 'application/pdf', pages: merged.pages }
  })

export const handlePdfMerge: ActionHandler = (action, app, automation, runContext) => {
  const props = actionPropsOf(action)
  return runDocumentAction(
    'pdf.merge',
    Effect.flatMap(mergeInputs(props, { app, automation, runContext }), (file) =>
      writeGeneratedFile({
        output: { filename: 'merged.pdf', ...outputPropOf(props) },
        file,
        app,
        automation,
        runContext,
      })
    )
  ).pipe(Effect.withSpan('automations.handle-pdf-merge', { attributes: actionAttributes(action) }))
}
