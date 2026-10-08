/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { ImageLayoutRequest } from '@/domain/models/app/automations/actions/pdf/image-page-layout-service'
import type { PdfInspectResult } from '@/domain/models/app/automations/actions/pdf/inspect'
import type { MarkPlacement } from '@/domain/models/app/automations/actions/pdf/mark-placement-service'
import type { Effect } from 'effect'

/** The bytes could not be opened: they are not a PDF, or the PDF is encrypted. */
export class PdfOpenError extends Data.TaggedError('PdfOpenError')<{
  readonly reason: 'not-a-pdf' | 'encrypted'
  readonly message: string
}> {}

/** An edit could not be made; `message` says why, in the config's words. */
export class PdfEditError extends Data.TaggedError('PdfEditError')<{
  readonly message: string
}> {}

/** A picture of `fromImages` could not be used; `index` is its 0-based position. */
export class PdfPictureError extends Data.TaggedError('PdfPictureError')<{
  readonly index: number
  readonly message: string
}> {}

/** One page as stored: its MediaBox size in points, and the rotation it is shown at, clockwise. */
export interface PdfPageFacts {
  readonly width: number
  readonly height: number
  readonly rotation: number
}

/** An opened, unencrypted PDF: its pages, and a handle only {@link PdfEditor} reads. */
export interface OpenedPdf {
  readonly pages: readonly PdfPageFacts[]
  readonly handle: unknown
}

/** What a mark is: a line of text, or a PNG or JPEG picture. */
export type PdfMarkContent =
  | { readonly kind: 'text'; readonly fontSize: number; readonly color: string }
  | {
      readonly kind: 'image'
      readonly bytes: Uint8Array
      /** Points wide; `half-page` is half the page's width, `natural` its pixel width. */
      readonly width: number | 'half-page' | 'natural'
    }

/** One mark drawn on some pages; a text mark carries each page's own text. */
export interface PdfMarkRequest {
  readonly content: PdfMarkContent
  readonly placement: MarkPlacement
  /** Degrees counter-clockwise. */
  readonly angle: number
  readonly opacity: number
  readonly pages: ReadonlyArray<{ readonly index: number; readonly text?: string }>
}

/** A form value as `fillForm` takes it. */
export type PdfFormValue = string | number | boolean | readonly string[]

/** A PDF built anew: its bytes and its page count. */
export interface BuiltPdf {
  readonly bytes: Uint8Array
  readonly pages: number
}

/**
 * Editing PDFs inside the binary (pure JS, no engine): the engine behind
 * `pdf/split`, `pages`, `watermark`, `stamp`, `fillForm`, `inspect` and
 * `fromImages`. Every edit returns new bytes; nothing is stored here.
 */
export class PdfEditor extends Context.Service<
  PdfEditor,
  {
    /** Read `bytes` for editing; an encrypted PDF is refused. */
    readonly open: (bytes: Uint8Array) => Effect.Effect<OpenedPdf, PdfOpenError>
    /** Report what a PDF holds; an encrypted one is reported, not refused. */
    readonly inspect: (bytes: Uint8Array) => Effect.Effect<PdfInspectResult, PdfOpenError>
    /** One new PDF per group, each holding those pages (0-based) in that order. */
    readonly pick: (
      pdf: OpenedPdf,
      groups: readonly (readonly number[])[]
    ) => Effect.Effect<readonly BuiltPdf[], PdfEditError>
    /** Turn the pages to the given rotations, clockwise, by 0-based index. */
    readonly rotate: (
      pdf: OpenedPdf,
      rotations: ReadonlyMap<number, number>
    ) => Effect.Effect<BuiltPdf, PdfEditError>
    /** Draw one mark on the listed pages. */
    readonly mark: (
      pdf: OpenedPdf,
      request: PdfMarkRequest
    ) => Effect.Effect<BuiltPdf, PdfEditError>
    /** Write values into the form by field name, flattening it when asked. */
    readonly fillForm: (
      pdf: OpenedPdf,
      values: Readonly<Record<string, PdfFormValue>>,
      flatten: boolean
    ) => Effect.Effect<BuiltPdf, PdfEditError>
    /** A PDF of pictures (JPEG, PNG or WebP), one page each, laid out as asked. */
    readonly fromImages: (
      pictures: readonly Uint8Array[],
      layout: Omit<ImageLayoutRequest, 'picture'>
    ) => Effect.Effect<BuiltPdf, PdfPictureError>
  }
>()('PdfEditor') {}
