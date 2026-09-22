/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ---------------------------------------------------------------------------
// Where a type — or a named template — is already written
// ---------------------------------------------------------------------------

/**
 * Which of the two "where is this used" questions a row answers.
 *
 * They look like one question and are not, and the console asks both on
 * different pages. `type` walks for a component TYPE (`button`) and backs the
 * per-type page's "Used on" section and the kit card's page count. `component`
 * walks for a named TEMPLATE from `components[]` (`section-header`) and backs
 * the Components page, where a card names every route its template is embedded
 * on.
 *
 * One endpoint rather than two because the walk, the exclusion rule and the row
 * shape are identical — only the key differs — and two endpoints would be two
 * places for the `props` exclusion below to be got right.
 */
export const usageSubjectSchema = Schema.Literals(['type', 'component']).annotate({
  description: 'Whether `name` is an engine component type or a named template from `components[]`',
})

/**
 * How many of the operator's routes write one subject, and which.
 *
 * ─── ROUTES RATHER THAN A BARE COUNT ───────────────────────────────────────
 *
 * "Used on 38 pages" tells an author that changing this is expensive; it does
 * not tell them what it reaches. The count is derivable from the list and the
 * list is not derivable from the count, so the list is what is published — and
 * `count` rides along because a card index prints it eighty-five times and
 * `items.length` is not a thing a bound column can render.
 *
 * ─── THE WALK IS RECURSIVE, AND SKIPS `props` WHOLE ────────────────────────
 *
 * Both properties are load-bearing and both were measured on the shipped apps.
 * A top-level-only walk of `pages[].components[]` sees three distinct
 * catalogued types where the recursive walk sees twenty-three — `button` among
 * the twenty that vanish — so a flat counter prints "0 routes" on the very page
 * the reference draws, indistinguishably from the types that genuinely have no
 * usage. And `props` carries native HTML attributes whose values collide with
 * type names: thirteen `props.type: 'button'` across the shipped apps inflate
 * `button` by 45% if the walk descends into it. `[internal ref]` pins
 * exactly that collision, with a `/phantom` route that must NOT be counted.
 *
 * A subject nobody writes is a row with `count: 0` and an empty `routes`, not
 * an absent row: the card index draws a card per catalogued type either way,
 * and an absent row would make "unused" indistinguishable from "not a type".
 */
