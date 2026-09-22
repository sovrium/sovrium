/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { RampValueSchema } from './ramps'

/**
 * A role's value in one colour scheme.
 *
 * Almost always a ramp REFERENCE (`neutral-950`), because that is what a role
 * IS: a name for a position in a ladder, so retuning the ladder retunes every
 * role that follows it. A literal is admitted for the handful that cannot
 * follow one — the default palette has a few, and refusing them would push
 * those back out of the schema.
 *
 * The `var()` chains the emitted CSS carries are DERIVED from these references
 * by the generator. They are never authored: a `var()` in a config resolves
 * against the cascade, so nothing that reads the config could say what colour
 * it names. See `ColorValueSchema` and [internal ref].
 */
const RoleValueSchema = RampValueSchema.pipe(
  Schema.annotate({
    title: 'Role Value',
    description: 'The ramp step this role follows, or a colour literal',
    examples: ['neutral-950', 'oklch(0.56 0.12 250)'],
  })
)

/**
 * Usage guidance and value for ONE colour role.
 *
 * `theme.colors` is an open record of name → CSS value. `primary: '#123456'`
 * tells a renderer everything and an author nothing: there is no place in the
 * schema to say that this token is the CTA fill and must never carry body text,
 * or that a status pill must never be painted with it. That absence is why an
 * agent composing a page picks a token by feel.
 *
 * Both fields are optional so a partial answer is expressible. Declaring a role
 * with `usage` and no `pairsWith` is a real and common state — most accents
 * have a stated purpose and no fixed foreground companion.
 */
export const ColorRoleSchema = Schema.Struct({
  /**
   * What the token is FOR, and — more usefully — what it is not for.
   *
   * `'Primary CTA fill only. Never body text, never a status pill.'`
   */
  usage: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1, { message: 'Colour role usage must not be empty' })),
      Schema.annotate({
        description: 'What this colour is for, and what it must not be used for',
        examples: ['Primary CTA fill only. Never body text, never a status pill.'],
      })
    )
  ),

  /**
   * The token name this one is designed to sit against — normally its
   * foreground companion.
   *
   * A NAME, not a value, because the pairing is what carries the contrast
   * guarantee: `primary` / `primary-fg` were tuned together, and an author who
   * reads the pair does not have to re-measure the ratio.
   *
   * An OPEN string, and deliberately NOT cross-validated against
   * `design.colors` (unlike the record's own keys). A legitimate
   * companion is very often a PLATFORM role token the app never redeclared —
   * `foreground`, `background` — so requiring it to resolve against the
   * author's palette would refuse correct configs. It is also why this does not
   * reuse `ColorNameSchema` from the theme model: nothing here needs the
   * kebab-case refinement, and a hand-copied duplicate of that regex would be a
   * second definition to keep in sync, which is the exact drift this whole key
   * exists to remove.
   */
  pairsWith: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1, { message: 'Colour role `pairsWith` must not be empty' })),
      Schema.annotate({
        description:
          'Name of the token this colour is designed to sit against (usually its foreground companion). May name a platform role token the app never redeclared.',
        examples: ['primary-fg', 'foreground'],
      })
    )
  ),

  /**
   * What the role RESOLVES TO in the light scheme.
   *
   * Declaring it turns the entry from documentation into a definition: a role
   * with a `value` DEFINES the token, so it need not already exist in
   * `design.colors` (see rule 2 in `design-validation.ts`). A role with
   * prose and no value still must name a declared palette token, because
   * guidance attached to a token that does not exist renders nowhere.
   *
   * This is the home the 40 `ROLE_TOKEN_BRIDGE` declarations of the default
   * palette need. Without it, `DesignSchema` can hold the ramps and not the
   * roles that point at them — half a palette, which is worse than none,
   * because the half that is missing is the half every surface actually reads.
   */
  value: Schema.optional(RoleValueSchema),

  /**
   * The role's value under the dark scheme, when it differs.
   *
   * A separate field rather than a second `colorRoles` block, because a role's
   * two values are ONE decision: `bg` is `neutral-50` in light and
   * `neutral-950` in dark, and that pairing is the thing a reader needs to see
   * at once. Two parallel maps keyed by the same names would let one drift out
   * of the other silently.
   *
   * Absent means "same in both schemes", which is the common case: the default
   * palette re-points roughly a third of its roles in dark and inherits the
   * rest.
   */
  dark: Schema.optional(RoleValueSchema),
}).pipe(
  Schema.annotate({
    identifier: 'ColorRole',
    title: 'Colour Role',
    description:
      'One colour role: what it resolves to in each scheme, what it is for, and what it pairs with',
    examples: [
      {
        value: 'neutral-50',
        dark: 'neutral-950',
        usage: 'Primary CTA fill only. Never body text.',
        pairsWith: 'primary-fg',
      },
    ],
  })
)

/**
 * The record KEY is plain `Schema.String`, deliberately — not `ColorNameSchema`.
 *
 * Effect v4's `Schema.Record` **silently DROPS** an entry whose key fails the
 * key schema. Measured, not assumed: decoding `{ primary: {…}, Primary: {…} }`
 * against a `ColorNameSchema`-keyed record yields `{ primary: {…} }` with no
 * error, under every option combination including `onExcessProperty: 'error'`
 * and `errors: 'all'`. (Value failures still throw; only key failures vanish.)
 *
 * For a guidance record that is the worst possible outcome. An author writing
 * `Primary:` or `primaryForeground:` would get `Valid configuration`, ship, and
 * find their guidance simply absent — with nothing anywhere naming the key that
 * disappeared. A pattern check that deletes its own evidence is worse than no
 * check.
 *
 * So the key stays open here and the shape is enforced one level up, in
 * `design-validation.ts`, where a bad key SURVIVES to be named in the error.
 * Nothing is lost: that rule requires the key to resolve to a token actually
 * declared in the palette, which is strictly stronger than matching a
 * kebab-case pattern, and it reports `Primary` by name alongside the tokens
 * that do exist.
 */
const ColorRoleKeySchema = Schema.String.annotate({
  title: 'Colour Name',
  description:
    'Name of a colour token declared in the theme palette (kebab-case). Validated against the declared palette at decode time.',
  examples: ['primary', 'primary-hover', 'error'],
})

/**
 * Usage guidance keyed by colour-token name.
 *
 * Keys are cross-validated against `design.colors` at decode time (see
 * `src/domain/models/app/design-validation.ts`): a role documenting a token
 * that does not exist is guidance nobody can act on, and it is almost always a
 * typo in the token name rather than a deliberate placeholder.
 */
export const ColorRolesSchema = Schema.Record(ColorRoleKeySchema, ColorRoleSchema).pipe(
  Schema.annotate({
    identifier: 'ColorRoles',
    title: 'Colour Roles',
    description:
      "Per-token usage guidance keyed by colour name. Answers the question `theme.colors` cannot: what is this colour FOR? Every key must name a token declared in the app's palette.",
    examples: [
      {
        primary: { usage: 'Primary CTA fill only. Never body text.', pairsWith: 'primary-fg' },
        error: { usage: 'The only hue in the system. Reserved for failure states.' },
      },
    ],
  })
)

/** @public */
export type ColorRole = Schema.Schema.Type<typeof ColorRoleSchema>
/** @public */
export type ColorRoles = Schema.Schema.Type<typeof ColorRolesSchema>
