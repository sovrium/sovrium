/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optStr } from '../../shared-schemas'
import { contentFields } from '../modules/content'
import { coreFields } from '../modules/core'
import { visibilityFields } from '../modules/visibility'

export const CodeElementTypeLiteral = Schema.Literal('code')

export const CodeFrameSchema = Schema.Literal('none', 'file', 'terminal').annotations({
  title: 'Code Frame',
  description:
    'Chrome drawn around the code block: none (bare pre), file (filename header), or terminal (shell-session header). Omit to let the frame be inferred — see the precedence rule on codeElementFields.',
})

export const codeElementFields = {
  ...coreFields,
  ...contentFields,
  ...visibilityFields,
  codeFrame: Schema.optional(CodeFrameSchema),
  filename: optStr(
    'Path or name of the file this snippet belongs in, shown in the frame header. Rendered OUTSIDE `pre code` so it never lands in the clipboard, and used to label the block for assistive technology. Implies codeFrame: "file" when codeFrame is omitted.'
  ),
  terminalLabel: optStr(
    'Label for a terminal frame header (default: "terminal"). Plain text, no prompt glyph — a "$" would be copied along with the command.'
  ),
  copy: Schema.optionalWith(
    Schema.Boolean.annotations({
      description:
        'Show a copy-to-clipboard button on the block (default true). The payload is the COMMAND only: a framed block with `output` excludes the output, and the frame header excludes the filename.',
    }),
    { default: () => true }
  ),
  copyLabel: optStr('Accessible name and visible label of the copy button (default: "Copy")'),
  copiedLabel: optStr(
    'Visible label shown briefly after a successful copy (default: "Copied"). The button keeps its `copyLabel` accessible name across the flip, so a screen-reader user does not lose the control.'
  ),
  output: optStr(
    'Output the command produces, rendered as a SECOND `<pre>` below the command inside the same frame. Implies codeFrame: "terminal" when codeFrame is omitted. Note for spec authors: a block with `output` puts TWO `<pre>` on the page, so a bare `page.locator("pre")` is strict-mode ambiguous.'
  ),
} as const
