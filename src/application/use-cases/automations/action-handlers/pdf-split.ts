/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { PdfEditor } from '@/application/ports/services/pdf-editor'
import {
  partName,
  splitGroups,
} from '@/domain/models/app/automations/actions/pdf/page-plan-service'
import { runDocumentAction, type Raw } from './document-run'
import {
  carryOut,
  fileRefProp,
  openPdfFile,
  outputOf,
  propsOf,
  refuse,
  writePdf,
  type PdfScope,
} from './pdf-step'
import { actionAttributes, type ActionHandler } from './shared'
import type { App } from '@/domain/models/app'

/**
 * `pdf/split`: cut one PDF into several — by `ranges`, `every` N pages, or one
 * file per page. Part `n` is named from the output's `filename` and `key`
 * (`{n}` filled in, or `-n` before the extension), so no part overwrites
 * another. Every range is checked before the first part is written.
 */

/** Refuse to put several parts into a field that holds one file. */
const assertAttachable = (app: App, attachTo: unknown, parts: number) => {
  if (parts <= 1 || attachTo === null || typeof attachTo !== 'object') return Effect.void
  const { table, field } = attachTo as Raw
  const column = app.tables?.find((t) => t.name === table)?.fields.find((f) => f.name === field)
  return column?.type === 'single-attachment'
    ? refuse(
        `attachTo field "${String(table)}.${String(field)}" holds one file, and the split makes ${parts} parts; attach them to a multiple-attachments field`
      )
    : Effect.void
}

/** The output of part `n`: its name and key numbered, and later parts appended to the field. */
const partOutput = (output: Raw, filename: string, n: number): Raw => {
  const key = typeof output['key'] === 'string' && output['key'] !== '' ? output['key'] : undefined
  const attachTo = output['attachTo'] as Raw | undefined
  return {
    filename: partName(filename, n),
    ...(key === undefined ? {} : { key: partName(key, n) }),
    ...(attachTo === undefined || n === 1 ? {} : { attachTo: { ...attachTo, mode: 'append' } }),
  }
}

const splitFile = (props: Raw, scope: PdfScope) =>
  Effect.gen(function* () {
    const { pdf, filename: source } = yield* openPdfFile(fileRefProp(props, 'file', scope), scope)
    const groups = yield* carryOut(splitGroups(props, pdf.pages.length))
    const output = (props['output'] as Raw | undefined) ?? {}
    yield* assertAttachable(scope.app, output['attachTo'], groups.length)
    const parts = yield* (yield* PdfEditor).pick(pdf, groups)
    const filename =
      typeof output['filename'] === 'string' && output['filename'] !== ''
        ? output['filename']
        : source
    const files = yield* Effect.forEach(parts, (part, index) =>
      writePdf(outputOf(props, filename, partOutput(output, filename, index + 1)), part, scope)
    )
    return { files, count: files.length }
  })

export const handlePdfSplit: ActionHandler = (action, app, automation, runContext) =>
  runDocumentAction('pdf.split', splitFile(propsOf(action), { app, automation, runContext })).pipe(
    Effect.withSpan('automations.handle-pdf-split', { attributes: actionAttributes(action) })
  )
