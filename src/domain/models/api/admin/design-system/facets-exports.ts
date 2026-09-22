/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ---------------------------------------------------------------------------
// What each export weighs
// ---------------------------------------------------------------------------

/** The two serializations [internal ref] A2 authorises. */
export const designSystemExportFormatSchema = Schema.Literals(['json', 'md']).annotate({
  description: 'Which serialization this row measures',
})

/**
 * One export, measured against the bytes it actually serves.
 *
 * ─── A FIGURE TYPED BESIDE A LINK IS DOCUMENTATION THAT DRIFTS ─────────────
 *
 * The approved reference for the "For agents" page prints *11.2 KB · 178 lines
 * · 13 sections* beside each download. Those are illustrative numbers from one
 * app: on any other instance they are wrong, and nothing would ever say so.
 * `[internal ref]` closes that by fetching the export and comparing —
 * so the page has to read the real measurement rather than carry a literal, and
 * a config page cannot count bytes.
 *
 * Every figure here is therefore taken from the SAME builder the download
 * serves, in the same request. Measuring anything else would reintroduce the
 * drift one layer down.
 *
 * ─── FACTS, NOT A RENDERED LABEL ───────────────────────────────────────────
 *
 * `bytes` is an integer and not a `"11.2 KB"` string, even though the page
 * prints the string and config has no arithmetic. A rendered label in a wire
 * contract makes the API own a unit convention and a rounding rule, and the
 * next consumer that wants MB gets neither. The unit belongs to the renderer,
 * which already owns one (`format: 'bytes'`), and the console reaches it by
 * declaring that format on the column.
 *
 * ─── `excerpt`, AND WHY THE PAGE CANNOT SETTLE FOR A LINK ──────────────────
 *
 * A link says a file exists. `[internal ref]` additionally requires
 * each card to show more than two lines of the real document, because an
 * operator about to paste their whole design system into someone else's
 * context window should be able to see what they are handing over without
 * leaving the page. It is a prefix of the served bytes, never a summary.
 */
export const designSystemExportRowSchema = Schema.Struct({
  format: designSystemExportFormatSchema,
  href: Schema.String.annotate({
    description:
      'Where the export is served. Mount-relative, so a second admin mount links its own copy.',
    examples: ['/api/admin/design-system.json'],
  }),
  bytes: Schema.Int.annotate({
    description:
      'The UTF-8 byte length of the document this endpoint would serve right now, measured from the same builder',
  }),
  lines: Schema.Int.annotate({
    description: 'How many lines that document has, counted the way a reader would',
  }),
  sections: optionalField(
    Schema.Int.annotate({
      description:
        'How many top-level sections the document is divided into. Markdown only — a JSON document has groups, not sections, and inventing a count for it would put a false parallel on the page.',
    })
  ),
  excerpt: Schema.String.annotate({
    description:
      'The opening lines of the served document, verbatim. A prefix of the real bytes, never a summary of them.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignSystemExportRow',
})

/** Both exports, measured — the shared envelope. */
export const designSystemExportsResponseSchema = Schema.Struct({
  items: Schema.Array(designSystemExportRowSchema).annotate({
    description: 'One row per authorised serialization',
  }),
  total: Schema.Int.annotate({
    description: 'How many rows this response carries',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignSystemExportsResponse',
})

/** @public */
export type DesignSystemExportFormat = typeof designSystemExportFormatSchema.Type
/** @public */
export type DesignSystemExportRow = typeof designSystemExportRowSchema.Type
/** @public */
export type DesignSystemExportsResponse = typeof designSystemExportsResponseSchema.Type
