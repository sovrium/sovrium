/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { Effect } from 'effect'

/** One file of the documents to lay out, by its path relative to the others. */
export interface PageMeasureFile {
  readonly path: string
  readonly bytes: Uint8Array
}

/**
 * How tall a static document is drawn: the height of its `<body>` laid out at
 * a width, with every stylesheet, font and image it names beside it.
 *
 * A port because laying a page out needs a browser engine, which belongs to
 * the infrastructure. It never fails: a document that could not be measured
 * (no engine on this machine, a timeout) answers `undefined`, and the caller
 * falls back to an estimate. Optional: a runtime that provides none measures
 * nothing.
 */
export class PageMeasure extends Context.Service<
  PageMeasure,
  {
    /**
     * The drawn height, in CSS pixels rounded up, of each of `documents`.
     *
     * @param input.files - every file the documents load, by relative path.
     * @param input.documents - the paths among `files` to measure, in order.
     * @param input.width - the viewport width, in CSS pixels.
     */
    readonly drawnHeights: (input: {
      readonly files: readonly PageMeasureFile[]
      readonly documents: readonly string[]
      readonly width: number
    }) => Effect.Effect<readonly (number | undefined)[]>
  }
>()('PageMeasure') {}
