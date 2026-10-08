/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'

/**
 * The office engine behind `document/convert`: a Word, Excel, PowerPoint,
 * or OpenDocument file in, its PDF out. Configured by the `OFFICE_*`
 * variables; with none, every conversion fails with `office_unavailable`,
 * naming the variable to set.
 */

/** Why a conversion produced no PDF. */
export type OfficeConvertReason =
  'office_unavailable' | 'render_timeout' | 'office_conversion_failed'

export class OfficeConvertError extends Data.TaggedError('OfficeConvertError')<{
  readonly reason: OfficeConvertReason
  /** Starts with the reason; names the variable or the file at fault. */
  readonly message: string
}> {}

/** One file to convert: its name (the extension tells LibreOffice what it is) and bytes. */
export interface OfficeFile {
  readonly name: string
  readonly bytes: Uint8Array
}

export class OfficeConverter extends Context.Service<
  OfficeConverter,
  {
    readonly convertToPdf: (file: OfficeFile) => Effect.Effect<Uint8Array, OfficeConvertError>
  }
>()('OfficeConverter') {}
