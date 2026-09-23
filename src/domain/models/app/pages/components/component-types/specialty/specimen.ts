/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

/**
 * Specimen page-component
 *
 * Draws one component AS a component, beside the config literal that produced
 * it — the unit a design-system kit page is made of.
 *
 * ─── THE DRAWN THING AND THE SNIPPET ARE ONE DECLARATION ──────────────────
 *
 * A kit page that writes the example twice — once as config for the renderer,
 * once as a fenced string for the reader — has two sources of truth for the
 * same fact, and they drift on the first edit. The reader then copies a snippet
 * that does not produce the thing above it, which is worse than no snippet at
 * all. So `component` is declared once and BOTH the rendering and the snippet
 * are projections of it.
 *
 * ─── THE REFUSAL IS A SAFETY LINE, NOT A FILTER ───────────────────────────
 *
 * A specimen is a PREVIEW FRAME, and [internal ref] A3 clause 2 says a preview frame
 * may carry no write path. `form` emits a live submit
 * control unconditionally — the create and the update branch alike — so drawing
 * either inside a specimen would put a working write control on a read-only
 * console page. They are refused at DECODE time rather than skipped at render
 * time, because a page that silently drew nothing would leave an operator
 * believing their kit was complete.
 *
 * `specimen` refuses ITSELF for a different reason, and it is worth separating:
 * a specimen of a specimen is not unsafe, it is unbounded. Each level projects
 * its own snippet from its child's literal, so the snippet of a two-level
 * specimen contains a specimen, and nothing in the shape stops the nesting. One
 * level is the whole feature; the second is a recursion with no reader.
 *
 * The refusal itself lives in the leaf module `specimen-refusal.ts` and is
 * applied to the union in `component-types/index.ts` — see both for why. It
 * names its two write-path literals directly rather than importing the
 * catalogue's list, so a decode-time safety property cannot go quiet because an
 * import moved. Where the two disagree, the stricter wins.
 *
 * ─── `component` IS INJECTED, NOT DECLARED HERE ──────────────────────────
 *
 * The field this type exists for is not in the bag below. It holds a COMPONENT,
 * and the only place a component union can be built is the component-type
 * barrel, so the barrel injects it into this branch exactly as it injects
 * `children` into a container branch. Importing a union back from there closes
 * a cycle that throws `Cannot access 'SpecimenTypeLiteral' before
 * initialization` whenever the specialty barrel is entered first — which
 * `catalog.ts` does. See `component-types/index.ts` for the full account and
 * for the refusal the injected schema carries.
 *
 * ─── `annotations` LABEL PARTS, NOT PIXELS ────────────────────────────────
 *
 * Each entry names a PART of the drawn component — the same part vocabulary
 * `design.components` uses — so an anatomy diagram and a styling override speak
 * the same words. A coordinate-based callout would drift the moment the
 * component reflowed, and would teach a reader a vocabulary they cannot use
 * anywhere else.
 *
 * ─── `subject` NAMES A TYPE WHERE `component` WRITES ONE OUT ──────────────
 *
 * `component` holds a LITERAL, which is what makes the snippet honest — but it
 * also means one declaration draws one type. A per-type kit route
 * (`/ui-kit/:type`) needs ninety pages of otherwise identical config, or one
 * page whose subject comes from the route, and there is no `$param`
 * substitution into a component's `type` because a component's `type` is the
 * discriminant the union decodes on.
 *
 * So a specimen may instead NAME its subject, and the engine draws its own
 * catalogue specimen for that type — the row `GET /api/admin/design-system/
 * specimen-rows` already serves, with the illustrative props each type needs to
 * be a specimen OF something. A `select` with no options renders an empty box;
 * the catalogue is where the knowledge of that lives, and re-deriving it per
 * page is how a kit ends up documenting markup the app does not emit.
 *
 * The two are MUTUALLY EXCLUSIVE and one is required. Both answer "what is
 * drawn", and there is no defensible precedence: a page declaring both would
 * show one and silently discard the other, including its snippet. Neither can
 * be stated at the field level — `component` is injected by the barrel and
 * `subject` is declared here, so no single node sees both — so the rule lives
 * in `src/domain/models/app/design-console-component-validation.ts`.
 *
 * ─── OR FROM THE ROW, WHERE THERE IS ONE ─────────────────────────────────
 *
 * `$record.<field>` names a column of the row the specimen is expanded from, so
 * a card index over `GET /api/admin/schema/component-types` draws each row's own
 * type from ONE declaration — the same trade the routed form makes, one axis
 * over. It requires a record-binding ancestor, which is checked at boot by
 * family 14 of `page-binding-validation.ts`; the resolved value is checked at
 * ROW-EXPANSION time, and an undrawable one renders that row's refusal rather
 * than 404ing the page around the ten rows that were fine.
 *
 * It is a STRUCT rather than a bare string for two reasons. A bare
 * `subject: 'button'` is indistinguishable from a caption at a glance, and the
 * engine's own catalogue already distinguishes a type from its variants and its
 * states — so the struct leaves room to name one later without a second field
 * appearing beside an unrelated string.
 *
 * Source: [internal ref]
 * Specs: [internal ref] … 007, 013 … 016
 */
