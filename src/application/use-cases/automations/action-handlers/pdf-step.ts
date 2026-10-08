/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { PdfEditor, type BuiltPdf } from '@/application/ports/services/pdf-editor'
import { resolveFileRef } from './document-file-ref'
import { writeGeneratedFile } from './document-output'
import { actionPropsOf, outputPropOf, type Raw } from './document-run'
import { fileRefOf, type FileRefItem } from './file-ref-origin'
import type { ActionRunContext, AutomationContext } from './shared'
import type { App } from '@/domain/models/app'
import type { PagePlan } from '@/domain/models/app/automations/actions/pdf/page-plan-service'

/**
 * What the `pdf/*` handlers that read one PDF share: opening `file` with an
 * error naming it, refusing a plan that cannot be carried out, writing the
 * result through the one output road, and turning a failure into the step's
 * error. Every check runs before the write, so a failed step stores nothing.
 */

/** A `pdf/*` step could not do what it says; `message` names what is wrong. */
export class PdfStepError extends Data.TaggedError('PdfStepError')<{
  readonly message: string
}> {}

/** Where a handler runs: the app, the automation and the run. */
export interface PdfScope {
  readonly app: App
  readonly automation: AutomationContext
  readonly runContext: ActionRunContext | undefined
}

export const refuse = (message: string): Effect.Effect<never, PdfStepError> =>
  Effect.fail(new PdfStepError({ message })).pipe(Effect.withSpan('automations.pdf-refuse'))

/** A plan's value, or the step's failure with its reason. */
export const carryOut = <T>(plan: PagePlan<T>): Effect.Effect<T, PdfStepError> =>
  (plan.ok ? Effect.succeed(plan.value) : refuse(plan.reason)).pipe(
    Effect.withSpan('automations.pdf-carry-out')
  )

export const propsOf = actionPropsOf

/** A number prop, or its default. */
export const numberOr = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

/** The one file reference the prop `name` holds (`file`, `image`), with who chose it. */
export const fileRefProp = (props: Raw, name: string, scope: PdfScope): FileRefItem =>
  fileRefOf(props[name], name, scope.runContext)

/** Read the file a reference names, the error naming it as `label`. */
export const readFile = (item: FileRefItem, label: string, scope: PdfScope) =>
  resolveFileRef(item, scope).pipe(
    Effect.mapError((error) => new PdfStepError({ message: `${label}: ${error.message}` })),
    Effect.withSpan('automations.pdf-read-file')
  )

/** Read and open the PDF `file` names; one that is not a PDF, or is encrypted, is refused. */
export const openPdfFile = Effect.fn('automations.pdf-open-file')(function* (
  item: FileRefItem,
  scope: PdfScope
) {
  const read = yield* readFile(item, 'file', scope)
  const pdf = yield* (yield* PdfEditor)
    .open(read.bytes)
    .pipe(
      Effect.mapError(
        (error) => new PdfStepError({ message: `file (${read.filename}) ${error.message}` })
      )
    )
  return { pdf, filename: read.filename }
})

/** The `output` prop, named `filename` unless it names itself, with `overrides` on top. */
export const outputOf = (props: Raw, filename: string, overrides: Raw = {}): Raw => ({
  filename,
  ...outputPropOf(props),
  ...overrides,
})

/** Write a built PDF where `output` says. */
export const writePdf = (output: Raw, built: BuiltPdf, scope: PdfScope) =>
  writeGeneratedFile({
    output,
    file: { bytes: built.bytes, contentType: 'application/pdf', pages: built.pages },
    ...scope,
  }).pipe(Effect.withSpan('automations.pdf-write'))
