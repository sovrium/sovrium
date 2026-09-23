/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `language-switcher` — the locales an app declares, shut and open.
//
// The catalogue refuses to preview it, and the refusal names a fact rather than
// a constraint: it draws the languages in `languages[]`, and the console's own
// surface app declares exactly one. A control offering a single choice is not a
// drawing of this type, it is a drawing of an app that has nothing to switch.
//
// So both are composed, with a second locale invented for the drawing — and the
// note says so, because a reader who copies this expecting two languages to
// appear has been misled by a picture.

import { panel } from './overlay-panel'
import type { PageComponent, TypePageBody } from './body-shape'

const entry = (label: string, current = false): PageComponent =>
  ({
    type: 'text',
    element: 'span',
    props: {
      className: current
        ? 'bg-background-subtle text-foreground rounded px-2 py-1.5 text-sm font-medium'
        : 'text-foreground rounded px-2 py-1.5 text-sm',
    },
    content: label,
  }) as PageComponent

const trigger = (): PageComponent =>
  ({
    type: 'button',
    variant: 'outline',
    size: 'sm',
    label: 'English',
    props: { type: 'button' },
  }) as PageComponent

const languageSwitcher: TypePageBody = {
  drawings: [
    {
      label: 'closed',
      children: [trigger()],
    },
    {
      label: 'open',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col items-start gap-1.5' },
          children: [
            trigger(),
            panel({
              width: 'w-40',
              children: [
                {
                  type: 'container',
                  element: 'div',
                  props: { className: 'flex flex-col' },
                  children: [entry('English', true), entry('Français')],
                },
              ],
            }),
          ],
        },
      ],
    },
  ],
}

export default languageSwitcher
