/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect, Result } from 'effect'
import { fillXlsxTemplate } from '../ooxml/xlsx-template'
import { writeGeneratedFile } from './document-output'
import { documentRenderSetup, type DocumentRenderSetup } from './document-render-setup'
import { documentDataOf, outputPropOf, runDocumentAction, type Raw } from './document-run'
import { readTemplateSource, type TemplateText } from './document-template'
import type { AutomationContext, ActionRunContext } from './shared'
import type { TemplateRenderer } from '@/application/ports/services/template-engine'
import type { App } from '@/domain/models/app'

/**
 * `document/generateXlsx` with `template`: a workbook designed in Excel —
 * from `assets` or a bucket — filled with `data` inside the binary
 * (`ooxml/xlsx-template.ts`). A template read from a bucket renders in the
 * engine's restricted tier. A template that is not a workbook fails the step
 * naming it, and nothing is written.
 */

/** The workbook template could not be filled; the message names it. */
class XlsxFillFailed extends Data.TaggedError('XlsxFillFailed')<{ readonly message: string }> {}

/**
 * Fill a workbook template with `data`: the fill every `.xlsx` template output
 * shares (an automation step, `sovrium render`).
 */
export const fillWorkbookTemplate = Effect.fn('automations.fill-workbook-template')(function* (
  template: TemplateText,
  data: Raw,
  templates: TemplateRenderer,
  setup: DocumentRenderSetup
) {
  const filled = fillXlsxTemplate({
    template: template.bytes,
    templateName: template.path ?? 'the template',
    data,
    render: (text, context) =>
      Result.getOrThrowWith(
        templates.renderDocument(text, context, {
          ...setup,
          mode: 'text',
          trust: template.trust,
        }),
        (reason) => new Error(reason)
      ).text,
  })
  if (!filled.ok) return yield* new XlsxFillFailed({ message: filled.message })
  return { bytes: filled.bytes, contentType: filled.contentType }
})

const fillWorkbook = (props: Raw, app: App, runContext: ActionRunContext | undefined) =>
  Effect.gen(function* () {
    if (runContext === undefined) {
      return yield* new XlsxFillFailed({ message: 'no template engine to render the template' })
    }
    const template = yield* readTemplateSource(props['template'])
    const setup = yield* documentRenderSetup(app, props['locale'], 'text')
    return yield* fillWorkbookTemplate(
      template,
      documentDataOf(props, runContext),
      runContext.templates,
      setup
    )
  })

/** Fill the workbook template the step names and write the result. */
export const generateXlsxFromTemplate = (
  props: Raw,
  app: App,
  automation: AutomationContext,
  runContext: ActionRunContext | undefined
) =>
  runDocumentAction(
    'document.generateXlsx',
    Effect.flatMap(fillWorkbook(props, app, runContext), (file) =>
      writeGeneratedFile({
        output: { filename: 'export.xlsx', ...outputPropOf(props) },
        file,
        app,
        automation,
        runContext,
      })
    )
  ).pipe(Effect.withSpan('automations.generate-xlsx-from-template'))