export const SpecimenTypeLiteral = Schema.Literal('specimen')

/**
 * One callout on the drawn component.
 *
 * `part` and `label` are both required: a callout with no part points at
 * nothing, and a callout with no label says nothing.
 */
const SpecimenAnnotationSchema = Schema.Struct({
  part: Schema.String.pipe(
    Schema.annotate({
      title: 'Component Part',
      description:
        "Name of the part being labelled — the SAME vocabulary `design.components` uses, so anatomy and styling speak one language. `root` on every type, plus that type's own inner elements.",
      examples: ['root', 'label', 'icon'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  label: Schema.String.pipe(
    Schema.annotate({
      title: 'Callout',
      description: 'What this part is, in the words a reader needs',
    }),
    Schema.check(Schema.isMinLength(1))
  ),
}).annotate({
  identifier: 'SpecimenAnnotation',
  title: 'Specimen Annotation',
  description: 'A callout naming one part of the drawn component',
})

/**
 * The subject a specimen draws when it names a type instead of writing one out.
 *
 * `type` is a plain refined string rather than a union of the ninety catalogued
 * literals, and that is a measured choice rather than a shortcut. The union
 * cannot be referenced from here at all — it is built in the component-type
 * barrel, and importing it back closes the cycle documented above — and it would
 * buy nothing where it matters, because the embedded config-type declaration
 * types a page component as `any` (TS7056), so a `.ts` config gets no
 * autocomplete for it either way. Inlining ninety literals into the published
 * JSON Schema for that is a cost with no return.
 *
 * The membership test happens instead where the catalogue IS reachable, in
 * `design-console-component-validation.ts`, which can also say WHICH type was
 * meant and why it was refused — a union member mismatch cannot.
 */
/** One axis value a subject may name, in the two deferred forms and the literal. */
const axisField = (title: string, description: string, examples: readonly string[]) =>
  Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({ title, description, examples: [...examples] })
    )
  )

const SpecimenSubjectSchema = Schema.Struct({
  type: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Subject Type',
        description:
          'The component type to draw, using the engine’s own catalogue specimen for it. A catalogued type name; `$param.<name>` naming a segment of the host page’s path; or `$record.<field>` naming a column of the row this specimen is expanded from, which requires a record-binding ancestor. Mutually exclusive with `component`.',
        examples: ['button', '$param.type', '$record.type'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * The operator's OWN reusable template to draw, named from `components[]`.
   *
   * ─── A THIRD VOCABULARY, AND WHY IT IS NOT A FOURTH COMPONENT TYPE ───────
   *
   * `type` names something the ENGINE can draw and `component` names something
   * the OPERATOR declared. Both answer "draw one thing and print the config
   * that produced it", which is what `specimen` is; both want the same frame,
   * the same `showSnippet`, the same `annotations` part vocabulary and the same
   * `showProvenance` badges. A separate component type would duplicate every
   * one of them to change which registry the name is looked up in.
   *
   * That is the opposite of the `field-specimen` decision, and deliberately so.
   * A FIELD type has no component, no config literal, no variant axis and no
   * state vocabulary, so it shared nothing with `specimen` but the word
   * "specimen". A named template shares everything but the lookup.
   *
   * ─── IT IS LOOKED UP IN THE SCOPED APP FIRST ─────────────────────────────
   *
   * On an ordinary page the name resolves against that app's own
   * `components[]`, which is what makes this a platform primitive rather than
   * console furniture: "show my readers what my `site-header` looks like, on
   * its own" is documentation any app might want.
   *
   * Under the admin console the host app is the PRESET and the templates being
   * documented are the operator's, so the lookup prefers the design-system
   * scope — the confidentiality-filtered operator `App` the mount already
   * attaches for the CSS candidate sweep. Nothing new is carried: the scope
   * exists, and it already holds `components[]` and `languages`.
   *
   * That second half is what `$t:` resolution turns on. A template whose text
   * comes from a lookup must resolve against the OPERATOR's catalogue while the
   * console chrome around it stays in its own language — one subtree, one
   * catalogue, decided at the node rather than at the page.
   */
  component: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Subject Template',
        description:
          'A reusable template from `components[]` to draw on its own, by name — the operator’s own component rather than an engine type. Under an admin mount the name resolves against the documented app’s templates. Mutually exclusive with `type`.',
        examples: ['site-header', '$record.name'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * The variant to draw the subject IN.
   *
   * A variant matrix is seven variants by three sizes — twenty-one cells — and
   * writing them out is the ninety-page problem one level down. So the axis is
   * named beside the type, and one declaration draws one cell per row.
   *
   * A LITERAL must name a member of that type's own axis, checked at boot where
   * the introspector is reachable. A `$record.` or `$param.` reference defers
   * that test to row expansion, for the reason `type` already does: the value
   * is a row fact or a URL segment, not a config fact.
   */
  variant: axisField(
    'Subject Variant',
    'The variant to draw the subject in. A member of that type’s own variant axis, or a `$record.`/`$param.` reference resolved per row.',
    ['destructive', '$record.value']
  ),
  /** The size to draw the subject in, on the same terms as `variant`. */
  size: axisField(
    'Subject Size',
    'The size to draw the subject in. A member of that type’s own size axis, or a `$record.`/`$param.` reference resolved per row.',
    ['sm', '$record.value']
  ),
  /**
   * The state to draw the subject in.
   *
   * Checked against the CATEGORY's vocabulary rather than the type's, because
   * that is where states are declared — and ten of the twelve categories draw
   * none, so naming one there is refused rather than silently ignored.
   */
  state: axisField(
    'Subject State',
    'The state to draw the subject in — a state its CATEGORY draws. A `rendered` state is reached through a real attribute; a `depicted` one is painted, because a browser pseudo-class cannot be forced from markup.',
    ['disabled', 'hover', '$record.state']
  ),
}).annotate({
  identifier: 'SpecimenSubject',
  title: 'Specimen Subject',
  description:
    'A component type the engine draws its own catalogue specimen for — the alternative to writing the component out',
})

/**
 * The viewport a specimen is RE-RENDERED at, in its own document.
 *
 * ─── A WIDTH ON A CONTAINER IS NOT A VIEWPORT, AND THAT IS THE WHOLE BUG ──
 *
 * A specimen drawn inline sits in the host page's document, so every
 * `@media (min-width: …)` in it answers the BROWSER viewport. Put that specimen
 * in a 375px-wide `div` and the markup narrows while the media queries keep
 * reporting the reader's 1440px screen: the component squeezes sideways and
 * overflows instead of collapsing to the layout it actually has at 375.
 *
 * Measured on the console's own Components page before this field existed: a
 * `site-header` declaring `hidden lg:flex` for its desktop cluster and
 * `lg:hidden` for its mobile disclosure computed `display: flex` and
 * `display: none` in ALL THREE of the Desktop, Tablet and Mobile frames, and
 * the 375 frame overflowed its box by 236px. Three frames, one layout — which
 * is worse than drawing one, because it answers the reader's question wrongly
 * rather than leaving it open.
 *
 * A `@media` query has exactly one input, and nothing in a document can change
 * it. So the only way to render a component AT a width is to give it a document
 * whose viewport IS that width — which is what an `<iframe>` of that width is.
 *
 * ─── IT IS A FRAME, NOT A SECOND HOST ─────────────────────────────────────
 *
 * The console's `/preview/...` routes were retired in 2026-09-03 precisely
 * because a second host for the same content is a second place for the scheme,
 * the rail and the specimen bounds to disagree. That ruling is not reversed
 * here and this field must not be used to reverse it: what it declares is the
 * INSIDE of a frame, not a destination. The framed document is reachable only
 * as an `<iframe>` source, is linked from nothing, carries no rail, no chrome
 * and no navigation, and is embeddable only by its own origin.
 *
 * The scheme is the one axis that genuinely spans the boundary, and it is the
 * class of defect `[internal ref]` exists for. The framed document
 * therefore resolves light/dark from the SAME two inputs in the SAME precedence
 * the hosting document does — an explicit `?scheme=` beats a stored preference,
 * a stored preference wins when nothing is asked for — so the two cannot
 * diverge. Same origin is what makes that free rather than coordinated: one
 * `localStorage`, read twice.
 *
 * ─── WHY A STRUCT WITH ONE MEMBER ─────────────────────────────────────────
 *
 * The same reason `subject` is one: a bare `viewport: 375` is indistinguishable
 * from a count at a glance, and a struct leaves room for a second axis — a
 * height, a device pixel ratio — without an unrelated scalar appearing beside
 * it. Height is deliberately absent for now: a frame sizes to its content, so a
 * declared height could only clip it, and a clipped specimen shows the top-left
 * corner of a component and calls it the component.
 *
 * ─── IT REQUIRES `subject.component` ──────────────────────────────────────
 *
 * A framed re-render is only worth its document where the subject HAS a layout
 * that changes with width, and that is the operator's own composed template —
 * a header, a footer, a hero. An engine catalogue specimen is one control drawn
 * from illustrative props; framing a `button` at 375 costs a document and shows
 * the same button. So the pairing is refused rather than drawn, in
 * `design-console-component-validation.ts` where the other subject rules live
 * and where the message can say which subject was meant. Widening it later to
 * `subject.type` is additive; shipping it wide and narrowing it would not be.
 */
const SpecimenViewportSchema = Schema.Struct({
  width: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))).annotate({
    title: 'Viewport Width',
    description:
      'The CSS pixel width of the document the specimen is re-rendered in. This is a real viewport, so the subject’s own media queries evaluate against it — a subject declaring `lg:` rules collapses below 1024 here exactly as it does in a browser window of this width.',
    examples: [1280, 768, 375],
  }),
}).annotate({
  identifier: 'SpecimenViewport',
  title: 'Specimen Viewport',
  description: 'The viewport a specimen is re-rendered at, in a document of its own',
})

export const specimenFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /**
   * The type to draw, when the specimen names its subject rather than writing
   * it out. Mutually exclusive with the injected `component`; exactly one is
   * required.
   */
  subject: Schema.optional(SpecimenSubjectSchema),
  /**
   * Re-render the subject in a document of its own, at this viewport.
   *
   * Omitted — the default and the shape every existing specimen keeps — the
   * subject is drawn inline in the host document, and its media queries answer
   * the reader's browser. Declared, it gets a real viewport of the stated width.
   * Requires `subject.component`.
   */
  viewport: Schema.optional(SpecimenViewportSchema),
  /** Callouts naming the parts of the drawn component. */
  annotations: Schema.optional(
    Schema.Array(SpecimenAnnotationSchema).annotate({
      title: 'Anatomy',
      description: 'Callouts naming the parts of the drawn component',
      examples: [[{ part: 'root', label: 'The button itself' }]],
    })
  ),
  /** Show the config literal that produced the drawing. */
  showSnippet: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Show the config literal beside the drawing, projected from the same declaration so the two cannot drift',
    })
  ),
  /** Show, per part, which layer put each class on the element. */
  showProvenance: Schema.optional(
    Schema.Boolean.annotate({
      description:
        "Show per-part badges naming which layer contributed each class — Sovrium's recipe, your `design.components` block, or the locked accessibility floor",
    })
  ),
} as const