export const usageRowSchema = Schema.Struct({
  subject: usageSubjectSchema,
  name: Schema.String.annotate({
    description: 'The type literal or the template name, exactly as an author writes it in config',
    examples: ['button', 'section-header'],
  }),
  count: Schema.Int.annotate({
    description:
      'How many of the operator’s routes write this subject anywhere in their component tree',
  }),
  routes: Schema.Array(Schema.String).annotate({
    description:
      'Those routes, in page order. Empty — never absent — for a subject nobody writes. A bare `string[]`, so it is readable by a CALLER but not bindable by a config page: see `routeRows` on the response for the row-shaped copy and why both exist.',
    examples: [['/', '/pricing']],
  }),
  // ─── WHETHER A CARD MAY BE DRAWN AT FULL HEIGHT ─────────────────────────
  //
  // A page drawing every template at full height puts the fourth below three
  // screenfuls of the first three, and a footer's own specimen is taller than
  // the viewport. So a heavy template collapses to one row and offers a way in.
  //
  // REQUIRED, on `darkContrastLevel`'s reasoning: it is the GATE the card reads
  // to decide whether to draw its specimen at all, and `visibility.record`
  // carries nine value comparisons and no presence operator. `false` on a
  // `subject: 'type'` row is not a filler — a component TYPE has no template to
  // be heavy, and `false` is the true answer to "may this be drawn inline".
  //
  // A fact the page cannot compute: it is measured from the template's own
  // component tree, and a config page has no arithmetic and no recursion.
  heavy: Schema.Boolean.annotate({
    description:
      'Whether this template is too tall to draw inline, so a card collapses it behind a way in. REQUIRED on every row, `false` for a `type` subject — the gate a page reads, which cannot be an absence because there is no presence operator to test one with.',
  }),
  // ─── THE COPY PAYLOAD, ADMITTED UNDER [internal ref] ───────────────────────────
  //
  // The same test `componentTypeDetail.snippet` passes, and the same
  // serialiser: it walks the declared template and prints its own keys in its
  // own order, with no editorial choice anywhere in it. A config page has no
  // string operations with which to walk a component tree at all.
  //
  // ABSENT for a `type` subject — there is no authored template to serialise,
  // and config that produces nothing offered for copying is worse than none.
  snippet: optionalField(
    Schema.String.annotate({
      description:
        'The operator’s own declaration of this template, serialised as config — the payload a card offers to copy. ABSENT for a `type` subject: a component type is the engine’s, not the operator’s, so there is nothing of theirs to copy.',
      examples: ['name: site-header\ntype: container'],
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'UsageRow',
})

/**
 * One (subject, name, route) pair — the row-shaped copy of `UsageRow.routes`.
 *
 * ─── WHY A SECOND ARRAY RATHER THAN A SHAPE CHANGE ─────────────────────────
 *
 * `routes` is a `readonly string[]`, and a bare string array is unbindable by a
 * config page: `rowsKey` is a flat `body[key]` lookup handing a row template a
 * RECORD, and `$record.<field>` names a field of one. Strings expand into rows
 * with no fields at all.
 *
 * It is not simply RESHAPED, because the two have different readers. `routes`
 * is read by a CALLER — the per-type page's own detail projection joins it, and
 * `usageFacet` is spent by three internal callers that want the array — while
 * this is read by a PAGE. Reshaping would push the flattening onto every
 * internal caller to serve a consumer that could have its own key.
 *
 * ─── AND IT DOES NOT, ON ITS OWN, CLOSE THE COMPONENTS CARD ────────────────
 *
 * Worth stating so the next reader does not assume it does. A card must show
 * ITS OWN routes, nested inside itself — and a `{ system }` binding inside a
 * row template never expands: `mapNode` in `system-rows-template-resolver.ts`
 * returns an expanded node without recursing, deliberately, because its
 * children are per-row clones whose `$record.*` is already substituted.
 *
 * So these rows are bindable at the TOP level of a page and not inside a card.
 * What would close the nesting case is a page primitive, not another field
 * here.
 */
export const usageRouteRowSchema = Schema.Struct({
  subject: usageSubjectSchema,
  name: Schema.String.annotate({
    description: 'The subject whose route this is — the join key back to `items`',
    examples: ['site-header'],
  }),
  route: Schema.String.annotate({
    description: 'One route of the operator’s app that writes this subject',
    examples: ['/about'],
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'UsageRouteRow',
})

/**
 * The query a usage read carries.
 *
 * `name` narrows to one row for the per-type page. Omitted, the read answers
 * for every subject of the requested kind, which is what the card index needs —
 * and it is one request rather than eighty-five, because the walk is hoisted:
 * asking per type would re-walk the whole config once per card, so a
 * sixty-seven-page app would pay catalogue times config for a page that should
 * pay either.
 *
 * An unknown `name` returns zero rows rather than a 404. The catalogue is what
 * answers "does this type exist", and duplicating that judgement here would
 * give two endpoints an opportunity to disagree.
 */
export const usageQuerySchema = Schema.Struct({
  subject: optionalField(
    usageSubjectSchema.annotate({
      description: 'Which question to answer. Defaults to `type`, which is the one asked most.',
    })
  ),
  name: optionalField(
    Schema.String.annotate({
      description: 'Restrict to one subject. Omit for every subject of this kind.',
      examples: ['button'],
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'UsageQuery',
})

/** Usage over the operator's pages — the shared envelope. */
export const usageResponseSchema = Schema.Struct({
  items: Schema.Array(usageRowSchema).annotate({
    description:
      'One row per subject — catalogued types in category order, templates in declaration order — filtered by `name` when one was given',
  }),
  total: Schema.Int.annotate({
    description: 'How many rows this response carries',
  }),
  // The same routes as `items[].routes`, flattened to one row per pair, because
  // a bare `string[]` is unbindable from a config page. Never filtered
  // differently from `items`: both answer the same `subject` and `name`, so a
  // page reading one and a caller reading the other cannot disagree about which
  // routes exist.
  routeRows: Schema.Array(usageRouteRowSchema).annotate({
    description:
      'Every (subject, name, route) pair in this response, flattened — the row-shaped copy of `items[].routes` a config page can bind. EMPTY when no subject in this response is written anywhere.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'UsageResponse',
})

// ---------------------------------------------------------------------------
// The platform type ladder
// ---------------------------------------------------------------------------

/**
 * One step of the ladder the `text-*` utilities resolve to.
 *
 * ─── WHY THIS IS NOT A TOKEN ROW ───────────────────────────────────────────
 *
 * There is no inherited typography table. `inherited-tokens.ts` carries one for
 * colour, radius, duration, font, spacing and breakpoint, and NONE for
 * typography — so an app declaring no `design.typeScale` has an empty
 * `document.typography`, and the token facet correctly reports nothing.
 *
 * That is the right answer to "what did I declare" and the wrong one to "so
 * what size is my text". The operator is left with a stated gap and no way to
 * learn what their own page renders at. These rows answer the second question
 * without pretending to answer the first: they are the PLATFORM's ladder,
 * published on their own endpoint so nothing can mistake them for a
 * declaration.
 *
 * ─── AND THE READOUT IS TWO NUMBERS, NOT ONE STRING ────────────────────────
 *
 * [internal ref]: `16 / 24` is a rendered string embedding a separator the console
 * chose. The page composes it from two facts — three sibling nodes, the middle
 * one a literal — exactly as `contrastRatio` leaves the `:1` to the page.
 */
export const typeLadderRowSchema = Schema.Struct({
  step: Schema.String.annotate({
    description:
      'The step’s own name, without its `text-` prefix — what a page stamps into an addressable attribute. Published rather than derived because a config page cannot split a string.',
    examples: ['xs', '2xl'],
  }),
  utility: Schema.String.annotate({
    description:
      'The full utility class an author writes, and which the row must CARRY to render at this size. The size below is what that class resolves to, so a row printing the numbers without wearing the class would be documenting a coincidence.',
    examples: ['text-xs', 'text-2xl'],
  }),
  sizePx: Schema.Finite.annotate({
    description: 'What `utility` resolves to as a font size, in CSS pixels at a 16px root',
    examples: [11],
  }),
  leadingPx: Schema.Finite.annotate({
    description: 'The line height `utility` resolves to, in CSS pixels at a 16px root',
    examples: [16],
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'TypeLadderRow',
})

/**
 * The platform type ladder, in ascending size order.
 *
 * A BUILD CONSTANT: it takes no app and two instances on one build answer
 * identically, because the ladder belongs to the engine's stylesheet and not to
 * anybody's config. That is what makes it safe to publish beside a disclosure
 * saying the operator declared none.
 */
export const typeLadderResponseSchema = Schema.Struct({
  items: Schema.Array(typeLadderRowSchema).annotate({
    description: 'Every step of the platform ladder, in ascending size order',
  }),
  total: Schema.Int.annotate({
    description: 'How many steps this response carries — the whole ladder, never a page of it',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'TypeLadderResponse',
})

/** @public */
export type UsageSubject = typeof usageSubjectSchema.Type
/** @public */
export type UsageRow = typeof usageRowSchema.Type
/** @public */
export type UsageRouteRow = typeof usageRouteRowSchema.Type
/** @public */
export type TypeLadderRow = typeof typeLadderRowSchema.Type
/** @public */
export type TypeLadderResponse = typeof typeLadderResponseSchema.Type
/** @public */
export type UsageQuery = typeof usageQuerySchema.Type
/** @public */
export type UsageResponse = typeof usageResponseSchema.Type
