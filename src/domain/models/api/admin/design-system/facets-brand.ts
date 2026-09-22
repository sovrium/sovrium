/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ---------------------------------------------------------------------------
// The mark, as rows a page can draw
// ---------------------------------------------------------------------------

/**
 * One RENDERING of the declared mark.
 *
 * The Brand page draws the mark twice — the light-ink file on the app's own
 * ground, and the dark-ink one on the inverse — and each panel exists only when
 * its file is declared. Publishing them as ROWS is what lets a row template
 * replace the builder: the page cannot ask "how many panels?" without being
 * told, and a fixed two-panel layout would draw an empty frame for an app that
 * declares only `src`.
 *
 * `ground` is carried rather than derived in the page, because the pairing is a
 * FACT about the rendering: `srcDark` is only ever seen on the inverse ground,
 * and a page that drew it on the light one would document a pairing that never
 * ships.
 */
export const brandMarkRenderingSchema = Schema.Struct({
  variant: Schema.Literals(['light', 'dark']).annotate({
    description: 'Which ink this file carries — the scheme it is drawn for',
  }),
  src: Schema.String.annotate({
    description: 'The file as declared: a path or a URL, verbatim, never resolved',
  }),
  configPath: Schema.String.annotate({
    description:
      'Where this rendering is declared, so a reader who wants to change it has the line',
    examples: ['design.logo.src', 'design.logo.srcDark'],
  }),
  ground: Schema.Literals(['background', 'foreground']).annotate({
    description:
      'The ground this rendering is designed to sit on. The dark file is only ever seen on the inverse ground, so drawing it on the light one would document a pairing that never ships.',
  }),
  // ─── THE ACCESSIBLE NAME RIDES ON THE ROW IT NAMES ─────────────────────────
  //
  // `alt` is also a `facts` row, and that is the copy for a READER — one line in
  // the geometry table saying what the mark is called and where to change it.
  // This is the copy for the IMAGE, and the two are not redundant: an `img`
  // needs its own `alt`, a row template binds ONE rows source, and no config
  // primitive joins two arrays of one response body. Published only on the fact
  // row, a mark would render with an EMPTY accessible name on the very panel
  // printing the sentence that says what that name should be.
  //
  // REQUIRED, and that is a fact about the config surface rather than a choice
  // here: `LogoSchema.alt` is not optional, so an app that declares a mark has
  // necessarily named it, and a rendering row exists only where a mark does.
  // There is no reachable "rendering without a name" — which is what lets a page
  // bind `$record.alt` straight onto the `img` with no gate and no default. The
  // `facts` row stays optional because its two siblings (`clearSpace`,
  // `minWidth`) genuinely are, and a uniform row shape is worth more there than
  // an exactness only one of the three could use.
  //
  // The same value on both renderings, deliberately. `design.logo` declares ONE
  // `alt`, and the two inks are two renderings of one mark rather than two
  // marks — different names would tell a screen reader the page carries two
  // logos.
  alt: Schema.String.annotate({
    description:
      'The mark’s accessible name, as declared at `design.logo.alt`. Always present — a rendering row exists only where a mark does, and `design.logo.alt` is required. The same value on both inks: they are two renderings of one mark.',
    examples: ['Quire'],
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'BrandMarkRendering',
})

/**
 * The mark's GEOMETRY and its accessible name — the facts a sentence cannot
 * carry.
 *
 * "Leave the height of the mark around it" is obeyed differently by everyone
 * who reads it, which is why clear space and minimum width are their own fields
 * rather than guidance lines. The misuse rules ARE sentences and are NOT here:
 * they are published as `logo.misuse` on the guidance facet, beside every other
 * declared sentence, so one page filter reaches all of them.
 *
 * Every field is optional because every one of them is, in `design.logo` — an
 * app may declare a mark and say nothing about how small it may go.
 */
/**
 * ─── ROWS, NOT A NESTED OBJECT — AND THAT IS MECHANICAL ────────────────────
 *
 * `rowsKey` is a flat `body[key]` lookup and `$record.` admits no dots, so a
 * `facts: { clearSpace }` object was a shape no config page could read:
 * `$record.facts.clearSpace` resolves `$record.facts` to `[object Object]` and
 * leaves `.clearSpace` as literal text. Same constraint that put the axis
 * counts flat on a catalogue row and the variant values there as rows, one
 * level down.
 *
 * ALWAYS THREE ROWS, NEVER FILTERED. An app may declare a mark and say nothing
 * about how small it may go, so the honest per-fact answer is a row whose
 * `value` is absent — not a missing row. Filtering would make the panel's row
 * count depend on what happens to be declared, which is a layout that moves
 * under the reader for a reason the page cannot explain; and it would make "not
 * declared" indistinguishable from "this fact does not exist", the same
 * distinction `usageRow` keeps by publishing `count: 0` rather than dropping
 * the row.
 */
export const brandMarkFactSchema = Schema.Struct({
  key: Schema.Literals(['alt', 'clearSpace', 'minWidth']).annotate({
    description:
      'Which fact this row carries — the last segment of its own `design.logo` address, so a page printing it names the key an author would change',
  }),
  value: optionalField(
    Schema.String.annotate({
      description:
        'The declared value, verbatim. ABSENT when this fact is not declared — a row printing an empty value reads as a rendering failure.',
      examples: ['Leave clear space equal to the height of the mark', '96px'],
    })
  ),
  configPath: Schema.String.annotate({
    description: 'The address that declares this fact, published whether or not it is declared',
    examples: ['design.logo.clearSpace'],
  }),
  declared: Schema.Boolean.annotate({
    description:
      'Whether this fact is declared. The GATE a row template reads, where `value` is the printed content — deriving either from the other needs an `if` no config page has.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'BrandMarkFact',
})

/**
 * The brand facet: the mark's renderings, its geometry, and which state the
 * page is in.
 *
 * ─── WHY `declared` AND `state` ARE BOTH PUBLISHED ─────────────────────────
 *
 * They answer different questions and a page needs both. `declared` is the
 * PROVENANCE of the mark — there is no platform default logo, so it is binary
 * and there is no `inherited` value to carry: an app either declared one or the
 * page is showing a worked example. `state` is which of the two the page is
 * DRAWING, which is the two-way switch the builder already renders. Deriving
 * one from the other in a config page means an `if`, which a row template does
 * not have.
 *
 * ─── EMPTY IS AN ANSWER, NOT AN ABSENCE ────────────────────────────────────
 *
 * An app with no `design.logo` gets `items: []`, `declared: false`,
 * `state: 'example'` and a `facts` carrying only its `configPath` — never a
 * 404. The address is published in exactly that case, because "declare
 * `design.logo`" is the actionable half of the empty state and the page has
 * nowhere else to read it from.
 */
export const brandFacetResponseSchema = Schema.Struct({
  items: Schema.Array(brandMarkRenderingSchema).annotate({
    description:
      'One row per DECLARED rendering, light before dark. Empty when the app declares no mark.',
  }),
  total: Schema.Int.annotate({ description: 'How many renderings this response carries' }),
  declared: Schema.Boolean.annotate({
    description:
      'Whether the app declares a mark at all. There is no platform default logo, so this is the whole of the provenance question — no `inherited` case exists.',
  }),
  state: Schema.Literals(['config', 'example']).annotate({
    description:
      'Which of the two the page draws: the operator’s own mark, or the worked example that shows what declaring one would get them.',
  }),
  facts: Schema.Array(brandMarkFactSchema).annotate({
    description:
      'The mark’s accessible name and geometry, as ROWS — one per fact, in `design.logo` declaration order, always all three. See the row contract for why they are rows and why none is ever filtered out.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'BrandFacetResponse',
})

/** @public */
export type BrandMarkRendering = typeof brandMarkRenderingSchema.Type
/** @public */
export type BrandMarkFact = typeof brandMarkFactSchema.Type
/** @public */
export type BrandFacetResponse = typeof brandFacetResponseSchema.Type
