/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/** One input of a merge could not be used; `index` is its 0-based position. */
export class PdfInputError extends Data.TaggedError('PdfInputError')<{
  readonly index: number
  readonly message: string
}> {}

/** A PDF read as the toolkit holds it: its page count, and a handle to merge it by. */
export interface LoadedPdf {
  readonly pageCount: number
  /** Opaque: only {@link PdfToolkit}'s own `merge` reads it. */
  readonly handle: unknown
}

/** A merged PDF: its bytes and its page count. */
export interface MergedPdf {
  readonly bytes: Uint8Array
  readonly pages: number
}

/**
 * PDF structure inside the binary (pure JS, no engine): read a document, and
 * build a new one from chosen pages of several. The engine behind `pdf/*`.
 */
export class PdfToolkit extends Context.Service<
  PdfToolkit,
  {
    /** Read `bytes` as a PDF; fails with `index` when they are not one. */
    readonly load: (bytes: Uint8Array, index: number) => Effect.Effect<LoadedPdf, PdfInputError>
    /** One document from the given pages (0-based) of each loaded PDF, in order. */
    readonly merge: (
      parts: ReadonlyArray<{ readonly pdf: LoadedPdf; readonly pages: readonly number[] }>
    ) => Effect.Effect<MergedPdf, PdfInputError>
  }
>()('PdfToolkit') {}
