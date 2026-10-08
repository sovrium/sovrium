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
import { PAGE_ANCHORS } from '@/domain/models/app/automations/actions/pdf/placement'
import { isRecord, runDocumentAction, type Raw } from './document-run'
import {
  carryOut,
  numberOr,
  fileRefProp,
  openPdfFile,
  outputOf,
  propsOf,
  readFile,
  refuse,
  writePdf,
  type PdfScope,
} from './pdf-step'
import { actionAttributes, type ActionHandler } from './shared'
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

const isAnchor = (value: unknown): value is PageAnchor =>
  PAGE_ANCHORS.some((anchor) => anchor === value)

/** The picture an `image` mark draws: a PNG or a JPEG. */
const imageContent = (props: Raw, defaults: MarkDefaults, scope: PdfScope) =>
  Effect.gen(function* () {
    const read = yield* readFile(fileRefProp(props, 'image', scope), 'image', scope)
    const type = sniffContentType(read.bytes)
    if (type !== 'image/png' && type !== 'image/jpeg') {
      return yield* refuse(`image (${read.filename}) is not a PNG or a JPEG`)
    }
    const width = numberOr(props['width'], Number.NaN)
    return {
      kind: 'image',
      bytes: read.bytes,
      width: Number.isFinite(width) && width > 0 ? width : defaults.imageWidth,
    } satisfies PdfMarkContent
  })

/** What the mark is. */
const contentOf = (props: Raw, defaults: MarkDefaults, scope: PdfScope) =>
  props['image'] === undefined
    ? Effect.succeed({
        kind: 'text',
        fontSize: numberOr(props['fontSize'], defaults.fontSize),
        color: typeof props['color'] === 'string' ? props['color'] : defaults.color,
      } satisfies PdfMarkContent)
    : imageContent(props, defaults, scope)

/** Where the mark goes: `at`, or an anchor kept `margin` points from the edges. */
const placementOf = (props: Raw, defaults: MarkDefaults): MarkPlacement => {
  const { at } = props
  if (isRecord(at)) return { at: { x: numberOr(at['x'], 0), y: numberOr(at['y'], 0) } }
  const fallback = props['pageNumbers'] === undefined ? defaults.anchor : defaults.numbersAnchor
  return {
    anchor: isAnchor(props['position']) ? props['position'] : fallback,
    margin: numberOr(props['margin'], 36),
  }
}

/** Each listed page's text: the page number when numbering, else the text as written. */
const pageTexts = (props: Raw, indexes: readonly number[]): readonly string[] => {
  const numbering = props['pageNumbers']
  if (isRecord(numbering)) return pageNumberTexts(indexes, numbering)
  return indexes.map(() => String(props['text'] ?? ''))
}

const markFile = (props: Raw, defaults: MarkDefaults, scope: PdfScope) =>
  Effect.gen(function* () {
    const { pdf, filename } = yield* openPdfFile(fileRefProp(props, 'file', scope), scope)
    const indexes = yield* carryOut(pagesOrRefusal(props['pages'], pdf.pages.length))
    const content = yield* contentOf(props, defaults, scope)
    const texts = content.kind === 'text' ? pageTexts(props, indexes) : []
    const marked = yield* (yield* PdfEditor).mark(pdf, {
      content,
      placement: placementOf(props, defaults),
      angle: numberOr(props['angle'], content.kind === 'text' ? defaults.textAngle : 0),
      opacity: numberOr(props['opacity'], defaults.opacity),
      pages: indexes.map((index, at) => ({
        index,
        ...(content.kind === 'text' ? { text: texts[at] ?? '' } : {}),
      })),
    })
    return yield* writePdf(outputOf(props, filename), marked, scope)
  })

export const handlePdfWatermark: ActionHandler = (action, app, automation, runContext) =>
  runDocumentAction(
    'pdf.watermark',
    markFile(propsOf(action), WATERMARK, { app, automation, runContext })
  ).pipe(
    Effect.withSpan('automations.handle-pdf-watermark', { attributes: actionAttributes(action) })
  )

export const handlePdfStamp: ActionHandler = (action, app, automation, runContext) =>
  runDocumentAction(
    'pdf.stamp',
    markFile(propsOf(action), STAMP, { app, automation, runContext })
  ).pipe(Effect.withSpan('automations.handle-pdf-stamp', { attributes: actionAttributes(action) }))
