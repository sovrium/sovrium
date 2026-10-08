/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { PdfEditor, type PdfFormValue } from '@/application/ports/services/pdf-editor'
import { isRecord, runDocumentAction, typedOwnProp, type Raw } from './document-run'
import {
  fileRefProp,
  openPdfFile,
  outputOf,
  propsOf,
  refuse,
  writePdf,
  type PdfScope,
} from './pdf-step'
import { actionAttributes, type ActionHandler } from './shared'

/**
 * `pdf/fillForm`: write values into a PDF form by field name, optionally
 * flattening it. `fields` is a map written in the config, or one template
 * resolving to such a map at run time. The editor checks every name and every
 * choice before writing any, so a renamed field fails the step.
 */

/** `fields` as the run resolved it: an object, or the JSON text of one. */
const fieldsMap = (value: unknown): Raw | undefined => {
  if (isRecord(value)) return value
  if (typeof value !== 'string' || !value.trim().startsWith('{')) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

const isFormValue = (value: unknown): value is PdfFormValue =>
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value)) ||
  (Array.isArray(value) && value.every((item) => typeof item === 'string'))

/** The values to write, or a refusal naming the first one no field can take. */
const formValues = (props: Raw, scope: PdfScope) => {
  const fields = fieldsMap(typedOwnProp(props, 'fields', scope.runContext))
  if (fields === undefined) {
    return refuse('fields must be a map of field names to values')
  }
  const invalid = Object.entries(fields).find(([, value]) => !isFormValue(value))
  return invalid === undefined
    ? Effect.succeed(fields as Readonly<Record<string, PdfFormValue>>)
    : refuse(`field "${invalid[0]}" takes text, a number, true or false, or a list of options`)
}

const fillForm = (props: Raw, scope: PdfScope) =>
  Effect.gen(function* () {
    const { pdf, filename } = yield* openPdfFile(fileRefProp(props, 'file', scope), scope)
    const values = yield* formValues(props, scope)
    const flatten = props['flatten'] === true || props['flatten'] === 'true'
    const filled = yield* (yield* PdfEditor).fillForm(pdf, values, flatten)
    return yield* writePdf(outputOf(props, filename), filled, scope)
  })

export const handlePdfFillForm: ActionHandler = (action, app, automation, runContext) =>
  runDocumentAction(
    'pdf.fillForm',
    fillForm(propsOf(action), { app, automation, runContext })
  ).pipe(
    Effect.withSpan('automations.handle-pdf-fill-form', { attributes: actionAttributes(action) })
  )
