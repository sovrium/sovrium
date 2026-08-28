/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Making the `theme` → `design.theme` alias REAL rather than aspirational.
 *
 * ## The problem this exists to solve
 *
 * `design.theme` is the canonical position and top-level `theme` is the
 * deprecated alias. But ~38 modules under `src/` read `app.theme` — the CSS
 * compiler among them — and every one of the ~50 component class recipes reads
 * it too. So without this step the alias would be a promise the binary does not
 * keep in EITHER direction:
 *
 * - an author writing only `design.theme` would get a config that validates
 *   and renders with no theme at all, because `compileCSS` reads `app.theme`
 *   and finds `undefined`;
 * - a consumer written against the canonical position (the design-system
 *   generator, next phase) would find nothing for the ~100% of shipped configs
 *   that still use the alias.
 *
 * Rewiring 38 readers is the repo-wide import churn this design explicitly
 * refuses. Normalizing once, at the single config-decode boundary, is one line
 * at one call site and leaves every reader untouched.
 *
 * ## Why it MIRRORS rather than moves
 *
 * Both positions end up populated with the same object. A one-directional
 * normalization would break one of the two audiences above no matter which
 * direction it chose. The two can never disagree because they are the same
 * reference, and they can never both be *authored* because
 * `validateAllDesignReferences` refuses that at decode time — so the mirror has
 * exactly one source and no merge to arbitrate.
 *
 * ## Why this is not the "quiet repair" the decode pipeline forbids
 *
 * `decode-app-config.ts` states that a config is *"either understood or
 * refused, never quietly repaired"*, and that rule is about ABSORBING legacy
 * SPELLINGS — reinterpreting what the author wrote. Nothing is reinterpreted
 * here: both keys are first-class, documented, and accepted spellings of the
 * same value at the same version, and the alias is announced to the author by
 * `collectDesignDeprecationNotices` on the surface where announcements belong.
 * Nothing is stripped, nothing changes meaning, and the operation is idempotent.
 *
 * ## Scope, honestly stated
 *
 * Only `theme` is mirrored. The other eight `design` keys (`typeScale`,
 * `logo`, `imagery`, `principles`, `voice`, `colorRoles`, `components`,
 * `zones`) are new: they have no legacy position to mirror from and no existing
 * reader to keep working. They are carried through untouched.
 *
 * `zones` is the one that looks like a counter-example and is not. It DID have
 * a prior home — the `**Zones**:` line in each app's `BRAND.md`, which now
 * points at `config/design.ts` instead of carrying the map — but that home was
 * a Markdown document outside the config, read only by a repository script.
 * There was never anything in the decoded config to mirror it from, and
 * normalizing across that file boundary would have meant the decoder reading
 * the repository. The migration was done in the apps' own config files by hand,
 * and compared against the prose for exactly one commit before it was retired.
 *
 * `typeScale` is the one worth naming explicitly, because it looks like a
 * counter-example and is not. It SUPERSEDES three `theme.fonts.*` fields, but
 * it does not mirror them: the shapes genuinely differ (per-STEP rather than
 * per-FACE, a unitless `lineHeight` ratio rather than a free string, one
 * `weight` rather than a `weights` array), so any automatic translation would
 * have to guess which face maps to which rung of the ladder. Guessing is the
 * "quiet repair" the decode pipeline forbids. The author is told instead —
 * see `collectDesignDeprecationNotices`.
 */

import type { App } from '.'

/** Whether a config declares the deprecated top-level `theme` key. */
const usesLegacyThemeKey = (app: Readonly<App>): boolean => app.theme !== undefined

/**
 * The three font fields `design.typeScale` supersedes.
 *
 * SUPERSEDED, NOT DEPRECATED, and the wording below is chosen with care:
 * "deprecated" means *this worked and is going away*, and these three never
 * worked. `theme.fonts.*.lineHeight` reaches nothing at all;
 * `theme.fonts.*.size` and `.weights` reach only the legacy `hero` section
 * renderer, as an inline size and as `weights[0]`, so neither becomes a CSS
 * variable and no extra `@font-face` is ever loaded.
 *
 * They keep decoding until the next major, when they go alongside the
 * top-level `theme` alias. Refusing them now would take an app that boots and
 * stop it booting in exchange for zero rendering change — punishing the author
 * for a defect that was Sovrium's, and doing it twice if the alias were
 * removed in a different release.
 */
