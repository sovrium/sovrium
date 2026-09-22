/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The declarations that VALIDATE and then reach nothing, and the notice that
 * says where their value now takes effect.
 *
 * ## Why this survived [internal ref]
 *
 * It used to live in `design-normalization.ts`, beside the mirror that made the
 * two token positions agree — not because the two were related, but because
 * both ran at the decode boundary. [internal ref] deleted that module with the alias,
 * and this went with it by accident: an unrelated, still-true diagnostic
 * silently lost because it shared a file with something else.
 *
 * It has its own file now, so the next thing to be deleted for its own reasons
 * cannot take it along.
 *
 * ## Superseded, not deprecated
 *
 * The distinction is load-bearing and is the same one the design-system
 * export's `inert` bucket argues: **"deprecated" means this worked and is going
 * away.** These three never worked. Calling them deprecated would tell the
 * author their app renders differently today than it will later, which is false
 * in both directions.
 *
 * `families.*.lineHeight` never reached anything. `families.*.size` and
 * `.weights` had exactly one reader — the `hero` section renderer — and that
 * type has been withdrawn. Neither ever became a CSS variable, and `weights`
 * never reached an `@font-face` rule, so `weights: [300, 400, 700]` loads no
 * additional face.
 *
 * They keep decoding. Refusing them would take an app that boots and stop it
 * booting in exchange for **zero** rendering change — punishing the author for a
 * defect that was Sovrium's. `design.typeScale.steps` is where each of the three
 * quantities takes effect, and the notice says so: a notice that names a dead
 * field and not its replacement is a complaint, not guidance.
 */

/** The projection this reads. Deliberately not `App` — see `design-validation.ts`. */
interface SupersededNoticeInput {
  readonly design?: {
    readonly typeScale?: {
      readonly families?: Readonly<Record<string, Readonly<Record<string, unknown>> | undefined>>
    }
  }
}

const SUPERSEDED_FONT_FIELDS = ['size', 'lineHeight', 'weights'] as const

/** Every declared face field whose value reaches nothing, by its config path. */
const supersededFontPaths = (app: SupersededNoticeInput): readonly string[] =>
  Object.entries(app.design?.typeScale?.families ?? {}).flatMap(([category, face]) =>
    SUPERSEDED_FONT_FIELDS.flatMap((field) =>
      face?.[field] === undefined ? [] : [`design.typeScale.families.${category}.${field}`]
    )
  )

/**
 * The non-fatal notices a decoded config earns, or an empty list.
 *
 * Rendered on **stderr** by `sovrium validate`, before a `0` exit: a notice
 * must never fail a deploy gate, and a caller piping stdout still reads exactly
 * one clean success line.
 *
 * @param app - A decoded app config
 */
export const collectSupersededDesignNotices = (app: SupersededNoticeInput): readonly string[] => {
  const paths = supersededFontPaths(app)
  if (paths.length === 0) return []
  return [
    `Superseded: ${paths.join(', ')} — declared and validated, but no renderer reads any of them. ` +
      'Declare the size, leading and weight of a text role under `design.typeScale.steps`, where ' +
      'each one emits a real CSS custom property and a usable `text-{step}` utility.',
  ]
}
