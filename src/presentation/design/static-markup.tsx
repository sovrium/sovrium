/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { HTMLAttributes, ReactElement } from 'react'

/** The elements engine-rendered markup is re-mounted into. */
export type StaticMarkupHost = 'div' | 'span' | 'template'

export interface StaticMarkupProps extends HTMLAttributes<HTMLElement> {
  /** Markup the ENGINE rendered with `renderToStaticMarkup`, never user data. */
  readonly html: string
  /** The element that holds the markup (default `div`). */
  readonly as?: StaticMarkupHost
}

/**
 * Places markup the engine rendered on the server, verbatim.
 *
 * `html` is ENGINE-RENDERED: the output of `renderToStaticMarkup(…)` over the
 * engine's own React tree, which escapes every text and attribute value it
 * writes. It is never a record value, a config string or a request field — those
 * go through `sanitizeRichTextHTML` (`@/domain/kernel/sanitize/html-sanitization`),
 * which stays the ONE sanitizer (standing rule S2). This component sanitizes
 * nothing; it exists so that the proof lives at the call site.
 *
 * `sovrium/require-sanitized-html` (with `recognizeMarkupComponents`) checks
 * every `<StaticMarkup html={…}>`: the value must be a `renderToStaticMarkup(…)`
 * call from `react-dom/server`, inline or through a same-file `const`. This file
 * is the one place that owns `dangerouslySetInnerHTML` for that class.
 */
export function StaticMarkup({
  html,
  as: Host = 'div',
  ...attributes
}: StaticMarkupProps): ReactElement {
  return (
    <Host
      {...attributes}
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- the one placement of this class: every caller's `html` is proven at its call site by sovrium/require-sanitized-html's recognizeMarkupComponents option, whose own-file exemption reads this literal object
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
