/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect, Result } from 'effect'
import {
  DOCUMENT_MEDIA_MARKER,
  type DocumentMediaRequest,
  type TemplateRenderer,
} from '@/application/ports/services/template-engine'
import {
  addDocxPictures,
  docxMarkerStage,
  docxPictureMarker,
  docxPictureRequests,
  type DocxPicture,
} from '../ooxml/docx-pictures'
import { fillDocxTemplate, type DocxFillResult, type DocxPartStage } from '../ooxml/docx-template'
import { pictureFileCheck, readRequestedPicture, type PictureFileCheck } from './document-media'
import { writeGeneratedFile } from './document-output'
import { documentRenderSetup, type DocumentRenderSetup } from './document-render-setup'
import {
  actionPropsOf,
  documentDataOf,
  outputPropOf,
  runDocumentAction,
  type Raw,
} from './document-run'
import { readTemplateSource, type TemplateText } from './document-template'
import {
  actionAttributes,
  type ActionHandler,
  type ActionRunContext,
  type AutomationContext,
} from './shared'
import type { App } from '@/domain/models/app'

/**
 * `document/generateDocx`: a Word (`.docx`) template — from `assets` or a
 * bucket — filled with `data` inside the binary, every value XML-escaped.
 *
 * The OOXML engine renders each text-bearing part (body, headers, footers)
 * through the template engine's XML mode; a template read from a bucket
 * renders in the restricted tier, through its bounded compile cache. A
 * template that is not a Word document fails the step naming it, and nothing
 * is written.
 *
 * `{{pageBreak}}` and `{{image}}` print markers the fill's marker stage turns
 * into a page break and a drawing. A picture's bytes are read after a render,
 * so a template asking for one is filled twice: once to learn which pictures
 * it draws, then with them in place (the render is deterministic, so the
 * markers fall where they did). Between the two, each picture marker holds
 * its own request, read back off the filled package.
 */

/** The Word template could not be filled; the message names it. */
class DocxFillFailed extends Data.TaggedError('DocxFillFailed')<{
  readonly reason: string
  readonly message: string
}> {}

/**
 * A part's template text rendered with XML escaping; a refusal stops the fill.
 * A picture is printed as its own encoded request, so the filled package says
 * which pictures it asks for.
 */
const xmlRender =
  (
    template: Pick<TemplateText, 'trust'>,
    templates: TemplateRenderer,
    setup: DocumentRenderSetup
  ) =>
  (text: string, data: Readonly<Record<string, unknown>>): string => {
    const rendering = Result.getOrThrowWith(
      templates.renderDocument(text, data, { ...setup, mode: 'xml', trust: template.trust }),
      (reason) => new Error(reason)
    )
    return rendering.text.replace(DOCUMENT_MEDIA_MARKER, (_marker, index: string) =>
      docxPictureMarker(rendering.media[Number(index)])
    )
  }

const failed = (filled: Extract<DocxFillResult, { readonly ok: false }>) =>
  new DocxFillFailed({
    reason: filled.error.reason,
    message: `${filled.error.reason}: ${filled.error.message}`,
  })

/** The picture an encoded `image` request names, read and sized. */
const pictureFor = (request: unknown, check: PictureFileCheck | undefined) =>
  readRequestedPicture(request as Extract<DocumentMediaRequest, { readonly kind: 'image' }>, check)

/** One fill of the template, its markers turned into page breaks and drawings by `stage`. */
const fillOnce = (
  template: TemplateText,
  data: Raw,
  render: (text: string, data: Readonly<Record<string, unknown>>) => string,
  stage: DocxPartStage
) =>
  fillDocxTemplate({
    template: template.bytes,
    templateName: template.path ?? 'the template',
    data,
    render,
    stages: [stage],
  })

/**
 * Fill a Word template with `data`, its pictures read and placed: the fill
 * every `.docx` output shares (an automation step, `sovrium render`).
 */
export const fillWordTemplate = Effect.fn('automations.fill-word-template')(function* (
  template: TemplateText,
  data: Raw,
  templates: TemplateRenderer,
  setup: DocumentRenderSetup & { readonly pictures?: PictureFileCheck }
) {
  const { pictures: check, ...renderSetup } = setup
  const render = xmlRender(template, templates, renderSetup)
  const fill = (keys: ReadonlyArray<string>, pictures: ReadonlyArray<DocxPicture>) =>
    fillOnce(template, data, render, docxMarkerStage(keys, pictures))
  const first = fill([], [])
  if (!first.ok) return yield* failed(first)
  // `qrcode` refuses itself in Word, so every picture asked for is an `image`.
  const requests = docxPictureRequests(first.bytes)
  if (requests.length === 0) return { bytes: first.bytes, contentType: first.contentType }
  const keys = requests.map(([key]) => key)
  const pictures = yield* Effect.forEach(requests, ([, request]) => pictureFor(request, check))
  const second = fill(keys, pictures)
  if (!second.ok) return yield* failed(second)
  return { bytes: addDocxPictures(second.bytes, pictures), contentType: second.contentType }
})

const fillDocx = (
  props: Raw,
  app: App,
  automation: AutomationContext,
  runContext: ActionRunContext | undefined
) =>
  Effect.gen(function* () {
    if (runContext === undefined) {
      return yield* new DocxFillFailed({
        reason: 'render_failed',
        message: 'render_failed: no template engine to render the template',
      })
    }
    const template = yield* readTemplateSource(props['template'])
    const setup = yield* documentRenderSetup(app, props['locale'], 'word')
    const data = documentDataOf(props, runContext)
    return yield* fillWordTemplate(template, data, runContext.templates, {
      ...setup,
      pictures: pictureFileCheck(template, data, { app, automation, runContext }),
    })
  })

export const handleDocumentGenerateDocx: ActionHandler = (action, app, automation, runContext) => {
  const props = actionPropsOf(action)
  return runDocumentAction(
    'document.generateDocx',
    Effect.flatMap(fillDocx(props, app, automation, runContext), (file) =>
      writeGeneratedFile({ output: outputPropOf(props), file, app, automation, runContext })
    )
  ).pipe(
    Effect.withSpan('automations.handle-document-generate-docx', {
      attributes: actionAttributes(action),
    })
  )
}
