/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  DocumentRenderer,
  PAGE_NUMBER_TOKEN,
  TOTAL_PAGES_TOKEN,
  type PdfPageSetup,
} from '@/application/ports/services/document-renderer'
import { decodedHandler, type DecodedAction } from '../decoded-handler'
import { actionAttributes, type ActionRunContext, type AutomationContext } from '../shared'
import { starterFileGate, type StarterFileGate } from '../starter-file-gate'
import { pictureFileCheck, renderMarkup, type PictureFileCheck } from './media'
import { writeGeneratedFile } from './output'
import { documentRenderSetup, type DocumentRenderSetup } from './render-setup'
import { documentAssetResolver, documentDataOf, runDocumentAction, type Raw } from './run'
import { DocumentGeneratePdfSettings } from './settings'
import { readTemplateSource, templateContext } from './template'
import type { App } from '@/domain/models/app'

type GeneratePdfProps = DecodedAction<typeof DocumentGeneratePdfSettings>['props']

/**
 * `document/generatePdf`: an HTML template filled with `data`, rendered by
 * the browser engine into a paginated PDF with the page setup the step asks
 * for.
 *
 * `header` and `footer` are templates rendered with the same `data` plus
 * `pageNumber` and `totalPages`, which hold the engine's page tokens: plain
 * text, so they survive escaping, filled by the engine on every page. Without
 * a configured engine the step fails with `renderer_unavailable`, naming the
 * variable to set, and nothing is written.
 */

/** The page size, orientation and margins as the step declares them. */
const pageLayout = ({ pageSize, orientation, margins }: GeneratePdfProps): PdfPageSetup => ({
  ...(pageSize === undefined ? {} : { pageSize }),
  ...(orientation === undefined ? {} : { orientation }),
  ...(margins === undefined ? {} : { margins }),
})

/** A `header` or `footer` template rendered with the page tokens, or nothing. */
const renderBand = (
  source: GeneratePdfProps['header'],
  data: Raw,
  setup: DocumentRenderSetup & { readonly target: 'html' },
  run: {
    readonly runContext: ActionRunContext | undefined
    readonly check: (template: { readonly name: string }) => PictureFileCheck
    readonly gate: StarterFileGate
  }
) =>
  Effect.gen(function* () {
    if (source === undefined) return undefined
    const template = yield* readTemplateSource(source, run.gate)
    const context = templateContext(
      template,
      { ...data, pageNumber: PAGE_NUMBER_TOKEN, totalPages: TOTAL_PAGES_TOKEN },
      run.runContext
    )
    return yield* renderMarkup(
      template,
      context,
      { ...setup, pictures: run.check(template) },
      run.runContext
    )
  })

const renderPdf = (
  props: GeneratePdfProps,
  app: App,
  automation: AutomationContext,
  runContext: ActionRunContext | undefined
) =>
  Effect.gen(function* () {
    const data = documentDataOf(props, runContext)
    const check = (template: { readonly name: string }) =>
      pictureFileCheck(template, data, { app, automation, runContext })
    const gate = starterFileGate(app, automation)
    const template = yield* readTemplateSource(props.template, gate)
    const setup = {
      ...(yield* documentRenderSetup(app, props.locale, 'html')),
      target: 'html',
    } as const
    const html = yield* renderMarkup(
      template,
      templateContext(template, data, runContext),
      { ...setup, pictures: check(template) },
      runContext
    )
    const headerHtml = yield* renderBand(props.header, data, setup, { runContext, check, gate })
    const footerHtml = yield* renderBand(props.footer, data, setup, { runContext, check, gate })
    const rendered = yield* (yield* DocumentRenderer).renderPdf(
      html,
      {
        ...pageLayout(props),
        ...(headerHtml === undefined ? {} : { headerHtml }),
        ...(footerHtml === undefined ? {} : { footerHtml }),
      },
      {
        assetResolver: yield* documentAssetResolver,
        allowRemoteAssets: props.allowRemoteAssets === true,
      }
    )
    return { bytes: rendered.bytes, contentType: rendered.contentType, pages: rendered.pages }
  })

export const handleDocumentGeneratePdf = decodedHandler(
  DocumentGeneratePdfSettings,
  (action, app, automation, runContext) =>
    runDocumentAction(
      'document.generatePdf',
      Effect.flatMap(renderPdf(action.props, app, automation, runContext), (file) =>
        writeGeneratedFile({ output: action.props.output, file, app, automation, runContext })
      )
    ).pipe(
      Effect.withSpan('automations.handle-document-generate-pdf', {
        attributes: actionAttributes(action),
      })
    )
)
