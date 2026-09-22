/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `kbd` — a key or a chord, drawn as keycaps.
 *
 * ─── ONE `<kbd>` PER KEY, AND THE SEPARATOR IS NEVER ONE ───────────────────
 *
 * `keys` is an array because each cap is its own element: the box, the border
 * and the thicker bottom edge are per key. Joining the chord into one box is
 * what a naive renderer produces, and it is the failure the array shape exists
 * to prevent.
 *
 * `separator` prints as PLAIN TEXT between the caps and never gets a box of its
 * own. That is the distinction a reader has to make at a glance — `+` is a
 * separator in `Ctrl+C` and a key in `Ctrl++` — and it is precisely the one no
 * string-splitting rule can make, which is why the schema refuses to take the
 * chord as a string.
 *
 * `<kbd>` is also the element HTML has for input, and nothing else in the kit
 * emits it: `code` says "this is source", a keycap says "press this".
 *
 * Source: src/domain/models/app/pages/components/component-types/content/kbd.ts
 * Specs: [internal ref]
 */

import {
  computeKbdCapClasses,
  computeKbdChordClasses,
  computeKbdSeparatorClasses,
} from '../../design/interactive-content-default-classes'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'
import type { ReactElement } from 'react'

/**
 * The caps, with the separator interposed between them.
 *
 * `flatMap` rather than a join: the separator is a SIBLING of the caps in the
 * DOM, not a character inside one, so the two have to be separate nodes for
 * `chord.locator('kbd')` to count what a reader counts.
 */
const renderKeys = (
  keys: readonly string[],
  separator: string | undefined
): readonly ReactElement[] =>
  keys.flatMap((key, index): readonly ReactElement[] => {
    const cap = (
      <kbd
        key={`key-${String(index)}`}
        className={computeKbdCapClasses()}
      >
        {key}
      </kbd>
    )
    if (index === 0 || separator === undefined) return [cap]
    return [
      <span
        key={`sep-${String(index)}`}
        data-kbd-separator=""
        className={computeKbdSeparatorClasses()}
      >
        {separator}
      </span>,
      cap,
    ]
  })

/**
 * `kbd` — the chord.
 *
 * With no `separator` the caps sit adjacent under the chord's own gap, which is
 * the convention on Apple keyboards and in most modern documentation. That is
 * why a single key renders as one cap and NOTHING else: a renderer that always
 * interposed a joining character would put a stray glyph beside `Esc`.
 */
export const kbdComponent: ComponentRenderer = ({ elementPropsWithSpacing, component }) => {
  const source = (component ?? {}) as unknown as Readonly<Record<string, unknown>>
  const keys = Array.isArray(source['keys'])
    ? (source['keys'] as readonly unknown[]).filter((key): key is string => typeof key === 'string')
    : []
  const declaredSeparator = source['separator']
  const separator = typeof declaredSeparator === 'string' ? declaredSeparator : undefined
  const { className: authorClassName, ...rest } = elementPropsWithSpacing

  return (
    <span
      {...rest}
      className={mergePrestyle(computeKbdChordClasses(), authorClassName as string | undefined)}
    >
      {renderKeys(keys, separator)}
    </span>
  )
}
