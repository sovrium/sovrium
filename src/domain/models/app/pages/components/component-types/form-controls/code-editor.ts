/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `code-editor` — the editor of a `code` field, as a page component.
 *
 * ## What this publishes, and what it is NOT
 *
 * CodeMirror with one grammar, a gutter and a bounded height, reachable from a
 * page instead of only from a form bound to a `code` column. It is the twin of
 * `rich-text-editor` and the same wrapper argument applies: same chunk, same
 * grammars, addressed by a component rather than derived from a column.
 *
 * It is emphatically NOT a config editor. The four `schema-*-editor` types were
 * deleted from the catalogue precisely because their islands POSTed into the
 * records API behind a Save button, re-admitting the config-editing plane
 * [internal ref] D3 moved to paid Cloud through a door marked "design". This type edits
 * a VALUE — a formula, a snippet, a JSON blob a record holds — and carries no
 * submit control at all. The distinction is the whole reason it can be
 * catalogued when they could not: see `rich-text-editor` for the [internal ref] A3
 * clause 2 argument in full, which is identical here.
 *
 * ## `language` stays an open string, and that is the honest shape
 *
 * Eleven grammars ship (`javascript`, `typescript`, `jsx`, `tsx`, `json`,
 * `html`, `css`, `sql`, `markdown`, `python`, `yaml`). Anything else is not an
 * error, it is plain text — which is a real and reasonable thing to ask for, so
 * a closed union would refuse a config that works. This is the opposite call
 * from `rich-text-editor.toolbar`, and deliberately: an unknown TOOLBAR ACTION
 * does nothing at all and is a typo, while an unknown LANGUAGE still edits text.
 * The eleven are in `examples`, so the console publishes them without pretending
 * the twelfth is refused.
 *
 * Source: [internal ref]
 * Specs: [internal ref] … 006, plus this type's own REGRESSION rollup
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const CodeEditorTypeLiteral = Schema.Literal('code-editor')

export const codeEditorFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /** Label above the editor. */
  label: Schema.optional(
    Schema.String.annotate({ description: 'Label above the editor', examples: ['Formula'] })
  ),
  /**
   * Form field name.
   *
   * The editor keeps a hidden input under it holding the current text, so an
   * enclosing form submits it. Omit for a display-only editor.
   */
  name: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Form field name. The editor keeps a hidden input under it holding the current text, so an enclosing form submits the value. Omit for a display-only editor.',
        examples: ['formula'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** The text the editor opens with. */
  value: Schema.optional(
    Schema.String.annotate({
      description:
        'The text the editor opens with. Ordinary text, so `$record.<field>` resolves here.',
      examples: ['SUM({amount}) * 1.2', '$record.formula'],
    })
  ),
  /**
   * Grammar to highlight with.
   *
   * An unrecognised value is plain text rather than an error — see the module
   * docstring for why this is open where the toolbar vocabulary is closed.
   */
  language: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Language',
        description:
          'Grammar to highlight with. Eleven ship: javascript, typescript, jsx, tsx, json, html, css, sql, markdown, python, yaml. Any other value edits as plain text rather than failing.',
        examples: [
          'javascript',
          'typescript',
          'jsx',
          'tsx',
          'json',
          'html',
          'css',
          'sql',
          'markdown',
          'python',
          'yaml',
        ],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** Draw the line-number gutter. */
  lineNumbers: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Draw the line-number gutter (default: true). Off suits a one-line expression, where a gutter reading “1” is noise.',
    })
  ),
  /**
   * Refuse edits.
   *
   * Read-only is not disabled: the text stays selectable and copyable, and the
   * gutter dims rather than the whole box, because a snippet a reader is meant
   * to copy must not read as unavailable.
   */
  readOnly: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Refuse edits while keeping the text selectable and copyable. Draws no cursor and no active-line highlight, and dims the gutter.',
    })
  ),
  /** Width of one indent level, in spaces. */
  tabSize: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isGreaterThanOrEqualTo(1)),
      Schema.check(Schema.isLessThanOrEqualTo(8))
    ).annotate({
      title: 'Indent',
      description: 'Width of one indent level in spaces (default: 2). Between 1 and 8.',
      examples: [2, 4],
    })
  ),
  /**
   * Rows the box reserves even when the content is shorter.
   *
   * The editor grows with its content between `minLines` and `maxLines`; past
   * the maximum it scrolls. Reserving the minimum is what stops a form settling
   * twice as its editors load.
   */
  minLines: Schema.optional(
    Schema.Finite.pipe(Schema.check(Schema.isInt(), Schema.isGreaterThan(0))).annotate({
      title: 'Minimum Height',
      description:
        'Rows the box reserves even when the content is shorter. Reserved before the grammar loads, so the surrounding form does not jump.',
      examples: [3, 5],
    })
  ),
  /** Rows the box grows to before it scrolls. */
  maxLines: Schema.optional(
    Schema.Finite.pipe(Schema.check(Schema.isInt(), Schema.isGreaterThan(0))).annotate({
      title: 'Maximum Height',
      description:
        'Rows the box grows to before the content scrolls inside it instead. Must not be below `minLines` — the two bound the same box from opposite sides, so an inverted pair is refused at boot in `component-xor-rules.ts`; the schema cannot relate two sibling keys.',
      examples: [12, 20],
    })
  ),
} as const
