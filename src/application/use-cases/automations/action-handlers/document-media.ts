/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { AssetStore } from '@/application/ports/services/asset-store'
import { StorageService, UNATTRIBUTED_BUCKET } from '@/application/ports/services/storage-service'
import { SvgRasterizer } from '@/application/ports/services/svg-rasterizer'
import {
  DOCUMENT_MEDIA_MARKER,
  type DocumentMediaRequest,
  type DocumentRendering,
} from '@/application/ports/services/template-engine'
import { sniffContentType } from '@/domain/kernel/identity/content-sniff'
import { pictureDimensions } from '@/domain/kernel/identity/picture-dimensions'
import { encodeQrMatrix, matrixToSvg } from '@/domain/models/app/links/qr-code-service'
import { isRecord, type Raw } from './document-run'
import { renderTemplateText, type TemplateText } from './document-template'
import { assetNameRefusal, storedFileRefusal } from './file-ref-origin'
import type { DocumentRenderSetup } from './document-render-setup'
import type { ActionRunContext } from './shared'
import type { EmailAttachment } from '@/application/ports/services/email-sender'

/**
 * PLACING THE PICTURES A DOCUMENT TEMPLATE ASKED FOR (`{{image}}`,
 * `{{qrcode}}`), once its synchronous render returned them beside the text.
 *
 * `image` reads a declared image asset or a stored file, NEVER a URL — so the
 * helper cannot become a fetch primitive; a remote picture stays behind
 * `<img src>` and `allowRemoteAssets`. A stored file `{ key, bucket }` is read
 * only when the configuration wrote it out in `data`, or when it is a file
 * this run produced (see {@link pictureFileCheck}): a shape the run's data
 * supplied would let anyone who can call the trigger, and knows a key, put
 * any file of a bucket into the document. `qrcode` is drawn by the
 * in-house encoder. What each becomes depends on the output: inlined in HTML,
 * an `<image>` or a nested `<svg>` in SVG, an inline `cid:` part in an email,
 * a drawing in Word (see `ooxml/docx-pictures.ts`).
 */

/** A picture could not be placed; the message names the helper and the value. */
export class DocumentMediaError extends Data.TaggedError('DocumentMediaError')<{
  readonly message: string
}> {}

/** A picture read and sized: its bytes, type and the box it is drawn in, in pixels. */
export interface PlacedPicture {
  readonly bytes: Uint8Array
  readonly contentType: string
  readonly width: number
  readonly height: number
}

const PICTURE_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
])

const describe = (source: unknown): string =>
  typeof source === 'string' ? source : (JSON.stringify(source) ?? String(source))

const refuse = (source: unknown, why: string) =>
  new DocumentMediaError({ message: `image: "${describe(source)}" ${why}` })

/**
 * Why `image` may not read the source a template named — a stored file
 * `{ key, bucket }`, or a declared asset's path (`literal` when the template
 * wrote it) — or `undefined` when it may. Absent, every source is read: a
 * render the operator runs on their own data (`sovrium render`, a preview).
 */
export type PictureFileCheck = (source: unknown, literal: boolean) => string | undefined

/**
 * The check of the pictures `template` draws from a step's `data` (as the
 * run filled it): a stored file the configuration wrote out there, or one this
 * run produced — never one whose shape the run's data supplied; an asset path
 * written in the template or the configuration — never one the data supplied.
 */
export const pictureFileCheck =
  (
    template: Pick<TemplateText, 'name'>,
    data: Raw,
    scope: Parameters<typeof storedFileRefusal>[2]
  ): PictureFileCheck =>
  (source, literal) => {
    const refusal =
      typeof source === 'string'
        ? assetNameRefusal(source, { name: 'data', literal }, scope.runContext)
        : storedFileRefusal(source, { name: 'data', resolved: data }, scope)
    return refusal === undefined ? undefined : `in ${template.name}: ${refusal}`
  }

