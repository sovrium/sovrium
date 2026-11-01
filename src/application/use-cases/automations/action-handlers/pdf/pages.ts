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
import { decodedHandler, type DecodedAction } from '../decoded-handler'
import { runDocumentAction } from '../document/run'
import { actionAttributes } from '../shared'
import { PdfPagesSettings } from './settings'
import { carryOut, fileRefProp, openPdfFile, refuse, writePdf, type PdfScope } from './step'

type PagesProps = DecodedAction<typeof PdfPagesSettings>['props']
type RotateProps = Extract<PagesProps, { readonly operation: 'rotate' }>

/**
 * `pdf/pages`: `delete`, `extract`, `reorder` or `rotate` the pages of one
 * PDF. The pages are checked first — a range past the end, a reorder that
 * leaves out or repeats a page, a delete of every page — so a refused step
 * writes nothing. A rotation adds to the page's own.
 */

/** The pages the operation keeps, in their new order. */
const keptPages = (props: Exclude<PagesProps, RotateProps>, pageCount: number) => {
  const { operation, pages } = props
  if (operation === 'delete') return carryOut(deletePlan(pages, pageCount))
  if (operation === 'reorder') return carryOut(reorderPlan(pages, pageCount))
  return carryOut(pagesOrRefusal(pages, pageCount))
}

/** `rotate`: each listed page's new rotation, by index. */
const rotations = (props: RotateProps, pdf: OpenedPdf) =>
  Effect.map(carryOut(pagesOrRefusal(props.pages, pdf.pages.length)), (indexes) => {
    const { angle } = props
    return new Map(
      indexes.map((index) => [index, addRotation(pdf.pages[index]?.rotation ?? 0, angle)] as const)
    )
  })

const changePages = (props: PagesProps, scope: PdfScope) =>
  Effect.gen(function* () {
    const { pdf } = yield* openPdfFile(fileRefProp(props.file, 'file', scope), scope)
    const editor = yield* PdfEditor
    if (props.operation === 'rotate') {
      const turned = yield* editor.rotate(pdf, yield* rotations(props, pdf))
      return yield* writePdf(props.output, turned, scope)
    }
    const kept = yield* keptPages(props, pdf.pages.length)
    const [built] = yield* editor.pick(pdf, [kept])
    if (built === undefined) return yield* refuse('the pages could not be copied')
    return yield* writePdf(props.output, built, scope)
  })

export const handlePdfPages = decodedHandler(
  PdfPagesSettings,
  (action, app, automation, runContext) =>
    runDocumentAction('pdf.pages', changePages(action.props, { app, automation, runContext })).pipe(
      Effect.withSpan('automations.handle-pdf-pages', { attributes: actionAttributes(action) })
    )
)
