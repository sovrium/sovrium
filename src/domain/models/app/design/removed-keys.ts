/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The design keys that were REMOVED, and where each one's value now lives.
 *
 * ## Why a table rather than an alias
 *
 * [internal ref] deletes the token block instead of aliasing it. That is the right
 * trade only if the author is TOLD where the value went: a bare
 * `Unknown property 'theme'` names the offence and not the remedy, and sends a
 * reader to the published schema to work out that `borderRadius` is now
 * `radius`. So the removal ships with its own migration message.
 *
 * ## Why it lives in the domain, and what it may import
 *
 * The consumer is `excess-property-report.ts`, which runs on a decode failure —
 * the one moment the config object is known to be unusable. It imports exactly
 * one thing, `TYPE_SCALE_STEPS`, and only because a hand-listed copy of the
 * rungs would silently stop covering a rung added later. Everything else here
 * is a string about a string, checked against the real schema by the refusal
 * specs rather than by a type.
 *
 * ## What a message has to do
 *
 * Three properties, each of which is a spec:
 *
 * 1. it names the DESTINATION key, not just the offence;
 * 2. it fires on the FIRST offending key and does not require the rest of the
 *    config to be valid;
 * 3. it reaches every decode seam — boot, `sovrium validate`, the
 *    `design-system` command and the `--watch` reload loop — which it does by
 *    riding the one shared decode boundary rather than by being installed four
 *    times.
 *
 * The watch loop is the reason to spend care on the wording: an author saving
 * an old config under `sovrium start --watch` sees this text in the dev
 * journal, live, at the moment they can act on it.
 */

import { TYPE_SCALE_STEPS } from './type-scale'

/**
 * Where every member of the removed token block now lives, one per line.
 *
 * A line each rather than one long sentence, because the reader is holding a
 * config open beside the message and is looking for ONE of these — a paragraph
 * makes them read the other eleven to find it.
 */
const FLATTENED_MEMBERS: readonly string[] = [
  'colors        → `design.colors`',
  'darkColors    → `design.darkColors`',
  'fonts         → `design.typeScale.families`',
  'spacing       → `design.spacing`',
  'borderRadius  → `design.radius`',
  'shadows       → `design.elevation`',
  'breakpoints   → `design.breakpoints`',
  'colorScheme   → `design.colorScheme`',
  'baseline      → `design.baseline`',
  'codeBlock     → `design.codeBlock`',
  'animations    → `design.motion` — its reserved keys become members:',
  '                duration  → `design.motion.durations`',
  '                easing    → `design.motion.easings`',
  '                keyframes → `design.motion.keyframes`',
  '                every other entry → `design.motion.animations`',
]

const removedBlock = (spelling: string): string =>
  [`\`${spelling}\` has been removed. Its members are now direct keys of \`design\`:`, '']
    .concat(FLATTENED_MEMBERS)
    .join('\n')

const THEME_REMOVED = removedBlock('theme')

const DESIGN_THEME_REMOVED = removedBlock('design.theme')

const SCALES_REMOVED = [
  '`design.scales` has been removed and split:',
  '',
  'spacing   → `design.spacing`',
  'durations → `design.motion.durations`',
  'easings   → `design.motion.easings`',
  '',
  'fontSizes, fontWeights, lineHeights and letterSpacings have no replacement —',
  'a type decision belongs to a named rung under `design.typeScale.steps`.',
].join('\n')

/**
 * The rungs that used to be declarable flat on `design.typeScale`.
 *
 * Derived from the step Struct rather than hand-listed, so a rung added later
 * is covered by the refusal without anyone remembering to add it here.
 */
const TYPE_SCALE_RUNGS: ReadonlySet<string> = new Set(TYPE_SCALE_STEPS)

/**
 * The members of the removed token block, so an author who moved the block to
 * `design` but kept a CSS-property name is told which purpose key to use.
 */
const RENAMED_ON_DESIGN: ReadonlyMap<string, string> = new Map([
  [
    'borderRadius',
    '`borderRadius` is now `design.radius` — the key names the shape decision, not the CSS property.',
  ],
  [
    'shadows',
    '`shadows` is now `design.elevation` — the key names the level, not the box-shadow that renders it.',
  ],
  ['fonts', '`fonts` is now `design.typeScale.families`, beside the ladder of steps it sets.'],
  [
    'animations',
    '`animations` is now `design.motion.animations`, beside `durations`, `easings` and `keyframes`.',
  ],
])

/**
 * The migration message for a removed key at a given config path, or
 * `undefined` when this module has nothing to say about it.
 *
 * @param path - Dotted path of the NODE holding the key: `''` at the config
 *   root, `design`, `design.typeScale`. Array indices are tolerated but no
 *   removed key sits under one.
 * @param key - The property name the author wrote.
 */
export const migrationHintForRemovedKey = (path: string, key: string): string | undefined => {
  if (path === '' && key === 'theme') return THEME_REMOVED
  if (path === 'design') {
    if (key === 'theme') return DESIGN_THEME_REMOVED
    if (key === 'scales') return SCALES_REMOVED
    return RENAMED_ON_DESIGN.get(key)
  }
  if (path === 'design.typeScale' && TYPE_SCALE_RUNGS.has(key)) {
    return `\`design.typeScale.${key}\` is now \`design.typeScale.steps.${key}\`. Every rung lives under \`steps\`; \`families\` names the faces.`
  }
  return undefined
}
