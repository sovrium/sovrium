/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ColorRolesSchema } from './color-roles'
import { DesignComponentsSchema } from './components'
import { ImagerySchema } from './imagery'
import { LogoSchema } from './logo'
import { DesignPrinciplesSchema } from './principles'
import { DesignThemeSchema } from './theme'
import { TypeScaleSchema } from './type-scale'
import { VoiceSchema } from './voice'
import { DesignZonesSchema } from './zones'

/**
 * The app's design system, in one key.
 *
 * ## Why one key
 *
 * Sovrium reads a config file and becomes an app. The author declares `theme`
 * and composes pages from the component catalog — but nowhere can that author,
 * or an agent building on their behalf, see the resulting design system as a
 * single authoritative artifact. The consequence is drift: a page added next
 * month guesses at spacing, invents a hex, picks a heading level by feel.
 *
 * `theme` alone cannot close that, because three things a design system must
 * carry had **no home in the schema at all**:
 *
 * 1. **Principles** — why the tokens are what they are.
 * 2. **Voice and tone** — how the app SOUNDS. Verified absent: every
 *    `voice` / `tone` / `brand` hit under `src/domain/models/app/` before this
 *    key was unrelated to copy. This is the whole reason an AI cannot currently
 *    write on-brand copy for a Sovrium app.
 * 3. **Usage rules** — "when do I reach for `primary`?", "what is
 *    `section-header` for?". `theme.colors` is an open record with no
 *    semantics, and a `components[]` template carries a name and nothing a
 *    reader can act on.
 *
 * Today all three live as prose in `apps/{website,partner}/BRAND.md` §1, §3, §6
 * and §8 — human-readable, app-local, invisible to the running instance, and
 * unavailable to any customer who is not this repo.
 *
 * ## `theme` did not move
 *
 * `design.theme` is canonical, and top-level `theme` remains a supported alias:
 * it is shipped public contract in v0.22.2, `@sovrium/types`, the published
 * JSON Schema, 18 templates, both production apps and every customer config. A
 * hard removal would strand all of them for a rename.
 *
 * The two are **mutually exclusive** — declaring both is a decode-time error,
 * never a silent merge, because a silent merge has to pick a winner and any
 * choice it makes is invisible to the author who wrote the loser. See
 * `src/domain/models/app/design-validation.ts`. Normalization between the two
 * positions happens once, at the config-decode boundary
 * (`src/domain/models/app/design-normalization.ts`).
 *
 * The alias is removed at the next major.
 *
 * ## Two font fields the renderer does not honour
 *
 * `design.theme` re-mounts `ThemeSchema` unchanged, which means it inherits two
 * fields that validate and then go nowhere. Recorded here rather than papered
 * over, because a design system that documents a value the renderer discards is
 * worse than no design system:
 *
 * - **`theme.fonts.*.lineHeight` is inert.** `generateThemeFonts`
 *   (`src/infrastructure/css/theme/theme-generators.ts`) emits `--font-{cat}`,
 *   `-style`, `-transform` and `-letter-spacing` and reads `lineHeight`
 *   nowhere. Nothing else in `src/` reads it either.
 * - **`theme.fonts.*.size` and `.weights` reach exactly one consumer** — the
 *   legacy `hero` section renderer (`src/presentation/ui/sections/hero.tsx`),
 *   as an inline `fontSize` and as `weights[0]`. Neither reaches the CSS
 *   variable layer, and `weights` never reaches an `@font-face` rule, so
 *   `weights: [300, 400, 700]` loads no additional face.
 *
 * ## Those three fields are now SUPERSEDED, not deprecated
 *
 * `design.typeScale` is their working replacement: it emits real CSS custom
 * properties for every declared step, which is precisely what the three above
 * never did. The distinction in wording is load-bearing and is the same one
 * `inertDeclarationSchema` already argued — *"deprecated" means this worked and
 * is going away; these fields never worked.*
 *
 * They keep decoding, and are removed at the next major alongside the
 * top-level `theme` alias. Refusing them now would take an app that boots and
 * stop it booting, in exchange for **zero** rendering change — punishing the
 * author for a defect that was Sovrium's. The supersession is announced through
 * `collectDesignDeprecationNotices`, which the decode boundary already renders,
 * so an author is told where the value now takes effect.
 *
 * Two consequences worth stating, because both are easy to get wrong:
 *
 * - **`theme.fonts.*.lineHeight` stays inert on purpose.** Wiring it would
 *   create a second spelling of `typeScale.*.lineHeight` with different
 *   semantics (per-FACE rather than per-STEP) and would break
 * `[internal ref]`, which pins the divergence in executable form. That spec
 *   is still true and is deliberately not inverted.
 * - **The `inert` bucket still reports all three.** Supersession does not make
 *   a declaration take effect, so the export must keep saying so.
 *
 * and `[internal ref]`.
 */
