/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { inlineEmailCss } from '@/domain/kernel/sanitize/email-css-inlining'
import { emailTextFromHtml } from '@/domain/kernel/sanitize/email-text'
import { sanitizeRichTextHTML } from '@/domain/kernel/sanitize/html-sanitization'
import { pictureFileCheck, placeMediaInEmail } from './document-media'
import { documentRenderSetup, type DocumentRenderSetup } from './document-render-setup'
import { documentDataOf, isRecord, type Raw } from './document-run'
import { readTemplateSource, renderTemplateText, templateContext } from './document-template'
import type { ActionRunContext, AutomationContext } from './shared'
import type { EmailAttachment } from '@/application/ports/services/email-sender'
import type { App } from '@/domain/models/app'

/**
 * THE BODY OF A TEMPLATED EMAIL (`email/send` with `template`).
 *
 * The template renders from `data` in the step's language, with the declared
 * partials (a layout is one) and the document helpers; `{{image}}` and
 * `{{qrcode}}` travel as inline `cid:` parts. Trust follows the author: an
 * inline or asset template is the operator's — its `<style>` rules are inlined
 * (`inlineCss`, default true) BEFORE the email-profile sanitizer cleans the
 * result, so an inlined declaration is filtered like an authored `style`
 * attribute; a bucket template is cleaned like `body` and loses every style.
 * No `<style>` block is ever delivered. The text part is the `text` template
 * when there is one, else derived from the HTML.
 */

export interface TemplatedEmail {
  readonly html: string
  readonly text: string
  /** The pictures the HTML shows inline, by content id. */
  readonly inline: ReadonlyArray<EmailAttachment>
  /** The subject, when `subject` is a template source. */
  readonly subject?: string
}

/** A `text` or `subject` template, rendered without HTML escaping. */
const renderPlain = (
  source: unknown,
  data: Raw,
  setup: DocumentRenderSetup,
  runContext: ActionRunContext | undefined
) =>
  Effect.gen(function* () {
    const template = yield* readTemplateSource(source)
    const rendering = yield* renderTemplateText(
      template,
      templateContext(template, data, runContext),
      runContext,
      { ...setup, mode: 'text', target: 'text' }
    )
    return rendering.text
  })

export const templatedEmail = Effect.fn('automations.email-templated-body')(function* (
  props: Raw,
  scope: {
    readonly app: App
    readonly automation: AutomationContext
    readonly runContext: ActionRunContext | undefined
  }
) {
  const { app, runContext } = scope
  const data = documentDataOf(props, runContext)
  const template = yield* readTemplateSource(props['template'])
  const setup = yield* documentRenderSetup(app, props['locale'], 'email')
  const rendering = yield* renderTemplateText(
    template,
    templateContext(template, data, runContext),
    runContext,
    { ...setup, mode: 'html' }
  )
  const placed = yield* placeMediaInEmail(rendering, pictureFileCheck(template, data, scope))
  const authored = template.trust === 'authored'
  const styled =
    authored && props['inlineCss'] !== false ? inlineEmailCss(placed.html) : placed.html
  const html = sanitizeRichTextHTML(styled, { profile: authored ? 'email' : 'rich-text' })
  const text =
    props['text'] === undefined
      ? emailTextFromHtml(html)
      : yield* renderPlain(props['text'], data, setup, runContext)
  const subject = isRecord(props['subject'])
    ? yield* renderPlain(props['subject'], data, setup, runContext)
    : undefined
  return {
    html,
    text,
    inline: placed.inline,
    ...(subject === undefined ? {} : { subject: subject.trim() }),
  } satisfies TemplatedEmail
})
