/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { contentFields } from '../modules/content'
import { coreFields } from '../modules/core'
import { dataBoundFields } from '../modules/data-bound'
import { i18nFields } from '../modules/i18n'
import { interactionFields } from '../modules/interaction'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const ContainerTypeLiteral = Schema.Literal('container')

export const ContainerElementSchema = Schema.Literals([
  'div',
  'section',
  'main',
  'aside',
  'nav',
  'header',
  'footer',
  'article',
]).annotate({
  title: 'Container Element',
  description: 'HTML element to render. Defaults to "div".',
})

/**
 * Render this container's children once per element of an array the BOUND
 * RECORD already carries ([internal ref] CAP-6).
 *
 * --- WHY A KEY OF ITS OWN, AND NOT A THIRD `dataSource` ARM ----------------
 *
 * `dataSource` means "go and read" to every consumer in the tree, and this
 * means "look at what you already have". Three consumers would see a
 * `{ record }` arm without being asked to: `isSystemRowTemplate`, the table
 * lookup in `resolveComponent` (which answers with a `table "undefined" not
 * found` banner when it finds a binding with no `table`), and
 * `classifyPageCacheability`, which marks a page dynamic on the mere PRESENCE
 * of a `dataSource`. A distinct key is invisible to all three by construction.
 *
 * --- WHY IT IS DECLARED HERE AND NOT INJECTED -----------------------------
 *
 * `buildComponentUnion` would hand the key to every container type, and all
 * but this one cannot read it -- inert config, silently. Declaring it on
 * `container` alone means exactly one type accepts it and one renderer reads it.
 *
 * --- WHY A STRUCT AND NOT THE BARE STRING ---------------------------------
 *
 * `{ record: 'steps' }` leaves `repeat: { rows: ... }` -- an actual READ, which
 * is what a record's LINKED rows need -- as a future ADDITIVE arm rather than a
 * breaking change. And `repeat: '$record.steps'` would put the text-interpolation
 * grammar in a position that is not a text interpolation, which is how a grammar
 * acquires a second meaning.
 *
 * --- SCOPE, STATED SO IT IS NOT MISTAKEN FOR A LIMIT NOBODY CHOSE ---------
 *
 * One flat key, because `$record.` walks no path (`substitute-record-vars.ts`
 * -> `RECORD_REFERENCE`). Inside a repeat, `$record.<key>` resolves against THE
 * ELEMENT -- one grammar, re-scoped, exactly as `expandDataSourceChildren`
 * already does per row. Supported in ONE position: a record-bound `drawer`'s
 * `children`. Every other position is refused at decode
 * (`component-rule-validation.ts`), because the array only exists where a
 * record has already been fetched.
 *
 * It resolves in CONTENT and in a `data-*` prop, against the same element in
 * both — so `'data-step-index': '$record.index'` states a fact that is true of
 * the copy carrying it. Every OTHER prop keeps the token verbatim: the expansion
 * runs in the browser over a parsed copy, where what a value means is
 * per-destination (an `href` navigates, a `style` can name a `url(`), and a
 * `data-*` attribute is the half that needs no such answer. Widening it is its
 * own capability with its own escaping contract.
 */
export const ContainerRepeatSchema = Schema.Struct({
  /**
   * A field of the bound record holding an array. A missing field, or one
   * holding a non-array, renders ZERO copies -- never the unsubstituted
   * template, which would ship `$record.` tokens to the browser as text.
   */
  record: Schema.String.annotate({
    description:
      "Field of the bound record holding a list; the container's children are drawn once per entry.",
  }).pipe(Schema.check(Schema.isMinLength(1))),
}).annotate({
  title: 'Container Repeat',
  description:
    "Render this container's children once per element of an array already carried by the bound record. Supported inside a record-bound drawer's `children`. Inside the repeat, `$record.<field>` resolves against the ELEMENT.",
})

export const containerFields = {
  ...coreFields,
  ...contentFields,
  ...dataBoundFields,
  ...interactionFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  element: Schema.optional(ContainerElementSchema),
  /**
   * Omitted is today, byte for byte: nothing reads the key, and a container
   * without it is untouched.
   */
  repeat: Schema.optional(ContainerRepeatSchema),
} as const
