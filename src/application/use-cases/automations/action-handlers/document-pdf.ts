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
import { pictureFileCheck, renderMarkup, type PictureFileCheck } from './document-media'
import { writeGeneratedFile } from './document-output'
import { documentRenderSetup, type DocumentRenderSetup } from './document-render-setup'
import {
  actionPropsOf,
  documentAssetResolver,
  documentDataOf,
  isRecord,
  outputPropOf,
  runDocumentAction,
  type Raw,
} from './document-run'
import { readTemplateSource, templateContext } from './document-template'
import {
  actionAttributes,
  type ActionHandler,
  type ActionRunContext,
  type AutomationContext,
} from './shared'
import type { App } from '@/domain/models/app'

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

const PAPER_SIZES: ReadonlySet<string> = new Set(['A3', 'A4', 'A5', 'Letter', 'Legal'])

/** The page size, orientation and margins as the step declares them. */
const pageLayout = (props: Raw): PdfPageSetup => {
  const size = props['pageSize']
  const margins = isRecord(props['margins']) ? props['margins'] : undefined
  const side = (name: string) =>
    typeof margins?.[name] === 'string' ? { [name]: margins[name] as string } : {}
  return {
    ...(typeof size === 'string' && PAPER_SIZES.has(size)
      ? { pageSize: size as PdfPageSetup['pageSize'] }
      : {}),
    ...(props['orientation'] === 'landscape' || props['orientation'] === 'portrait'
      ? { orientation: props['orientation'] }
      : {}),
    ...(margins === undefined
      ? {}
      : { margins: { ...side('top'), ...side('right'), ...side('bottom'), ...side('left') } }),
  }
}

/** A `header` or `footer` template rendered with the page tokens, or nothing. */
const renderBand = (
  source: unknown,
  data: Raw,
  setup: DocumentRenderSetup & { readonly target: 'html' },
  run: {
    readonly runContext: ActionRunContext | undefined
    readonly check: (template: { readonly name: string }) => PictureFileCheck
  }
) =>
  Effect.gen(function* () {
    if (source === undefined) return undefined
    const template = yield* readTemplateSource(source)
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
  props: Raw,
  app: App,
  automation: AutomationContext,
  runContext: ActionRunContext | undefined
) =>
  Effect.gen(function* () {
    const data = documentDataOf(props, runContext)
    const check = (template: { readonly name: string }) =>
      pictureFileCheck(template, data, { app, automation, runContext })
    const template = yield* readTemplateSource(props['template'])
    const setup = {
      ...(yield* documentRenderSetup(app, props['locale'], 'html')),
      target: 'html',
    } as const
    const html = yield* renderMarkup(
      template,
      templateContext(template, data, runContext),
      { ...setup, pictures: check(template) },
      runContext
    )
    const headerHtml = yield* renderBand(props['header'], data, setup, { runContext, check })
    const footerHtml = yield* renderBand(props['footer'], data, setup, { runContext, check })
    const rendered = yield* (yield* DocumentRenderer).renderPdf(
      html,
      {
        ...pageLayout(props),
        ...(headerHtml === undefined ? {} : { headerHtml }),
        ...(footerHtml === undefined ? {} : { footerHtml }),
      },
      {
        assetResolver: yield* documentAssetResolver,
        allowRemoteAssets: props['allowRemoteAssets'] === true,
      }
    )
    return { bytes: rendered.bytes, contentType: rendered.contentType, pages: rendered.pages }
  })

export const handleDocumentGeneratePdf: ActionHandler = (action, app, automation, runContext) => {
  const props = actionPropsOf(action)
  return runDocumentAction(
    'document.generatePdf',
    Effect.flatMap(renderPdf(props, app, automation, runContext), (file) =>
      writeGeneratedFile({ output: outputPropOf(props), file, app, automation, runContext })
    )
  ).pipe(
    Effect.withSpan('automations.handle-document-generate-pdf', {
      attributes: actionAttributes(action),
    })
  )
}
