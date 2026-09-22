/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `rich-text-editor` — the editor of a `rich-text` field, as a page component.
 *
 * ## What this publishes
 *
 * The Tiptap editor has existed since the `rich-text` field type shipped, but
 * only INSIDE a form bound to a table: `crud-form` mounts it for a column whose
 * field type is `rich-text`, and the grid mounts it in a cell popover. An author
 * who wants a formatted-text control anywhere else — a page that composes its
 * own form, a note beside a record, a template — has had no way to reach it.
 *
 * This type is that reach. It is a WRAPPER: the same chunk, the same toolbar,
 * the same slash menu, the same character counter, addressed by a component
 * rather than derived from a column.
 *
 * ## It carries no submit control, and that is a safety property
 *
 * A bare editor, never a form. The kit page draws every catalogued type inside a
 * preview frame, and [internal ref] A3 clause 2 says a preview frame may carry no write
 * path — which is why `form` is refused from the catalogue
 * outright (`EXCLUDED_TYPES` in `catalog.ts`). An editor that shipped its own
 * Save button would have to join them, and the type would then be catalogued
 * only to be refused. So the value goes in a hidden input under the declared
 * `name` and whatever form encloses it submits it, exactly as `input` does.
 *
 * ## `toolbar` is a CLOSED vocabulary here and an open one on the field
 *
 * `RichTextFieldSchema.toolbar` is `Array(String)`, and it stays that way: it
 * ships, apps declare it, and narrowing a shipped open field is a breaking
 * change for a gain nobody asked for. A NEW component type has no such history,
 * and closing it buys something specific — the design console's Configuration
 * table is generated from the schema, so a closed union publishes the twelve
 * real actions where an open string publishes the word "string". A vocabulary a
 * reader cannot see is a vocabulary they guess at.
 *
 * The engine renders the buttons in ITS fixed order regardless of how the config
 * lists them, so `toolbar` selects which actions exist rather than where they sit.
 *
 * Source: [internal ref]
 * Specs: [internal ref] … 005, plus this type's own REGRESSION rollup
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const RichTextEditorTypeLiteral = Schema.Literal('rich-text-editor')

/**
 * The twelve formatting actions the editor knows.
 *
 * The same tokens `RichTextFieldSchema.toolbar` accepts as free strings —
 * `bold`, `italic`, `strike`, `heading`, `list`, `ordered-list`, `code-block`,
 * `blockquote`, `link`, `image`, `table`, `horizontal-rule` — named here so the
 * console can publish them and a typo is refused at decode rather than dropped
 * silently at mount.
 */
export const RichTextActionSchema = Schema.Literals([
  'bold',
  'italic',
  'strike',
  'heading',
  'list',
  'ordered-list',
  'code-block',
  'blockquote',
  'link',
  'image',
  'table',
  'horizontal-rule',
]).annotate({
  title: 'Toolbar Action',
  description:
    'One formatting action. Buttons render in the engine’s fixed order regardless of the order they are listed in.',
})

export const richTextEditorFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /** Label above the editor. */
  label: Schema.optional(
    Schema.String.annotate({ description: 'Label above the editor', examples: ['Notes'] })
  ),
  /**
   * Form field name.
   *
   * The editor writes its HTML into a hidden input under this name, so an
   * enclosing form submits it. Omit it for a display-only editor.
   */
  name: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        description:
          'Form field name. The editor keeps a hidden input under it holding the sanitised HTML, so an enclosing form submits the value. Omit for a display-only editor.',
        examples: ['notes'],
      })
    )
  ),
  /** The HTML the editor opens with. */
  value: Schema.optional(
    Schema.String.annotate({
      description:
        'The HTML the editor opens with. Sanitised on the way in, so a `$record.<field>` binding of stored rich text is safe here.',
      examples: ['<p>Rack shelf 1200 for the Lyon site.</p>', '$record.notes'],
    })
  ),
  /**
   * Which actions the toolbar offers.
   *
   * Omitted gives the default six — bold, italic, heading, list, link,
   * code-block — which is what the field editor already ships. An empty array is
   * NOT the same statement and is legal: it means a toolbar-free editor, where
   * the slash menu is the only way to reach a block action.
   */
  toolbar: Schema.optional(
    Schema.Array(RichTextActionSchema).annotate({
      title: 'Toolbar',
      description:
        'Actions the toolbar offers. Omit for the default six (bold, italic, heading, list, link, code-block). `[]` draws no toolbar at all — the slash menu still reaches every block action the toolbar would have enabled.',
      examples: [['bold', 'italic', 'link']],
    })
  ),
  /** What the body reads while empty. */
  placeholder: Schema.optional(
    Schema.String.annotate({
      description: 'What the body reads while the editor is empty',
      examples: ['Describe the request for the Lyon site…'],
    })
  ),
  /**
   * Character limit.
   *
   * Present, a counter is drawn under the body and turns to the error colour at
   * the limit, where further keystrokes are refused. Absent, there is no counter
   * — a counter with no limit counts up to nothing.
   */
  maxLength: Schema.optional(
    Schema.Finite.pipe(Schema.check(Schema.isInt(), Schema.isGreaterThan(0))).annotate({
      title: 'Character Limit',
      description:
        'Maximum characters. Draws the counter under the body; at the limit the counter turns to the error colour and further keystrokes are refused. Omit for no counter.',
      examples: [2000],
    })
  ),
  /**
   * Bucket the image button and the paste handler upload into.
   *
   * The URL is inserted, never the bytes: a base64 image in stored HTML grows
   * the record by a third of the file on every read.
   */
  imageBucket: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        title: 'Image Bucket',
        description:
          'Bucket the image button and the paste handler upload into (default: `default`). The uploaded URL is inserted, never base64. Unread — INERT, not refused — under a `toolbar` that omits `image`, since there is then no button to upload from.',
        examples: ['attachments'],
      })
    )
  ),
} as const
