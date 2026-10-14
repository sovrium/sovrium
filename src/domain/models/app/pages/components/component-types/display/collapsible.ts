/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `collapsible` — one region hidden behind a single trigger, shown or hidden in
 * place. shadcn/ui's Collapsible, under its own name.
 *
 * ## Not an accordion
 *
 * An accordion is a SET of regions, which may close one another. A collapsible
 * is one region with no siblings: two collapsibles on a page never affect each
 * other, and there is nothing to configure about exclusivity.
 *
 * ## Zero script by default
 *
 * Without `hydrate` it is the browser's own `<details>`/`<summary>`, which opens
 * and closes with no script at all. `hydrate: true` draws a button that reports
 * its state through `aria-expanded` and names its region through
 * `aria-controls`, and loads a small script to drive it.
 *
 * Source: [internal ref]
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const CollapsibleTypeLiteral = Schema.Literal('collapsible')

export const collapsibleFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  triggerLabel: Schema.String.annotate({
    title: 'Trigger Label',
    description:
      'The words on the trigger that shows and hides the region. Required: a trigger with nothing on it cannot be found. A `$t:` key is translated.',
    examples: ['Show advanced settings'],
  }).pipe(Schema.check(Schema.isMinLength(1))),
  defaultOpen: Schema.optional(
    Schema.Boolean.annotate({
      title: 'Default Open',
      defaultNote: 'false',
      description:
        "Whether the region is open when the page loads. shadcn/ui's Collapsible defaultOpen.",
    })
  ),
  hydrate: Schema.optional(
    Schema.Boolean.annotate({
      title: 'Hydrate',
      defaultNote: 'false',
      description:
        "false draws the browser's own details and summary, with no script. true draws a button that reports and controls its region through ARIA, driven by a small script.",
    })
  ),
} as const
