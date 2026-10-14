/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `attachment` — a file shown as a chip: its icon or thumbnail, its name, its
 * size, and a way to open it. shadcn/ui's Attachment, under its own name.
 *
 * ## A written chip, not a stored file
 *
 * Everything on the chip is authored: the name, the description, the address.
 * A file held by a record is `file-preview`'s job, which signs it for the
 * reader; an attachment is the chip a thread or a page lists by hand.
 *
 * ## States are drawings
 *
 * `state` other than `done` (an upload in progress, an error) is drawn, not
 * driven: there is no upload behind a written chip. A file that is not done is
 * never offered as a link, because there is nothing finished to open.
 *
 * Source: [internal ref]
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const AttachmentTypeLiteral = Schema.Literal('attachment')

/** Where a file is in its life. */
export const AttachmentStateSchema = Schema.Literals([
  'idle',
  'uploading',
  'processing',
  'error',
  'done',
]).annotate({
  title: 'Attachment State',
  defaultNote: 'done',
  description:
    "Where the file is: 'done' (ready, and linked when `href` is set), or 'idle', 'uploading', 'processing' or 'error', drawn as a state and never linked. shadcn/ui's Attachment state.",
})

export const attachmentFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  name: Schema.String.annotate({
    title: 'File Name',
    description: 'The file name printed on the chip; a link to the file is named after it.',
    examples: ['signed-contract-2026.pdf'],
  }).pipe(Schema.check(Schema.isMinLength(1))),
  description: Schema.optional(
    Schema.String.annotate({
      title: 'Description',
      description: 'A second line under the name: the kind and the size, or a status.',
      examples: ['PDF, 2.4 MB'],
    })
  ),
  media: Schema.optional(
    Schema.Literals(['icon', 'image']).annotate({
      title: 'Media',
      defaultNote: 'icon',
      description:
        "'icon' draws an icon chosen from the file extension (or `icon`); 'image' draws `src` as a thumbnail, which `src` is then required for.",
    })
  ),
  src: Schema.optional(
    Schema.String.annotate({
      title: 'Thumbnail Source',
      description: "The image drawn as the thumbnail when `media` is 'image'. Decorative.",
      examples: ['/files/visits/site-visit-photo.avif'],
    })
  ),
  icon: Schema.optional(
    Schema.String.annotate({
      title: 'Icon',
      description:
        'A Lucide icon name for the chip, overriding the one chosen from the file extension.',
      examples: ['file-text'],
    })
  ),
  state: Schema.optional(AttachmentStateSchema),
  size: Schema.optional(
    Schema.Literals(['default', 'sm', 'xs']).annotate({
      title: 'Size',
      defaultNote: 'default',
      description: "The chip's size: 'default', 'sm' or 'xs'. shadcn/ui's Attachment size.",
    })
  ),
  orientation: Schema.optional(
    Schema.Literals(['horizontal', 'vertical']).annotate({
      title: 'Orientation',
      defaultNote: 'horizontal',
      description:
        "'horizontal' sets the media beside the name; 'vertical' stacks it above, as a tile.",
    })
  ),
  href: Schema.optional(
    Schema.String.annotate({
      title: 'Link',
      description:
        "The address that opens or downloads the file. Only a file in state 'done' is linked.",
      examples: ['/files/contracts/signed-contract-2026.pdf'],
    })
  ),
} as const
