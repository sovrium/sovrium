/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { PdfEditor, type OpenedPdf } from '@/application/ports/services/pdf-editor'
import {
  addRotation,
  deletePlan,
  pagesOrRefusal,
  reorderPlan,
} from '@/domain/models/app/automations/actions/pdf/page-plan-service'
import { runDocumentAction, type Raw } from './document-run'
import {
  carryOut,
  numberOr,
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
 * `pdf/pages`: `delete`, `extract`, `reorder` or `rotate` the pages of one
 * PDF. The pages are checked first — a range past the end, a reorder that
 * leaves out or repeats a page, a delete of every page — so a refused step
 * writes nothing. A rotation adds to the page's own.
 */

/** The pages the operation keeps, in their new order. */
const keptPages = (props: Raw, pageCount: number) => {
  const { operation } = props
  if (operation === 'delete') return carryOut(deletePlan(props['pages'], pageCount))
  if (operation === 'reorder') return carryOut(reorderPlan(props['pages'], pageCount))
  return carryOut(pagesOrRefusal(props['pages'], pageCount))
}

/** `rotate`: each listed page's new rotation, by index. */
const rotations = (props: Raw, pdf: OpenedPdf) =>
  Effect.map(carryOut(pagesOrRefusal(props['pages'], pdf.pages.length)), (indexes) => {
    const angle = numberOr(props['angle'], 90)
    return new Map(
      indexes.map((index) => [index, addRotation(pdf.pages[index]?.rotation ?? 0, angle)] as const)
    )
  })

const changePages = (props: Raw, scope: PdfScope) =>
  Effect.gen(function* () {
    const { pdf, filename } = yield* openPdfFile(fileRefProp(props, 'file', scope), scope)
    const editor = yield* PdfEditor
    if (props['operation'] === 'rotate') {
      const turned = yield* editor.rotate(pdf, yield* rotations(props, pdf))
      return yield* writePdf(outputOf(props, filename), turned, scope)
    }
    const kept = yield* keptPages(props, pdf.pages.length)
    const [built] = yield* editor.pick(pdf, [kept])
    if (built === undefined) return yield* refuse('the pages could not be copied')
    return yield* writePdf(outputOf(props, filename), built, scope)
  })

export const handlePdfPages: ActionHandler = (action, app, automation, runContext) =>
  runDocumentAction(
    'pdf.pages',
    changePages(propsOf(action), { app, automation, runContext })
  ).pipe(Effect.withSpan('automations.handle-pdf-pages', { attributes: actionAttributes(action) }))
