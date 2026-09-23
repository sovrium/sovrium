/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Imagery and iconography — how the app LOOKS in the places tokens cannot
 * reach.
 *
 * ## The gap this closes
 *
 * Colour, type and spacing are tokens: an author who gets them wrong produces a
 * page that is visibly off, and the design system catches it. Imagery is the
 * opposite. Two pages can use identical tokens and still look like two
 * different products, because one chose a stock photograph of people pointing
 * at a whiteboard and the other chose a screenshot of the running app. Nothing
 * in the schema had anything to say about that choice.
 *
 * Every serious brand charter has this section, and it is almost entirely
 * PROSE — which is exactly why it never made it into a config: there was no
 * token to hang it on. `design.principles` proved the shape works (a list of
 * sentences an agent can hold in mind), and this is the same move applied to
 * the visual register rather than the design one.
 *
 * ## Why four separate lists and not one
 *
 * They answer four different questions, and an author reaching for one is
 * rarely reaching for another:
 *
 * - `principles` — the register. *What should an image DO here?*
 * - `photography` — the concrete rules. *What may I shoot, and how?*
 * - `iconSet` — the single decision that stops icon drift dead.
 * - `patterns` — the non-photographic marks: textures, illustrations, grain.
 *
 * Collapsing them into one list would produce a bag of sentences with no
 * retrievable structure, which is what `BRAND.md` prose already is. The point
 * of moving it into the schema is that a consumer can render the photography
 * rules beside a photograph and the icon rule beside an icon.
 *
 * ## Deliberately no asset references here
 *
 * Unlike `design.logo`, nothing in this key names a FILE. That is a decision,
 * not an omission. A logo is one specific artifact with one URL; imagery is a
 * class of artifact with rules, and the images themselves live in pages, in
 * records and in buckets — declared where they are used. A `patterns: ['/img/grain.avif']`
 * field would look like it did something and would in fact be a second,
 * unrendered copy of an asset list that already exists elsewhere, going stale
 * the moment either side changed. `iconSet` names a SET, not a file, for the
 * same reason.
 *
 * The one asset rule worth stating here, because it is where imagery actually
 * breaks: a committed raster asset is **AVIF** (`check-image-format-drift`
 * enforces it), the runtime `file.transformImage` pipeline emits **WebP**, and
 * social-card images are neither — crawlers do not reliably render AVIF, so
 * `openGraph`/`twitter` images stay PNG or JPEG. Three answers, three
 * different reasons, and a rule stated in `patterns` prose is where an author
 * is most likely to read it.
 */

const nonEmptyRule = (subject: string) =>
  Schema.String.pipe(
    Schema.check(Schema.isMinLength(1, { message: `${subject} must not be empty` }))
  )

/**
 * A non-empty rule line that describes ITSELF, for use as an array element.
 *
 * Separate from `nonEmptyRule` rather than an optional second parameter on it,
 * and the reason is a type erasure rather than taste. Spreading a conditional
 * `[] | [annotate]` into `pipe` gives the spread no tuple type, so `pipe`
 * matches none of its arity overloads and the whole schema resolves to
 * `Schema<never>` — which type-checks at the declaration and then rejects every
 * real `string[]` a config writes into `principles`, `photography` or
 * `patterns`. Two concrete pipe shapes cost one extra function and cannot do
 * that.
 *
 * The annotation goes BEFORE the check so it lands on the schema node itself.
 * Piped AFTER a check it ends up inside `allOf` — reachable in the published
 * JSON Schema but off the node an option table walks, which is why these
 * element rows rendered with an empty Description cell. `iconSet` keeps the
 * plain helper because it carries its own annotation at the call site.
 */
const describedRule = (subject: string, description: string) =>
  Schema.String.pipe(
    Schema.annotate({ description }),
    Schema.check(Schema.isMinLength(1, { message: `${subject} must not be empty` }))
  )

