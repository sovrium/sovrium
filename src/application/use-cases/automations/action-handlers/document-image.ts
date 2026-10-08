/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AssetStore } from '@/application/ports/services/asset-store'
import { DocumentRenderer } from '@/application/ports/services/document-renderer'
import { ImageTransformService } from '@/application/ports/services/image-transform-service'
import { SvgRasterizer } from '@/application/ports/services/svg-rasterizer'
import { pictureFileCheck, renderMarkup } from './document-media'
import { writeGeneratedFile, type GeneratedFile } from './document-output'
import { documentRenderSetup } from './document-render-setup'
import {
  actionPropsOf,
  documentAssetResolver,
  documentDataOf,
  outputPropOf,
  runDocumentAction,
  type Raw,
} from './document-run'
import { readTemplateSource, templateContext, type TemplateText } from './document-template'
import {
  actionAttributes,
  type ActionHandler,
  type ActionRunContext,
  type AutomationContext,
} from './shared'
import type { App } from '@/domain/models/app'

/**
 * `document/generateImage`: an SVG or HTML template filled with `data`,
 * rendered to PNG, JPEG or WebP.
 *
 * An SVG renders inside the binary (no engine, nothing fetched — an `<image>`
 * on the network is never loaded); an HTML template renders through the
 * browser engine at a `width` × `height` viewport, and fails with
 * `renderer_unavailable` when no engine is configured.
 */

const SVG_START = /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg[\s>]/i

/** Whether the template is SVG: `templateType`, else the asset kind, the key extension, the text. */
const isSvgTemplate = (props: Raw, template: TemplateText): boolean => {
  if (props['templateType'] === 'svg' || props['templateType'] === 'html') {
    return props['templateType'] === 'svg'
  }
  if (template.kind === 'svg' || template.kind === 'html') return template.kind === 'svg'
  if (template.path !== undefined && /\.svg$/i.test(template.path)) return true
  if (template.path !== undefined && /\.html?$/i.test(template.path)) return false
  return SVG_START.test(template.text)
}

const formatOf = (props: Raw): 'png' | 'jpeg' | 'webp' =>
  props['format'] === 'jpeg' || props['format'] === 'webp' ? props['format'] : 'png'

const positive = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : undefined

/** The font files declared in `assets`: what SVG text is drawn with. */
const declaredFonts = (app: App) =>
  Effect.gen(function* () {
    const store = yield* AssetStore
    return (app.assets ?? []).flatMap((entry) => {
      const asset = store.get(entry.path)
      return asset?.kind === 'font' ? [asset.bytes] : []
    })
  })

/** SVG → PNG in the binary, then re-encoded when another format is asked for. */
export const renderSvg = Effect.fn('automations.document-render-svg')(function* (
  svg: string,
  props: Raw,
  app: App
) {
  const width = positive(props['width'])
  const height = width === undefined ? positive(props['height']) : undefined
  const fonts = yield* declaredFonts(app)
  const raster = yield* (yield* SvgRasterizer).rasterize(svg, {
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
    fonts,
  })
  const format = formatOf(props)
  if (format === 'png') {
    return {
      bytes: raster.png,
      contentType: 'image/png',
      width: raster.width,
      height: raster.height,
    }
  }
  const quality = positive(props['quality'])
  const encoded = yield* (yield* ImageTransformService).transform(raster.png, {
    operation: 'convert',
    outputFormat: format,
    ...(quality === undefined ? {} : { quality }),
  })
  return {
    bytes: encoded.bytes,
    contentType: encoded.contentType,
    width: raster.width,
    height: raster.height,
  }
})

/** HTML → image through the browser engine, at the declared viewport. */
export const renderHtml = Effect.fn('automations.document-render-html-image')(function* (
  html: string,
  props: Raw
) {
  const renderer = yield* DocumentRenderer
  const height = positive(props['height'])
  const quality = positive(props['quality'])
  const image = yield* renderer.renderImage(
    html,
    {
      width: positive(props['width']) ?? 1200,
      ...(height === undefined ? {} : { height }),
      format: formatOf(props),
      ...(quality === undefined ? {} : { quality }),
    },
    {
      assetResolver: yield* documentAssetResolver,
      allowRemoteAssets: props['allowRemoteAssets'] === true,
    }
  )
  return image
})

/**
 * `preset: og` — a social card: always an HTML render through the browser
 * engine, at exactly 1200 × 630 (there is no browserless road; with no engine
 * the step fails with `renderer_unavailable`).
 */
const OG_CARD = { width: 1200, height: 630 } as const

/** A card fills its viewport edge to edge: the page's default margin is removed. */
const OG_PAGE_RESET = '<style>html,body{margin:0;padding:0}</style>'

const generate = (
  props: Raw,
  app: App,
  automation: AutomationContext,
  runContext: ActionRunContext | undefined
) =>
  Effect.gen(function* () {
    const template = yield* readTemplateSource(props['template'])
    const data = documentDataOf(props, runContext)
    const context = templateContext(template, data, runContext)
    const og = props['preset'] === 'og'
    const svg = !og && isSvgTemplate(props, template)
    const setup = yield* documentRenderSetup(app, props['locale'], svg ? 'svg' : 'html')
    const text = yield* renderMarkup(
      template,
      context,
      {
        ...setup,
        target: svg ? 'svg' : 'html',
        pictures: pictureFileCheck(template, data, { app, automation, runContext }),
      },
      runContext
    )
    const file: GeneratedFile = svg
      ? yield* renderSvg(text, props, app)
      : og
        ? yield* renderHtml(`${OG_PAGE_RESET}${text}`, { ...props, ...OG_CARD })
        : yield* renderHtml(text, props)
    return file
  })

export const handleDocumentGenerateImage: ActionHandler = (action, app, automation, runContext) => {
  const props = actionPropsOf(action)
  return runDocumentAction(
    'document.generateImage',
    Effect.flatMap(generate(props, app, automation, runContext), (file) =>
      writeGeneratedFile({ output: outputPropOf(props), file, app, automation, runContext })
    )
  ).pipe(
    Effect.withSpan('automations.handle-document-generate-image', {
      attributes: actionAttributes(action),
    })
  )
}
