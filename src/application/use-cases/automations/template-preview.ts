/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect, Result } from 'effect'
import { AssetStore } from '@/application/ports/services/asset-store'
import { DocumentRenderer } from '@/application/ports/services/document-renderer'
import { OfficeConverter } from '@/application/ports/services/office-converter'
import { TemplateEngine } from '@/application/ports/services/template-engine'
import { inlineEmailCss } from '@/domain/kernel/sanitize/email-css-inlining'
import { sanitizeRichTextHTML } from '@/domain/kernel/sanitize/html-sanitization'
import { resolveAssetKind, type AssetKind } from '@/domain/models/app/assets/asset'
import { fillWordTemplate } from './action-handlers/document-docx'
import { renderSvg } from './action-handlers/document-image'
import { placeMediaInMarkup } from './action-handlers/document-media'
import { documentRenderSetup } from './action-handlers/document-render-setup'
import { documentAssetResolver } from './action-handlers/document-run'
import { fillWorkbookTemplate } from './action-handlers/document-xlsx-template'
import type { TemplateText } from './action-handlers/document-template'
import type { ImageTransformService } from '@/application/ports/services/image-transform-service'
import type { StorageService } from '@/application/ports/services/storage-service'
import type { SvgRasterizer } from '@/application/ports/services/svg-rasterizer'
import type {
  DocumentRendering,
  DocumentTarget,
} from '@/application/ports/services/template-engine'
import type { App } from '@/domain/models/app'

/**
 * RENDER ONE TEMPLATE ASSET THE WAY AN AUTOMATION WOULD, FOR A PREVIEW.
 *
 * The same engine, escaping, helpers, partials, translations and render rules
 * as a run, against values the caller hands in (a data file, the asset's
 * `sampleData`) — never a run's. What it renders to follows the asset's kind
 * and the output asked for:
 *
 * | kind            | outputs                          |
 * | --------------- | -------------------------------- |
 * | html            | html (text), pdf, png            |
 * | svg             | svg (text), png, jpeg, webp      |
 * | text, partial   | text                             |
 * | docx            | docx, pdf (with an office engine) |
 * | xlsx            | xlsx                             |
 *
 * An `email` preview renders an html template as `email/send` delivers it:
 * its style rules inlined, cleaned by the email sanitizer, no `<style>` left.
 */

/** What a preview can be written as. */
export type PreviewFormat =
  'html' | 'svg' | 'text' | 'pdf' | 'png' | 'jpeg' | 'webp' | 'docx' | 'xlsx'

export type TemplatePreview =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'file'; readonly bytes: Uint8Array; readonly contentType: string }

/** The preview could not be produced; the message says why and what to do. */
export class TemplatePreviewError extends Data.TaggedError('TemplatePreviewError')<{
  readonly message: string
}> {}

export interface TemplatePreviewInput {
  readonly app: App
  readonly path: string
  readonly data: Readonly<Record<string, unknown>>
  readonly locale?: string
  readonly email: boolean
  /** The format asked for; `undefined` asks for the kind's text form. */
  readonly format: PreviewFormat | undefined
}

const OUTPUTS: Readonly<Partial<Record<AssetKind, ReadonlyArray<PreviewFormat>>>> = {
  html: ['html', 'pdf', 'png'],
  svg: ['svg', 'png', 'jpeg', 'webp'],
  text: ['text'],
  partial: ['text'],
  docx: ['docx', 'pdf'],
  xlsx: ['xlsx'],
}

const refuse = (message: string) => new TemplatePreviewError({ message })

const listOf = (formats: ReadonlyArray<string>): string =>
  formats.length < 2
    ? (formats[0] ?? '')
    : `${formats.slice(0, -1).join(', ')} or ${formats.at(-1) ?? ''}`

/** The format the preview takes: the one asked for when the kind renders to it, else a refusal. */
const formatFor = (path: string, kind: AssetKind, asked: PreviewFormat | undefined) => {
  const outputs = OUTPUTS[kind] ?? []
  const text = outputs[0]
  if (asked === undefined) {
    return text === 'html' || text === 'svg' || text === 'text'
      ? Effect.succeed(text)
      : Effect.fail(refuse(`${path} renders to a file; pass --out <file>.${text ?? kind}`))
  }
  return outputs.includes(asked)
    ? Effect.succeed(asked)
    : Effect.fail(refuse(`${path} cannot render to .${asked}; it renders to ${listOf(outputs)}`))
}

/** Render the template text for `target` with the run's own engine. */
const renderText = (
  template: TemplateText,
  data: Readonly<Record<string, unknown>>,
  input: TemplatePreviewInput,
  target: DocumentTarget
) =>
  Effect.gen(function* () {
    const engine = yield* TemplateEngine
    const setup = yield* documentRenderSetup(input.app, input.locale, target)
    const mode = target === 'svg' ? 'xml' : target === 'text' ? 'text' : 'html'
    return yield* Result.match(
      engine.renderDocument(template.text, data, { ...setup, mode, trust: 'authored' }),
      {
        onSuccess: (rendering: DocumentRendering) => Effect.succeed(rendering),
        onFailure: (reason) => Effect.fail(refuse(`${template.name}: ${reason}`)),
      }
    )
  })

/** An html template as `email/send` delivers it, its pictures embedded for the preview. */
const emailPreview = (template: TemplateText, input: TemplatePreviewInput) =>
  Effect.gen(function* () {
    const rendering = yield* renderText(template, input.data, input, 'email')
    const html = sanitizeRichTextHTML(inlineEmailCss(rendering.text), { profile: 'email' })
    return yield* placeMediaInMarkup({ text: html, media: rendering.media }, 'html')
  })