/**
 * The app's imagery and iconography rules.
 *
 * Every field optional: an app with a considered photography policy and no
 * illustration system is a real and common state, and requiring the full set
 * would invite placeholder entries — which reach the generated charter as
 * confident-sounding sentences nobody meant.
 */
export const ImagerySchema = Schema.Struct({
  /**
   * The register images work in, as convictions rather than instructions.
   *
   * The imagery counterpart of `design.principles`, and read the same way: an
   * agent choosing an image is handed the reasoning, not a checklist.
   */
  principles: Schema.optional(
    Schema.Array(
      describedRule('An imagery principle', 'One conviction about what an image is for here')
    ).pipe(
      Schema.annotate({
        title: 'Imagery Principles',
        description: 'What an image is FOR in this app, stated as convictions',
        examples: [
          [
            'Show the product working, never a metaphor for it.',
            'A person in an image is doing their job, not posing.',
          ],
        ],
      })
    )
  ),

  /**
   * Concrete photography rules — the ones a person actually applies while
   * choosing or shooting.
   *
   * Separate from `principles` because a principle is a standard to judge
   * against and this is a constraint to obey. "Show the product working" is a
   * principle; "no stock photography, ever" is a rule, and conflating them
   * makes the rule sound negotiable.
   */
  photography: Schema.optional(
    Schema.Array(
      describedRule('A photography rule', 'One rule about what may be photographed, and how')
    ).pipe(
      Schema.annotate({
        title: 'Photography Rules',
        description: 'What may be photographed, and how it must be treated',
        examples: [
          [
            'No stock photography.',
            'Natural light only — no studio gels, no colour grading toward a brand hue.',
            'Screenshots are captured at 2x on a neutral background.',
          ],
        ],
      })
    )
  ),

  /**
   * The ONE icon set the app draws from, by name.
   *
   * A single string, deliberately, and it is the highest-leverage field in this
   * module. Icon drift is not caused by an author choosing a bad icon — it is
   * caused by three authors each choosing a *reasonable* icon from three
   * different sets, after which no amount of token discipline makes the toolbar
   * look like one product. Naming the set once removes the decision.
   *
   * A NAME rather than a URL or a package: what a reader needs is "which set
   * do I search", and a version-pinned package specifier answers a different
   * question that goes stale on every bump.
   */
  iconSet: Schema.optional(
    nonEmptyRule('An `iconSet`').pipe(
      Schema.annotate({
        title: 'Icon Set',
        description: 'Name of the single icon set every icon in the app is drawn from',
        examples: ['Lucide', 'Phosphor (regular weight)'],
      })
    )
  ),

  /**
   * Non-photographic visual marks: textures, grain, illustration style,
   * background geometry.
   *
   * The section that keeps a brand recognisable when there is no photograph and
   * no icon on the screen — which is most of an application's surface area.
   *
   * Prose, not asset paths. See the module header for why nothing in this key
   * names a file.
   */
  patterns: Schema.optional(
    Schema.Array(
      describedRule(
        'A pattern rule',
        'One rule about texture, illustration style or background geometry'
      )
    ).pipe(
      Schema.annotate({
        title: 'Patterns and Textures',
        description:
          'Non-photographic visual marks: texture, illustration style, background geometry',
        examples: [
          [
            'A single paper-grain texture at 4% opacity, never more than one surface per screen.',
            'Illustrations are single-weight line art in the signature colour, never filled.',
          ],
        ],
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'Imagery',
    title: 'Imagery and Iconography',
    description:
      'How the app looks where tokens cannot reach: the register images work in, the rules for photography, the one icon set, and the non-photographic marks.',
    examples: [
      {
        principles: ['Show the product working, never a metaphor for it.'],
        photography: ['No stock photography.', 'Natural light only.'],
        iconSet: 'Lucide',
        patterns: ['A single paper-grain texture at 4% opacity.'],
      },
    ],
  })
)

/** @public */
export type Imagery = Schema.Schema.Type<typeof ImagerySchema>
