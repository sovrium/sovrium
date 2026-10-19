/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

/**
 * The line-number gutter — one ADDRESSABLE element per line.
 *
 * ## Why each number is an element and not a CSS counter
 *
 * A `::before { content: counter(line) }` gutter is less markup and is the
 * wrong tool. `lineNumbers` shipped half-wired — read off the open `props` bag,
 * turned into a `data-line-numbers` attribute, and never styled by anything —
 * so an author could ask for a gutter, watch it validate, and get nothing while
 * the published docs advertised it in both locales. A counter-generated number
 * is unreachable to everything that could have caught that: it cannot be
 * counted, addressed by its own value, or asserted absent from a clipboard
 * payload. Each number is therefore a real `[data-line-number="N"]` element,
 * addressable exactly as this file's own command and output are by
 * `[data-code-command]` / `[data-code-output]`.
 *
 * ## Why it sits inside `<pre>` but outside `<code>`
 *
 * The delegated copy handler resolves its payload as
 * `pre[data-copy-target] → querySelector('code') → textContent`. A gutter
 * inside the `<code>` would be copied WITH the snippet and pasted into the
 * reader's editor as a leading column of digits — the filename failure of
 * a pages content spec, one element down. Outside it, exclusion is structural:
 * nothing has to remember to strip the numbers, because they were never in the
 * element that gets read.
 *
 * `aria-hidden` because the numbers are chrome. A screen-reader user reaching a
 * numbered snippet should hear the code, not "one two three" ahead of it; the
 * block is already named for them by its filename.
 */
export function renderLineGutter(numbers: readonly number[]): ReactElement {
  return (
    <span
      data-line-numbers-gutter="true"
      aria-hidden="true"
    >
      {numbers.map((line) => (
        <span
          key={line}
          data-line-number={String(line)}
        >
          {line}
        </span>
      ))}
    </span>
  )
}