export const DesignSchema = Schema.Struct({
  /**
   * Design tokens — colours, typography, spacing, shadows, radii, breakpoints,
   * animations. The canonical position for what top-level `theme` also accepts.
   */
  theme: Schema.optional(DesignThemeSchema),

  /**
   * The ordered type ladder — `display`, `h1`…`h6`, `lead`, `body`, `caption`.
   *
   * The one typography surface that reaches CSS, and the working replacement
   * for `theme.fonts.*.size` / `.lineHeight` / `.weights`, which validate and
   * reach (almost) nothing. See `type-scale.ts` and the section below.
   */
  typeScale: Schema.optional(TypeScaleSchema),

  /** The mark, its dark-mode variant, and the rules for placing it. */
  logo: Schema.optional(LogoSchema),

  /** How the app looks where tokens cannot reach: photography, icons, patterns. */
  imagery: Schema.optional(ImagerySchema),

  /** The convictions behind the tokens, ordered. */
  principles: Schema.optional(DesignPrinciplesSchema),

  /** How the app sounds: personality, address, preferred and refused patterns, tone per moment. */
  voice: Schema.optional(VoiceSchema),

  /** What each colour token is FOR. Keys must name a token in `design.theme.colors`. */
  colorRoles: Schema.optional(ColorRolesSchema),

  /** What each reusable component is for. Keys must name a `components[].name`. */
  components: Schema.optional(DesignComponentsSchema),

  /**
   * The zone map — which route patterns belong to which zone, what accent
   * budget each zone carries, and how each zone's voice departs from
   * `design.voice`.
   *
   * The one key here that describes ROUTES rather than tokens or words, and the
   * only one that ever had a home outside the schema: the `**Zones**:` line in
   * `apps/{website,partner}/BRAND.md`, which an unskippable drift check once
   * parsed out of Markdown prose to hold an access-adjacent invariant. The
   * check now evaluates THIS key, and that line is a validated pointer at
   * `config/design.ts`.
   */
  zones: Schema.optional(DesignZonesSchema),
}).pipe(
  Schema.annotate({
    identifier: 'Design',
    title: 'Design System',
    description:
      "The app's design system in one key: tokens, the type scale, the logo, imagery rules, principles, voice and tone, usage rules for colours and components, and the zone map. `design.theme` is the canonical position for the tokens that top-level `theme` also accepts; declaring both is an error.",
    // One example, exercising ALL NINE keys. Completeness is deliberate: this
    // block is the only place a reader sees the whole key in one shape, and a
    // partial example teaches the omitted keys as optional-in-practice.
    examples: [
      {
        theme: { colors: { primary: '#3b5bdb' } },
        typeScale: {
          h1: { size: '3rem', lineHeight: 1.1, weight: 700 },
          body: { size: '1rem', lineHeight: 1.6 },
        },
        logo: { src: '/logos/wordmark.svg', alt: 'Acme' },
        imagery: { iconSet: 'Lucide' },
        principles: ['Restraint over ornament'],
        voice: {
          personality: ['warm', 'direct'],
          pronoun: 'you',
          tone: { error: 'State the constraint, then offer a way forward.' },
        },
        colorRoles: { primary: { usage: 'Primary CTA fill only. Never body text.' } },
        components: { 'section-header': { usage: 'A titled band introducing a page section.' } },
        zones: [
          { pattern: '/admin/*', zone: 'product', accentBudget: 'product' },
          { pattern: 'everything else', zone: 'marketing', accentBudget: 'public' },
        ],
      },
    ],
  })
)

/** @public */
export type Design = Schema.Schema.Type<typeof DesignSchema>

export * from './color-roles'
export * from './components'
export * from './imagery'
export * from './logo'
export * from './principles'
export * from './theme'
export * from './type-scale'
export * from './voice'
export * from './zones'
