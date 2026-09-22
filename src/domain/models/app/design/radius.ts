/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { guardedKeyRecord } from './token-value-schemas'

/**
 * The SHAPE foundation: corner radii, by name.
 *
 * ## Why `radius` and not `borderRadius`
 *
 * `borderRadius` named a CSS PROPERTY; every foundation key names a design
 * PURPOSE. Radius is the purpose — it is what a design system means when it
 * says "our shape language is square". The old name also sorted the key away
 * from its siblings alphabetically and read as a leftover from the era when
 * design tokens were a Tailwind config transcription rather than a design
 * system.
 *
 * ## The VALUE grammar is wide; the KEY grammar is enforced
 *
 * The value is any CSS string, including `9999px`, `50%` and `min(1rem, 5%)`,
 * all of which real configs use. Tightening it to the `DIMENSION_PATTERN` the
 * ladders use would refuse two of those three.
 *
 * The KEY grammar — kebab-case — is asserted at the RECORD level rather than as
 * a key schema, because Effect v4 silently DROPS a key-schema failure. Measured
 * on `4.0.0-rc.108`, a record keyed `Rounded` decoded to `{}` with no error and
 * no radius. Here it is refused by name. See `guardedKeyRecord`.
 *
 * ## `DEFAULT` is refused, and why it is refused rather than left alone
 *
 * `DEFAULT` was the one reserved key: it emitted the bare `--radius` variable
 * rather than `--radius-<name>`, mirroring Tailwind's convention that a scale
 * has an unsuffixed member. Measured 2026-09-10, NOTHING reads `var(--radius)`
 * anywhere in the engine, in either shipped app, or in any template — the
 * component recipes all spend named steps (`--radius-base`, `--radius-md`, …).
 * So an author who declared `radius.DEFAULT` got a variable emitted into the
 * stylesheet and no corner anywhere drawn from it.
 *
 * A silently inert key is worse than a refused one: it looks like a decision
 * that was made and is in fact a decision that went nowhere. It is refused by
 * NAME, pointing at `base` — the step the recipes actually spend as the
 * everyday corner — rather than by the generic key-grammar hint, which would
 * name the offence and leave the author to find the replacement themselves.
 */
/**
 * The refusal an author reaches by declaring the retired reserved key.
 *
 * Three properties, each of which a spec asserts: it names the OFFENDING key,
 * it names the REPLACEMENT, and it says why the old key was not merely renamed
 * — an author who is told to swap one spelling for another, with no reason,
 * reasonably assumes the two behave the same.
 */
const RADIUS_DEFAULT_RETIRED = [
  '`design.radius` declares `DEFAULT`, which is no longer a radius key.',
  '',
  'Use a named step instead — `base` is the everyday corner the component',
  'recipes spend. `DEFAULT` emitted the bare `--radius` variable, which nothing',
  'in the engine, the shipped apps or the templates ever read, so a corner',
  'declared there was never drawn.',
].join('\n')

export const DesignRadiusSchema = guardedKeyRecord(
  Schema.String.pipe(
    Schema.annotate({
      title: 'Border Radius Value',
      description: 'CSS border-radius value',
      examples: ['0', '0.125rem', '0.5rem', '9999px'],
    })
  ),
  {
    path: 'design.radius',
    pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/,
    keyHint: 'A radius name is kebab-case (lowercase letters, digits and hyphens).',
    keyTitle: 'Border Radius Key',
    keyExamples: ['none', 'sm', 'base', 'full'],
    retiredKeys: new Map([['DEFAULT', RADIUS_DEFAULT_RETIRED]]),
  }
).pipe(
  Schema.annotate({
    identifier: 'DesignRadius',
    title: 'Radius Scale',
    description: "The app's corner-radius scale, keyed by name.",
    examples: [{ none: '0', sm: '0.125rem', base: '0.25rem', full: '9999px' }],
  })
)

/** @public */
export type DesignRadius = Schema.Schema.Type<typeof DesignRadiusSchema>