const textPreview = (template: TemplateText, input: TemplatePreviewInput, kind: AssetKind) =>
  Effect.gen(function* () {
    if (kind === 'html' && input.email) return yield* emailPreview(template, input)
    const target = kind === 'html' ? 'html' : kind === 'svg' ? 'svg' : 'text'
    const rendering = yield* renderText(template, input.data, input, target)
    return target === 'text' ? rendering.text : yield* placeMediaInMarkup(rendering, target)
  })

/** A preview written as a file: a PDF or a picture of the html or svg, or a filled document. */
const filePreview = (
  template: TemplateText,
  input: TemplatePreviewInput,
  kind: AssetKind,
  format: PreviewFormat
) =>
  Effect.gen(function* () {
    const engine = yield* TemplateEngine
    if (kind === 'docx' || kind === 'xlsx') {
      const setup = yield* documentRenderSetup(
        input.app,
        input.locale,
        kind === 'docx' ? 'word' : 'text'
      )
      const filled =
        kind === 'docx'
          ? yield* fillWordTemplate(template, input.data, engine, setup)
          : yield* fillWorkbookTemplate(template, input.data, engine, setup)
      if (format !== 'pdf') return filled
      const pdf = yield* (yield* OfficeConverter).convertToPdf({
        name: `${template.path?.replace(/^.*\//, '').replace(/\.[^.]+$/, '') ?? 'document'}.docx`,
        bytes: filled.bytes,
      })
      return { bytes: pdf, contentType: 'application/pdf' }
    }
    const markup = yield* textPreview(template, { ...input, email: false }, kind)
    if (kind === 'svg') return yield* renderSvg(markup, { format }, input.app)
    const renderer = yield* DocumentRenderer
    const sandbox = { assetResolver: yield* documentAssetResolver, allowRemoteAssets: false }
    return format === 'pdf'
      ? yield* renderer.renderPdf(markup, {}, sandbox)
      : yield* renderer.renderImage(markup, { width: 1200, format: 'png' }, sandbox)
  })

/** The refusal for a path no template asset declares, listing the ones that are. */
const notATemplate = (app: App, path: string) => {
  const declared = (app.assets ?? [])
    .filter((candidate) => {
      const kind = resolveAssetKind(candidate)
      return kind !== undefined && OUTPUTS[kind] !== undefined
    })
    .map((candidate) => candidate.path)
  return refuse(
    `${path} is not a declared template asset; declared templates: ${declared.length === 0 ? 'none' : declared.join(', ')}`
  )
}

/** The declared template asset at `path`, read, or the refusal naming the declared ones. */
const templateAt = (app: App, path: string) =>
  Effect.gen(function* () {
    const entry = (app.assets ?? []).find((candidate) => candidate.path === path)
    const kind = entry === undefined ? undefined : resolveAssetKind(entry)
    const asset = (yield* AssetStore).get(path)
    if (kind === undefined || asset === undefined || OUTPUTS[kind] === undefined) {
      return yield* notATemplate(app, path)
    }
    return {
      text: new TextDecoder().decode(asset.bytes),
      bytes: asset.bytes,
      trust: 'authored',
      origin: 'asset',
      name: `template asset "${path}"`,
      kind,
      path,
    } satisfies TemplateText & { readonly kind: AssetKind }
  })

/** The services a preview renders with: the template engine, the renderers, the office engine. */
export type TemplatePreviewRequirements =
  | TemplateEngine
  | StorageService
  | DocumentRenderer
  | SvgRasterizer
  | ImageTransformService
  | OfficeConverter

/** Any failure of a preview, as the one error it reports: its message says what went wrong. */
const asPreviewError = (error: unknown): Readonly<TemplatePreviewError> =>
  error instanceof TemplatePreviewError
    ? error
    : new TemplatePreviewError({
        message:
          typeof (error as { readonly message?: unknown }).message === 'string'
            ? (error as { readonly message: string }).message
            : String(error),
      })

/** Render one declared template asset for a preview. */
export const renderTemplatePreview = (
  input: TemplatePreviewInput
): Effect.Effect<TemplatePreview, TemplatePreviewError, TemplatePreviewRequirements> =>
  Effect.gen(function* () {
    const template = yield* templateAt(input.app, input.path)
    const format = yield* formatFor(input.path, template.kind, input.format)
    if (format === 'html' || format === 'svg' || format === 'text') {
      return { kind: 'text', text: yield* textPreview(template, input, template.kind) } as const
    }
    const file = yield* filePreview(template, input, template.kind, format)
    return { kind: 'file', bytes: file.bytes, contentType: file.contentType } as const
  }).pipe(Effect.mapError(asPreviewError), Effect.withSpan('automations.render-template-preview'))

/**
 * A declared template rendered to its TEXT form only — html (as a page or as
 * an email), svg or text — with no engine beyond the template engine: what a
 * read-only preview in the console shows. A Word, Excel or PowerPoint
 * template has no text form and answers `undefined`.
 */
export const renderTemplateTextPreview = (
  input: Omit<TemplatePreviewInput, 'format'>
): Effect.Effect<string | undefined, TemplatePreviewError, TemplateEngine | StorageService> =>
  Effect.gen(function* () {
    const template = yield* templateAt(input.app, input.path)
    const text = OUTPUTS[template.kind]?.[0]
    if (text !== 'html' && text !== 'svg' && text !== 'text') return undefined
    return yield* textPreview(template, { ...input, format: undefined }, template.kind)
  }).pipe(
    Effect.mapError(asPreviewError),
    Effect.withSpan('automations.render-template-text-preview')
  )
