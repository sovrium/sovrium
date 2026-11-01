/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement, ScriptHTMLAttributes } from 'react'

export interface InlineScriptProps extends Omit<
  ScriptHTMLAttributes<HTMLElement>,
  'children' | 'dangerouslySetInnerHTML'
> {
  /** An engine-authored script or stylesheet CONSTANT; nothing is interpolated into it. */
  readonly source: string
  /** `script` (default) or `style` for an engine-authored stylesheet constant. */
  readonly as?: 'script' | 'style'
}

/**
 * Places an engine-authored script (or stylesheet) constant, verbatim.
 *
 * `source` is a string the engine wrote in its own source: a literal, or an
 * imported SCREAMING_CASE constant holding one. No config value, record value
 * or request field is ever interpolated into it — a script that needs one is
 * built with `serializeJsonForScript` and placed where that proof is visible.
 *
 * `sovrium/require-sanitized-html` (with `recognizeMarkupComponents`) checks
 * every `<InlineScript source={…}>` at the call site. This file is the one place
 * that owns `dangerouslySetInnerHTML` for that class.
 */
export function InlineScript({
  source,
  as: Host = 'script',
  ...attributes
}: InlineScriptProps): ReactElement {
  return (
    <Host
      {...attributes}
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- the one placement of this class: every caller's `source` is proven at its call site by sovrium/require-sanitized-html's recognizeMarkupComponents option, whose own-file exemption reads this literal object
      dangerouslySetInnerHTML={{ __html: source }}
    />
  )
}
