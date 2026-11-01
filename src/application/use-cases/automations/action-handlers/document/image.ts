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
import { decodedHandler, type DecodedAction } from '../decoded-handler'
import { actionAttributes, type ActionRunContext, type AutomationContext } from '../shared'
import { starterFileGate } from '../starter-file-gate'
import { pictureFileCheck, renderMarkup } from './media'
import { writeGeneratedFile, type GeneratedFile } from './output'
import { documentRenderSetup } from './render-setup'
import { documentAssetResolver, documentDataOf, runDocumentAction } from './run'
import { DocumentGenerateImageSettings } from './settings'
import { readTemplateSource, templateContext, type TemplateText } from './template'
import type { App } from '@/domain/models/app'

type GenerateImageProps = DecodedAction<typeof DocumentGenerateImageSettings>['props']

/**
 * How an image is rendered: its size, format and quality, and whether its page
 * may load remote files. A template preview asks for a format alone, and one
 * that is not an image format renders a PNG.
 */
interface ImageRender {
  readonly width?: number | undefined
  readonly height?: number | undefined
  readonly format?: string | undefined
  readonly quality?: number | undefined
  readonly allowRemoteAssets?: boolean | undefined
}

/**
 * `document/generateImage`: an SVG or HTML template filled with `data`,
 * rendered to PNG, JPEG or WebP.
 *
 * An SVG renders inside the binary (no engine, nothing fetched — an `<image>`
 * on the network is never loaded); an HTML template renders through the
 * browser engine at a `width` × `height` viewport, and fails with
 * `renderer_unavailable` when no engine is configured.
 */

/** The index of the first non-whitespace character at or after `from` (`\s`, as a regex reads it). */
const skipSpace = (text: string, from: number): number => {
  const rest = text.slice(from)
  return from + rest.length - rest.trimStart().length
}

const startsWithAt = (text: string, at: number, prefix: string): boolean =>
  text.slice(at, at + prefix.length).toLowerCase() === prefix

/** Past one prolog item at `at` — a `<!-- … -->` comment or a `<!DOCTYPE …>` — or `undefined`. */
const pastPrologItem = (text: string, at: number): number | undefined => {
  if (startsWithAt(text, at, '<!--')) {
    const close = text.indexOf('-->', at + 4)
    return close === -1 ? undefined : close + 3
  }
  if (startsWithAt(text, at, '<!doctype')) {
    const close = text.indexOf('>', at)
    return close === -1 ? undefined : close + 1
  }
  return undefined
}

/** Past an `<?xml …>` declaration at `at`, `at` itself when there is none, `undefined` when it never closes. */
const pastDeclaration = (text: string, at: number): number | undefined => {
  if (!startsWithAt(text, at, '<?xml')) return at
  const close = text.indexOf('>', at)
  return close === -1 ? undefined : close + 1
}

/** Whether `<svg` stands at `at`, once the comments and doctype before it are skipped (a tail call per item). */
const opensOnSvg = (text: string, at: number): boolean => {
  const next = pastPrologItem(text, at)
  if (next !== undefined) return opensOnSvg(text, skipSpace(text, next))
  const after = text.charAt(at + 4)
  return startsWithAt(text, at, '<svg') && (after === '>' || /\s/.test(after))
}

/**
 * Whether the text opens on an `<svg` element: an optional `<?xml …>`
 * declaration, then any comments and doctype. Each item is skipped with one
 * `indexOf`, so the read stays linear in the text's length whatever it holds.
 */
export const startsWithSvgElement = (text: string): boolean => {
  const start = pastDeclaration(text, skipSpace(text, 0))
  return start !== undefined && opensOnSvg(text, skipSpace(text, start))
}

/** Whether the template is SVG: `templateType`, else the asset kind, the key extension, the text. */
const isSvgTemplate = (props: GenerateImageProps, template: TemplateText): boolean => {
  if (props.templateType !== undefined) return props.templateType === 'svg'
  if (template.kind === 'svg' || template.kind === 'html') return template.kind === 'svg'
  if (template.path !== undefined && /\.svg$/i.test(template.path)) return true
  if (template.path !== undefined && /\.html?$/i.test(template.path)) return false
  return startsWithSvgElement(template.text)
}

const formatOf = ({ format }: ImageRender): 'png' | 'jpeg' | 'webp' =>
  format === 'jpeg' || format === 'webp' ? format : 'png'

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
  props: ImageRender,
  app: App
) {
  const { width } = props
  const height = width === undefined ? props.height : undefined
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
  const { quality } = props
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
  props: ImageRender
) {
  const renderer = yield* DocumentRenderer
  const { height, quality } = props
  const image = yield* renderer.renderImage(
    html,
    {
      width: props.width ?? 1200,
      ...(height === undefined ? {} : { height }),
      format: formatOf(props),
      ...(quality === undefined ? {} : { quality }),
    },
    {
      assetResolver: yield* documentAssetResolver,
      allowRemoteAssets: props.allowRemoteAssets === true,
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
  props: GenerateImageProps,
  app: App,
  automation: AutomationContext,
  runContext: ActionRunContext | undefined
) =>
  Effect.gen(function* () {
    const template = yield* readTemplateSource(props.template, starterFileGate(app, automation))
    const data = documentDataOf(props, runContext)
    const context = templateContext(template, data, runContext)
    const og = props.preset === 'og'
    const svg = !og && isSvgTemplate(props, template)
    const setup = yield* documentRenderSetup(app, props.locale, svg ? 'svg' : 'html')
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

export const handleDocumentGenerateImage = decodedHandler(
  DocumentGenerateImageSettings,
  (action, app, automation, runContext) =>
    runDocumentAction(
      'document.generateImage',
      Effect.flatMap(generate(action.props, app, automation, runContext), (file) =>
        writeGeneratedFile({ output: action.props.output, file, app, automation, runContext })
      )
    ).pipe(
      Effect.withSpan('automations.handle-document-generate-image', {
        attributes: actionAttributes(action),
      })
    )
)
