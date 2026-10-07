/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `file-preview` — a stored file drawn inline: a PDF in the browser's own
 * viewer, an image with zoom, anything else as a card with Download.
 *
 * ─── TWO ADDRESSES, NEVER BOTH ────────────────────────────────────────────
 *
 * The file is named EITHER by an attachment `field` of the bound record (the
 * record page case: "the invoice of this order") OR by a fixed `file` in a
 * bucket (the policy PDF every member reads). Both together is refused at
 * decode (`component-xor-rules.ts`): one would be drawn and the other dropped.
 *
 * ─── THE READER'S PERMISSION, NOT THE PAGE'S ──────────────────────────────
 *
 * The preview is served through a signed URL minted for the reader's own
 * session, so a reader who may not read the record (or the bucket) gets no
 * preview and no URL — the component is simply absent, as every gated
 * component is. Nothing here can widen that.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const FilePreviewTypeLiteral = Schema.Literal('file-preview')

export const FilePreviewFileSchema = Schema.Struct({
  bucket: Schema.String.pipe(
    Schema.annotate({ description: 'Name of the bucket holding the file', examples: ['policies'] }),
    Schema.check(Schema.isMinLength(1))
  ),
  key: Schema.String.pipe(
    Schema.annotate({
      description: 'Path of the file inside the bucket',
      examples: ['handbook/2026.pdf'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
}).annotate({
  identifier: 'FilePreviewFile',
  title: 'File Preview File',
  description: 'A fixed file in a bucket: the bucket name and the path inside it',
})

export const FilePreviewToolSchema = Schema.Literals([
  'download',
  'open',
  'zoom',
  'rotate',
]).annotate({
  identifier: 'FilePreviewTool',
  title: 'File Preview Tool',
  description:
    'One toolbar button: download the file, open it in a new tab, zoom an image, or rotate an image',
})

export const filePreviewFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  field: Schema.optional(
    Schema.String.annotate({
      description:
        'An attachment field of the bound record whose file(s) are previewed. Mutually exclusive with `file`.',
      examples: ['invoice', 'documents'],
    })
  ),
  file: Schema.optional(FilePreviewFileSchema),
  height: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description: 'Height of the preview stage in pixels (default: 560)',
        examples: [480, 720],
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
  fit: Schema.optional(
    Schema.Literals(['contain', 'width']).annotate({
      description:
        'How an image or page sits in the stage: contain (whole, default) or width (fills the width and scrolls)',
    })
  ),
  toolbar: Schema.optional(
    Schema.Array(FilePreviewToolSchema).annotate({
      description:
        'Toolbar buttons, in order (default: download, open). Zoom and rotate apply to images only.',
    })
  ),
  list: Schema.optional(
    Schema.Literals(['auto', 'none']).annotate({
      description:
        'For a field holding several files: auto (default) lists them beside the stage to switch between; none previews the first only',
    })
  ),
  altField: Schema.optional(
    Schema.String.annotate({
      description:
        'A field of the bound record whose value is the image’s alternative text. Omitted, the file name is used.',
    })
  ),
} as const