/** The bytes of a declared asset `image` named by its path, once its origin allows it. */
const assetBytes = (source: string, literal: boolean, check: PictureFileCheck | undefined) =>
  Effect.gen(function* () {
    const asset = (yield* AssetStore).get(source)
    if (asset === undefined) {
      return yield* refuse(source, 'is not a declared asset or a stored file')
    }
    // A declared asset is read only when the template or the configuration named it.
    const named = check?.(source, literal)
    if (named !== undefined) return yield* refuse(source, named)
    return asset.bytes
  })

/** The bytes `image` was given: a declared asset path, or a stored file `{ key, bucket? }`. */
const pictureBytes = (
  request: Extract<DocumentMediaRequest, { readonly kind: 'image' }>,
  check: PictureFileCheck | undefined
) =>
  Effect.gen(function* () {
    const { source } = request
    if (typeof source === 'string') {
      return yield* assetBytes(source, request.literal === true, check)
    }
    const file: Raw = isRecord(source) ? source : {}
    const { key } = file
    if (typeof key !== 'string' || key === '') {
      return yield* refuse(source, 'is not a declared asset or a stored file')
    }
    const refusal = check?.(source, false)
    if (refusal !== undefined) return yield* refuse(source, refusal)
    const bucket = typeof file['bucket'] === 'string' ? file['bucket'] : UNATTRIBUTED_BUCKET
    return yield* (yield* StorageService)
      .download(key, bucket)
      .pipe(Effect.mapError(() => refuse(source, 'could not be read')))
  })

/** The box a picture of `natural` size is drawn in: the asked width or height, proportions kept. */
const boxOf = (
  natural: { readonly width: number; readonly height: number },
  asked: { readonly width?: number; readonly height?: number }
): { readonly width: number; readonly height: number } => {
  if (asked.width !== undefined && asked.height !== undefined) {
    return { width: asked.width, height: asked.height }
  }
  if (asked.width !== undefined) {
    return {
      width: asked.width,
      height: Math.round((asked.width * natural.height) / natural.width),
    }
  }
  if (asked.height !== undefined) {
    return {
      width: Math.round((asked.height * natural.width) / natural.height),
      height: asked.height,
    }
  }
  return natural
}

/** Read and size the picture an `image` request names. */
export const readRequestedPicture = Effect.fn('automations.document-read-picture')(function* (
  request: Extract<DocumentMediaRequest, { readonly kind: 'image' }>,
  check?: PictureFileCheck
) {
  const bytes = yield* pictureBytes(request, check)
  const contentType = sniffContentType(bytes)
  const natural = pictureDimensions(bytes)
  if (contentType === undefined || !PICTURE_TYPES.has(contentType) || natural === undefined) {
    return yield* refuse(request.source, 'is not a PNG, JPEG, GIF or WebP picture')
  }
  return { bytes, contentType, ...boxOf(natural, request) } satisfies PlacedPicture
})

const DEFAULT_QR_SIZE = 200

/** A QR code as SVG markup: a nested `<svg>` positioned at `x`, `y` when asked. */
const qrSvg = (request: Extract<DocumentMediaRequest, { readonly kind: 'qrcode' }>) =>
  Effect.gen(function* () {
    const matrix = encodeQrMatrix(request.value, { ecc: request.ecc ?? 'M' })
    if (!matrix.ok) {
      return yield* new DocumentMediaError({ message: `qrcode: ${matrix.error.message}` })
    }
    const size = request.size ?? request.width ?? DEFAULT_QR_SIZE
    const svg = matrixToSvg(matrix.value, {
      quietZone: request.margin ?? 4,
      size,
      title: request.value,
    })
    const position = `${request.x === undefined ? '' : ` x="${request.x}"`}${request.y === undefined ? '' : ` y="${request.y}"`}`
    return { svg: svg.replace('<svg ', `<svg${position} `), size }
  })

const base64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64')

const dataUrl = (picture: PlacedPicture): string =>
  `data:${picture.contentType};base64,${base64(picture.bytes)}`

