/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { PdfEditor, type PdfMarkContent } from '@/application/ports/services/pdf-editor'
import { sniffContentType } from '@/domain/kernel/identity/content-sniff'
import {
  pageNumberTexts,
  pagesOrRefusal,
} from '@/domain/models/app/automations/actions/pdf/page-plan-service'
import { decodedHandler, type DecodedAction } from '../decoded-handler'
import { runDocumentAction } from '../document/run'
import { actionAttributes } from '../shared'
import { PdfStampSettings, PdfWatermarkSettings } from './settings'
import {
  carryOut,
  fileRefProp,
  openPdfFile,
  readFile,
  refuse,
  writePdf,
  type PdfScope,
} from './step'
import type {
  MarkPlacement,
  PageAnchor,
} from '@/domain/models/app/automations/actions/pdf/mark-placement-service'

/**
 * `pdf/watermark` and `pdf/stamp`: one mark — text, a PNG or JPEG picture, or
 * (stamp only) page numbers — drawn on the listed pages. The two differ only
 * in their defaults; the geometry and the drawing are shared.
 */

interface MarkDefaults {
  readonly opacity: number
  readonly textAngle: number
  readonly anchor: PageAnchor
  readonly numbersAnchor: PageAnchor
  readonly fontSize: number
  readonly color: string
  readonly imageWidth: 'half-page' | 'natural'
}

const WATERMARK: MarkDefaults = {
  opacity: 0.3,
  textAngle: 45,
  anchor: 'center',
  numbersAnchor: 'center',
  fontSize: 48,
  color: '#808080',
  imageWidth: 'half-page',
}

const STAMP: MarkDefaults = {
  opacity: 1,
  textAngle: 0,
  anchor: 'bottom-right',
  numbersAnchor: 'bottom-center',
  fontSize: 12,
  color: '#000000',
  imageWidth: 'natural',
}

/** A watermark's or a stamp's settings; a watermark places by anchor only, and numbers no page. */
type MarkProps =
  | DecodedAction<typeof PdfStampSettings>['props']
  | (DecodedAction<typeof PdfWatermarkSettings>['props'] & {
      readonly at?: undefined
      readonly margin?: undefined
      readonly pageNumbers?: undefined
    })

/** The picture an `image` mark draws: a PNG or a JPEG. */
const imageContent = (image: unknown, props: MarkProps, defaults: MarkDefaults, scope: PdfScope) =>
  Effect.gen(function* () {
    const read = yield* readFile(fileRefProp(image, 'image', scope), 'image', scope)
    const type = sniffContentType(read.bytes)
    if (type !== 'image/png' && type !== 'image/jpeg') {
      return yield* refuse(`image (${read.filename}) is not a PNG or a JPEG`)
    }
    return {
      kind: 'image',
      bytes: read.bytes,
      width: props.width ?? defaults.imageWidth,
    } satisfies PdfMarkContent
  })

/** What the mark is. */
const contentOf = (props: MarkProps, defaults: MarkDefaults, scope: PdfScope) =>
  props.image === undefined
    ? Effect.succeed({
        kind: 'text',
        fontSize: props.fontSize ?? defaults.fontSize,
        color: props.color ?? defaults.color,
      } satisfies PdfMarkContent)
    : imageContent(props.image, props, defaults, scope)

/** Where the mark goes: `at`, or an anchor kept `margin` points from the edges. */
const placementOf = (props: MarkProps, defaults: MarkDefaults): MarkPlacement => {
  if (props.at !== undefined) return { at: props.at }
  const fallback: PageAnchor =
    props.pageNumbers === undefined ? defaults.anchor : defaults.numbersAnchor
  return { anchor: props.position ?? fallback, margin: props.margin ?? 36 }
}

/** Each listed page's text: the page number when numbering, else the text as written. */
const pageTexts = (props: MarkProps, indexes: readonly number[]): readonly string[] =>
  props.pageNumbers === undefined
    ? indexes.map(() => props.text ?? '')
    : pageNumberTexts(indexes, props.pageNumbers)

const markFile = (props: MarkProps, defaults: MarkDefaults, scope: PdfScope) =>
  Effect.gen(function* () {
    const { pdf } = yield* openPdfFile(fileRefProp(props.file, 'file', scope), scope)
    const indexes = yield* carryOut(pagesOrRefusal(props.pages, pdf.pages.length))
    const content = yield* contentOf(props, defaults, scope)
    const texts = content.kind === 'text' ? pageTexts(props, indexes) : []
    const marked = yield* (yield* PdfEditor).mark(pdf, {
      content,
      placement: placementOf(props, defaults),
      angle: props.angle ?? (content.kind === 'text' ? defaults.textAngle : 0),
      opacity: props.opacity ?? defaults.opacity,
      pages: indexes.map((index, at) => ({
        index,
        ...(content.kind === 'text' ? { text: texts[at] ?? '' } : {}),
      })),
    })
    return yield* writePdf(props.output, marked, scope)
  })

export const handlePdfWatermark = decodedHandler(
  PdfWatermarkSettings,
  (action, app, automation, runContext) =>
    runDocumentAction(
      'pdf.watermark',
      markFile(action.props, WATERMARK, { app, automation, runContext })
    ).pipe(
      Effect.withSpan('automations.handle-pdf-watermark', { attributes: actionAttributes(action) })
    )
)

export const handlePdfStamp = decodedHandler(
  PdfStampSettings,
  (action, app, automation, runContext) =>
    runDocumentAction(
      'pdf.stamp',
      markFile(action.props, STAMP, { app, automation, runContext })
    ).pipe(
      Effect.withSpan('automations.handle-pdf-stamp', { attributes: actionAttributes(action) })
    )
)
