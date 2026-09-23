/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Schema } from 'effect'
import { optStr } from '../../shared-schemas'
import { contentFields } from '../modules/content'
import { coreFields } from '../modules/core'
import { visibilityFields } from '../modules/visibility'
import { CodeContentFromSchema } from './code-content-from'

export const CodeElementTypeLiteral = Schema.Literal('code')

/**
 * Chrome drawn around a code block.
 *
 * - `none` — a bare `<pre>`, no header bar (today's behaviour).
 * - `file` — a header bar naming the file the snippet belongs in.
 * - `terminal` — a header bar marking the block as a shell session, so a reader
 *   knows the content is a command to run rather than a file to save.
 */
export const CodeFrameSchema = Schema.Literals(['none', 'file', 'terminal']).annotate({
  title: 'Code Frame',
  description:
    'Chrome drawn around the code block: none (bare pre), file (filename header), or terminal (shell-session header). Omit to let the frame be inferred — see the precedence rule on codeElementFields.',
})

/**
 * Code block fields.
 *
 * This type once declared ZERO code-specific fields — `language`,
 * `lineNumbers` and friends all rode through the open `props` record. The
 * chrome below is declared at the component TOP LEVEL instead, because `props`
 * validates any key and so cannot tell a supported option from a typo.
 * Renderers must read `component.codeFrame`, never `elementProps.codeFrame`.
 *
 * `lineNumbers` came off that bag next, and its case is the argument for the
 * rule rather than an illustration of it: riding `props`, it was read, it was
 * turned into a `data-line-numbers` attribute, and NOTHING in the product ever
 * styled that attribute — so an author could ask for a gutter, watch the config
 * validate and typecheck, and get no gutter and no complaint. The published
 * docs advertised it in both locales throughout. `language` is still on the
 * bag; it is the remaining rider.
 *
 * Top-level fields are NOT reached by `$t:` translation substitution (that runs
 * over `props` only), so a renderer that wants a translatable `filename`,
 * `terminalLabel`, `copyLabel`, or `copiedLabel` must resolve it itself with
 * `resolveTranslationPattern` from `@/domain/models/app/languages/translation-resolver` —
 * precedent: `auth-form-renderer.tsx`.
 *
 * ## Frame precedence
 *
 * The frame actually drawn is resolved in this order, first match winning:
 *
 * 1. an explicit `codeFrame` — always wins, including an explicit `'none'`
 *    which suppresses chrome that would otherwise be inferred;
 * 2. else `filename` present ⇒ `'file'`;
 * 3. else `output` present ⇒ `'terminal'` (only a command has output);
 * 4. else the frame DERIVED from the block's LANGUAGE (`resolveDefaultCodeFrame`).
 *
 * Step 4 is the one this list used to stop short of, and the omission mattered:
 * a block with no `codeFrame`, no `filename` and no `output` still wears a file
 * bar captioned from its language, so an author reading "else none" here was
 * told the opposite of what they would see. The renderer is right and states
 * why — every block is framed by default, because uniform chrome is the point
 * and an unframed block has nowhere to put its copy button.
 *
 * `codeFrame: 'none'` remains the honest opt-out, and is the only way to get an
 * unframed block.
 *
 * The inference exists so the common cases need one field, not two, while an
 * explicit `codeFrame` stays authoritative — a snippet can carry a `filename`
 * for its accessible name yet render unframed via `codeFrame: 'none'`.
 */
export const codeElementFields = {
  ...coreFields,
  ...contentFields,
  ...visibilityFields,
  codeFrame: Schema.optional(CodeFrameSchema),
  /**
   * Draw a line-number gutter beside the code.
   *
   * Declared here rather than left on the open `props` bag, for the reason
   * given above: `props` validates any key, so a misspelled `lineNumbrs` was
   * accepted in silence. This is the next rider off that bag after `codeFrame`,
   * and the renderer must read `component.lineNumbers` — never
   * `elementProps.lineNumbers` — by the same rule.
   *
   * OPT-IN, unlike the `code-editor` form control whose own `lineNumbers`
   * defaults to `true`. The two differ deliberately: an editor's gutter is
   * expected, a prose snippet's is a choice, and defaulting this one on would
   * put numbers beside every code block in every shipped app.
   */
  lineNumbers: Schema.optional(
    Schema.Boolean.annotate({
      defaultNote: 'false',
      description:
        'Draw a line-number gutter beside the code (default false). Opt-in — unlike the code-editor control, whose gutter is on by default. The numbers are chrome rather than content: they render outside `pre code` so they never land in the clipboard, exactly as `filename` does.',
    })
  ),
  filename: optStr(
    'Path or name of the file this snippet belongs in, shown in the frame header. Rendered OUTSIDE `pre code` so it never lands in the clipboard, and used to label the block for assistive technology. Implies codeFrame: "file" when codeFrame is omitted.'
  ),
  terminalLabel: optStr(
    'Label for a terminal frame header (default: "terminal"). Plain text, no prompt glyph — a "$" would be copied along with the command.'
  ),
  copy: Schema.Boolean.annotate({
    defaultNote: 'true',
    description:
      'Show a copy-to-clipboard button on the block (default true). The payload is the COMMAND only: a framed block with `output` excludes the output, and the frame header excludes the filename.',
  }).pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),
  copyLabel: optStr('Accessible name and visible label of the copy button (default: "Copy")'),
  copiedLabel: optStr(
    'Visible label shown briefly after a successful copy (default: "Copied"). The button keeps its `copyLabel` accessible name across the flip, so a screen-reader user does not lose the control.'
  ),
  output: optStr(
    'Output the command produces, rendered as a SECOND `<pre>` below the command inside the same frame. Implies codeFrame: "terminal" when codeFrame is omitted. Note for spec authors: a block with `output` puts TWO `<pre>` on the page, so a bare `page.locator("pre")` is strict-mode ambiguous.'
  ),
  /**
   * Compose this block's content from a system endpoint's ROWS instead of
   * writing it out.
   *
   * Mutually exclusive with `content` and with `children` — each of the three is
   * an answer to "what is in this block", and a node declaring two of them has
   * one that silently loses. The refusals live in
   * `component-rule-validation.ts` rather than in a `Schema.check` here, because
   * `buildComponentUnion` has no per-branch refinement hook and a check on this
   * field alone cannot see its siblings.
   */
  contentFrom: Schema.optional(CodeContentFromSchema),
} as const