/** One picture as the markup an HTML or SVG render holds. */
const markupFor = (
  request: DocumentMediaRequest,
  target: 'html' | 'svg',
  check: PictureFileCheck | undefined
) =>
  Effect.gen(function* () {
    if (request.kind === 'qrcode') return (yield* qrSvg(request)).svg
    const picture = yield* readRequestedPicture(request, check)
    if (target === 'html') {
      return `<img src="${dataUrl(picture)}" width="${picture.width}" height="${picture.height}" alt="">`
    }
    return `<image x="${request.x ?? 0}" y="${request.y ?? 0}" width="${picture.width}" height="${picture.height}" href="${dataUrl(picture)}"/>`
  })

/** Swap every marker of `text` for what `placed[n]` holds. */
const substitute = (text: string, placed: ReadonlyArray<string>): string =>
  text.replace(DOCUMENT_MEDIA_MARKER, (_marker, index: string) => placed[Number(index)] ?? '')

/** An HTML or SVG render with its pictures in place. */
export const placeMediaInMarkup = (
  rendering: DocumentRendering,
  target: 'html' | 'svg',
  check?: PictureFileCheck
) =>
  rendering.media.length === 0
    ? Effect.succeed(rendering.text)
    : Effect.map(
        Effect.forEach(rendering.media, (request) => markupFor(request, target, check)),
        (placed) => substitute(rendering.text, placed)
      ).pipe(Effect.withSpan('automations.document-place-media'))

/** An email body with its pictures as inline parts, and those parts. */
export interface EmailWithPictures {
  readonly html: string
  readonly inline: ReadonlyArray<EmailAttachment>
}

/** One picture as an inline part of a message, the QR code drawn to PNG in the binary. */
const inlinePartFor = (
  request: DocumentMediaRequest,
  index: number,
  check: PictureFileCheck | undefined
) =>
  Effect.gen(function* () {
    const contentId = `sovrium-picture-${index}@sovrium.local`
    if (request.kind === 'qrcode') {
      const { svg, size } = yield* qrSvg(request)
      const raster = yield* (yield* SvgRasterizer)
        .rasterize(svg, { width: size, fonts: [] })
        .pipe(
          Effect.mapError(
            (error) => new DocumentMediaError({ message: `qrcode: ${error.message}` })
          )
        )
      return {
        part: {
          filename: `qrcode-${index}.png`,
          contentType: 'image/png',
          content: raster.png,
          contentId,
        },
        tag: `<img src="cid:${contentId}" width="${size}" height="${size}" alt="">`,
      }
    }
    const picture = yield* readRequestedPicture(request, check)
    const extension = picture.contentType.slice('image/'.length)
    return {
      part: {
        filename: `picture-${index}.${extension}`,
        contentType: picture.contentType,
        content: picture.bytes,
        contentId,
      },
      tag: `<img src="cid:${contentId}" width="${picture.width}" height="${picture.height}" alt="">`,
    }
  })

/** An email render with its pictures as `cid:` parts — a mail client drops `data:` pictures and inline SVG. */
export const placeMediaInEmail = (rendering: DocumentRendering, check?: PictureFileCheck) =>
  Effect.map(
    Effect.forEach(rendering.media, (request, index) => inlinePartFor(request, index, check)),
    (parts): EmailWithPictures => ({
      html: substitute(
        rendering.text,
        parts.map((part) => part.tag)
      ),
      inline: parts.map((part) => part.part),
    })
  ).pipe(Effect.withSpan('automations.document-place-email-media'))

/**
 * Render a template into HTML or SVG and place its pictures: what every HTML
 * and SVG generator writes into its document. `pictures` judges the stored
 * files its `image` names (see {@link pictureFileCheck}).
 */
export const renderMarkup = (
  template: Pick<TemplateText, 'text' | 'trust' | 'name'>,
  context: Readonly<Record<string, unknown>>,
  setup: DocumentRenderSetup & {
    readonly target: 'html' | 'svg'
    readonly pictures?: PictureFileCheck
  },
  runContext: ActionRunContext | undefined
) => {
  const { pictures, ...renderSetup } = setup
  return Effect.flatMap(
    renderTemplateText(template, context, runContext, {
      ...renderSetup,
      mode: setup.target === 'svg' ? 'xml' : 'html',
    }),
    (rendering) => placeMediaInMarkup(rendering, setup.target, pictures)
  ).pipe(Effect.withSpan('automations.document-render-markup'))
}
