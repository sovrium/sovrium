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
import { findTableByName } from '@/domain/models/app/tables/table-lookup-service'
import { decodedHandler, type DecodedAction } from '../decoded-handler'
import { runDocumentAction } from '../document/run'
import { actionAttributes } from '../shared'
import { PdfSplitSettings } from './settings'
import { carryOut, fileRefProp, openPdfFile, refuse, writePdf, type PdfScope } from './step'
import type { FilledOutput } from '../document/filled-settings'
import type { App } from '@/domain/models/app'

type SplitProps = DecodedAction<typeof PdfSplitSettings>['props']

/**
 * `pdf/split`: cut one PDF into several — by `ranges`, `every` N pages, or one
 * file per page. Part `n` is named from the output's `filename` and `key`
 * (`{n}` filled in, or `-n` before the extension), so no part overwrites
 * another. Every range is checked before the first part is written.
 */

/** Refuse to put several parts into a field that holds one file. */
const assertAttachable = (app: App, attachTo: FilledOutput['attachTo'], parts: number) => {
  if (parts <= 1 || attachTo === undefined) return Effect.void
  const { table, field } = attachTo
  const column = findTableByName(app.tables, table)?.fields.find((f) => f.name === field)
  return column?.type === 'single-attachment'
    ? refuse(
        `attachTo field "${table}.${field}" holds one file, and the split makes ${parts} parts; attach them to a multiple-attachments field`
      )
    : Effect.void
}

/** The output of part `n`: its name and key numbered, and later parts appended to the field. */
const partOutput = (output: FilledOutput, filename: string, n: number): FilledOutput => {
  const { key, attachTo } = output
  return {
    ...output,
    filename: partName(filename, n),
    ...(key === undefined || key === '' ? {} : { key: partName(key, n) }),
    ...(attachTo === undefined || n === 1 ? {} : { attachTo: { ...attachTo, mode: 'append' } }),
  }
}

const splitFile = (props: SplitProps, scope: PdfScope) =>
  Effect.gen(function* () {
    const { pdf, filename: source } = yield* openPdfFile(
      fileRefProp(props.file, 'file', scope),
      scope
    )
    const groups = yield* carryOut(splitGroups(props, pdf.pages.length))
    const { output } = props
    yield* assertAttachable(scope.app, output.attachTo, groups.length)
    const parts = yield* (yield* PdfEditor).pick(pdf, groups)
    const filename = output.filename === '' ? source : output.filename
    const files = yield* Effect.forEach(parts, (part, index) =>
      writePdf(partOutput(output, filename, index + 1), part, scope)
    )
    return { files, count: files.length }
  })

export const handlePdfSplit = decodedHandler(
  PdfSplitSettings,
  (action, app, automation, runContext) =>
    runDocumentAction('pdf.split', splitFile(action.props, { app, automation, runContext })).pipe(
      Effect.withSpan('automations.handle-pdf-split', { attributes: actionAttributes(action) })
    )
)