const SUPERSEDED_FONT_FIELDS = ['size', 'lineHeight', 'weights'] as const

/**
 * Every `theme.fonts.{category}.{field}` path whose value reaches (almost)
 * nothing, across both authored theme positions.
 *
 * Reads BOTH positions because this runs at the same boundary as the mirror and
 * must not depend on whether it has already run — reading only the canonical
 * one would go silent for the ~100% of shipped configs still using the alias,
 * which are exactly the configs most likely to carry these fields.
 */
const collectSupersededFontPaths = (app: Readonly<App>): readonly string[] => {
  const fonts = app.design?.theme?.fonts ?? app.theme?.fonts
  return Object.entries(fonts ?? {}).flatMap(([category, font]) =>
    SUPERSEDED_FONT_FIELDS.flatMap((field) =>
      (font as Readonly<Record<string, unknown>>)[field] === undefined
        ? []
        : [`theme.fonts.${category}.${field}`]
    )
  )
}

/**
 * Populate BOTH theme positions from whichever one the author declared.
 *
 * Returns the input unchanged (same reference) when there is nothing to do:
 * no theme at all, or — impossible past validation, but cheap to be total
 * about — both already present.
 *
 * @param app - A decoded, validated app config
 * @returns The config with `theme` and `design.theme` both populated, or the input unchanged
 */
export const normalizeAppDesign = (app: Readonly<App>): App => {
  const legacyTheme = app.theme
  const canonicalTheme = app.design?.theme

  // Nothing declared, or both already present: no mirroring to do.
  if (legacyTheme === undefined && canonicalTheme === undefined) return app
  if (legacyTheme !== undefined && canonicalTheme !== undefined) return app

  // Alias → canonical. The design-system surfaces read `design.theme`.
  if (legacyTheme !== undefined) {
    return { ...app, design: { ...app.design, theme: legacyTheme } }
  }

  // Canonical → alias. The CSS compiler and every class recipe read `app.theme`.
  return { ...app, theme: canonicalTheme }
}

/**
 * Deprecation notices an entry point should surface to the author.
 *
 * A LIST, not a boolean, because this is the seam every future `design`
 * deprecation goes through, and a caller that renders a list needs no change
 * when the second one arrives.
 *
 * These are NOT errors and must never be printed as such: a config using the
 * alias is valid, ships, and will keep shipping until the next major. The
 * notice exists so the author learns about the canonical position from the tool
 * rather than from a release note.
 *
 * @param app - A decoded, validated app config
 * @returns Zero or more human-readable notices
 */
export const collectDesignDeprecationNotices = (app: Readonly<App>): readonly string[] => {
  const aliasNotice = usesLegacyThemeKey(app)
    ? [
        'Deprecated: top-level `theme` is an alias for `design.theme` and is removed at the next major. Move the block into `design: { theme: … }` — the contents are unchanged.',
      ]
    : []

  const supersededPaths = collectSupersededFontPaths(app)
  const supersededNotice =
    supersededPaths.length === 0
      ? []
      : [
          `Superseded: ${supersededPaths.join(', ')} ${supersededPaths.length === 1 ? 'is' : 'are'} declared but ${supersededPaths.length === 1 ? 'does' : 'do'} not reach the rendered app — \`size\` and \`weights\` are read only by the legacy \`hero\` section renderer, and \`lineHeight\` is read by nothing. Declare the values in \`design.typeScale\` instead, where each step emits real CSS (\`--text-{step}\` plus its \`--line-height\` / \`--font-weight\` / \`--letter-spacing\` modifiers, and a working \`text-{step}\` utility). These fields are removed at the next major.`,
        ]

  return [...aliasNotice, ...supersededNotice]
}
