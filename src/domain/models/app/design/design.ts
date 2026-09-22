/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DesignBreakpointsSchema } from './breakpoints'
import { CodeBlockConfigSchema } from './code-block'
import { ColorRolesSchema } from './color-roles'
import { DesignColorsSchema, DesignDarkColorsSchema } from './colors'
import { DesignComponentsSchema } from './components'
import { DensitySchema } from './density'
import { DesignElevationSchema } from './elevation'
import { ImagerySchema } from './imagery'
import { LogoSchema } from './logo'
import { DesignMotionSchema } from './motion'
import { DesignPrinciplesSchema } from './principles'
import { DesignRadiusSchema } from './radius'
import { DesignRampsSchema } from './ramps'
import { DesignSpacingSchema } from './spacing'
import { TypeScaleSchema } from './type-scale'
import { VoiceSchema } from './voice'
import { DesignZonesSchema } from './zones'

/**
 * The app's design system, in one key — one key per design PURPOSE, and each
 * purpose addressable exactly once.
 *
 * ## Why one key
 *
 * Sovrium reads a config file and becomes an app. The author declares tokens
 * and composes pages from the component catalog — but nowhere could that
 * author, or an agent building on their behalf, see the resulting design system
 * as a single authoritative artifact. The consequence is drift: a page added
 * next month guesses at spacing, invents a hex, picks a heading level by feel.
 *
 * A token block alone cannot close that, because three things a design system
 * must carry had **no home in the schema at all**:
 *
 * 1. **Principles** — why the tokens are what they are.
 * 2. **Voice and tone** — how the app SOUNDS. This is the whole reason an AI
 *    could not write on-brand copy for a Sovrium app.
 * 3. **Usage rules** — "when do I reach for `primary`?", "what is
 *    `section-header` for?". `design.colors` is an open record with no
 *    semantics; `design.colorRoles` is where the semantics live. (The component
 *    half of this lives ON the template, as `components[].guidance` —
 *    co-located, so a rename cannot half-apply. `design.components` is the
 *    operator's per-engine-type STYLE key.)
 *
 * ## Four bands, twenty keys, no second spelling of anything
 *
 * - **Colour** — `colorScheme`, `colors`, `darkColors`, `ramps`, `colorRoles`.
 * - **Foundations** — `typeScale`, `spacing`, `radius`, `elevation`, `motion`,
 *   `breakpoints`.
 * - **Application** — `density`, `baseline`, `codeBlock`, `components`,
 *   `zones`.
 * - **Charter** — `logo`, `imagery`, `principles`, `voice`.
 *
 * The order above is the narrative order, and it is also the order the design
 * console's Foundations page reads: what colour the app is, what its tokens
 * are, how those tokens are applied, and what the words around them say.
 *
 * ## Why there is no token BLOCK any more
 *
 * There used to be one, in two positions, holding eleven members named after
 * CSS PROPERTIES — `borderRadius`, `shadows`, `fonts` — beside a `scales` key
 * holding seven further ladders that nothing read. Thirty declarable positions
 * for twenty purposes, several of them reachable two ways.
 *
 * Naming a key after the CSS property makes the technique look like the point,
 * which is how a system ends up with eleven shadows and no levels. Every member
 * is now a direct key of `design`, named for what it decides. A config written
 * against a removed spelling is REFUSED by name, with the destination key in
 * the message — see `removed-keys.ts`..
 *
 * ## The three inert font fields
 *
 * `typeScale.families` carries `size`, `lineHeight` and `weights` on each FACE.
 * None of them reaches the CSS variable layer; `typeScale.steps` is where those
 * three quantities take effect. Recorded rather than papered over, because a
 * design system that documents a value the renderer discards is worse than no
 * design system..
 */
export const DesignSchema = Schema.Struct({
  // ── Band A: colour ─────────────────────────────────────────────────────────

  /**
   * Default color scheme applied before content renders (no-FOUC).
   *
   * - `'light'` — force the light scheme as the default.
   * - `'dark'` — force the dark scheme as the default (the `.dark` class is
   *   set on `<html>` ahead of the stylesheet).
   * - `'system'` — follow the visitor's `prefers-color-scheme` (default when a
   *   `theme-toggle` is present and no value is configured).
   *
   * A stored visitor preference always overrides this default once the no-FOUC
   * head script runs. This sets the starting point, not the policy.
   */
  colorScheme: Schema.optional(
    Schema.Literals(['light', 'dark', 'system']).annotate({
      title: 'Default Color Scheme',
      description:
        "Default color scheme before content renders: 'light', 'dark', or 'system' (follow prefers-color-scheme).",
    })
  ),

  /** The named colour literals — an unordered palette of author tokens. */
  colors: Schema.optional(DesignColorsSchema),

  /** Dark-scheme overrides, keyed identically to `colors`. */
  darkColors: Schema.optional(DesignDarkColorsSchema),

  /**
   * The colour RAMPS — ordered lightness ladders whose steps roles refer to.
   *
   * Distinct from `colors`, which is an unordered palette with a different
   * emission. See `ramps.ts`.
   */
  ramps: Schema.optional(DesignRampsSchema),

  /**
   * What each colour role RESOLVES TO, and what it is for.
   *
   * An entry carrying `value` DEFINES the role; one carrying only prose
   * documents a token declared in `design.colors` and must name it.
   */
  colorRoles: Schema.optional(ColorRolesSchema),

  // ── Band B: the token foundations ──────────────────────────────────────────

  /**
   * The TYPE foundation: `families` names the faces, `steps` is the ordered
   * ladder — `display`, `h1`…`h6`, `lead`, `body`, `caption`, `overline`.
   *
   * The one typography surface that reaches CSS. See `type-scale.ts`.
   */
  typeScale: Schema.optional(TypeScaleSchema),

  /** The SPACE foundation: one ordered ladder of lengths. */
  spacing: Schema.optional(DesignSpacingSchema),

  /** The SHAPE foundation: corner radii, by name. */
  radius: Schema.optional(DesignRadiusSchema),

  /** The ELEVATION foundation: how far a surface sits off the page. */
  elevation: Schema.optional(DesignElevationSchema),

  /**
   * The MOTION foundation: durations, easings, keyframe blocks, and the
   * animations composed out of them.
   */
  motion: Schema.optional(DesignMotionSchema),

  /** The LAYOUT foundation: the widths at which the design changes its mind. */
  breakpoints: Schema.optional(DesignBreakpointsSchema),

  // ── Band C: application ────────────────────────────────────────────────────

  /**
   * How tightly a surface packs its rows, controls and text — three named
   * steps, optionally assigned per zone.
   *
   * The typography sibling of `typeScale`, and a different axis from `spacing`:
   * `spacing` is a ladder the author picks from, `density` is a mode that
   * re-picks for them, per zone.
   */
  density: Schema.optional(DensitySchema),

  /**
   * Whether prebuilt components extend Sovrium's default design system look
   * (the `V1_TOKEN_LAYER` in `src/infrastructure/css/theme/default-theme-layer.ts`)
   * or replace it with a neutral, unstyled floor. Defaults to `'extend'`.
   */
  baseline: Schema.optional(
    Schema.Literals(['extend', 'replace']).annotate({
      title: 'Design Baseline',
      description:
        "Extend Sovrium's v1 default look ('extend', default) or replace it with a neutral floor ('replace').",
    })
  ),

  /** Syntax-highlighting theme for markdown fenced code blocks. */
  codeBlock: Schema.optional(CodeBlockConfigSchema),

  /**
   * Classes on the components the ENGINE draws, keyed by component type.
   *
   * The one key here addressed to the OPERATOR rather than the author: it
   * restyles `button`, `table` and their 80-odd siblings across the whole
   * app, where `props.className` reaches one node. An app's own reusable
   * templates are not styled from here — they carry their own props, and their
   * prose lives on `components[].guidance`.
   */
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

  // ── Band D: the charter ────────────────────────────────────────────────────

  /** The mark, its dark-mode variant, and the rules for placing it. */
  logo: Schema.optional(LogoSchema),

  /** How the app looks where tokens cannot reach: photography, icons, patterns. */
  imagery: Schema.optional(ImagerySchema),

  /** The convictions behind the tokens, ordered. */
  principles: Schema.optional(DesignPrinciplesSchema),

  /** How the app sounds: personality, address, preferred and refused patterns, tone per moment. */
  voice: Schema.optional(VoiceSchema),
}).pipe(
  Schema.annotate({
    identifier: 'Design',
    title: 'Design System',
    description:
      "The app's design system in one key: the colour palette, ramps and roles; the type, space, shape, elevation, motion and layout foundations; density, baseline, code-block and per-engine-type component styling; the zone map; and the charter — logo, imagery, principles and voice.",
    // One example, exercising every band. Completeness is deliberate: this
    // block is the only place a reader sees the whole key in one shape, and a
    // partial example teaches the omitted keys as optional-in-practice.
    examples: [
      {
        colorScheme: 'system',
        colors: { primary: '#3b5bdb' },
        darkColors: { primary: '#748ffc' },
        ramps: { neutral: { '50': 'oklch(0.985 0 0)', '950': 'oklch(0.14 0 0)' } },
        colorRoles: {
          primary: {
            value: 'neutral-950',
            dark: 'neutral-50',
            usage: 'Primary CTA fill only. Never body text.',
          },
        },
        typeScale: {
          families: { title: { family: 'Inter' }, body: { family: 'Inter' } },
          steps: {
            h1: { size: '3rem', lineHeight: 1.1, weight: 700 },
            body: { size: '1rem', lineHeight: 1.6 },
          },
        },
        spacing: { '4': '1rem' },
        radius: { base: '0.25rem', full: '9999px' },
        elevation: { sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)' },
        motion: {
          durations: { fast: '120ms', base: '180ms' },
          easings: { default: 'cubic-bezier(0.2, 0, 0, 1)' },
        },
        breakpoints: { md: '768px' },
        density: {
          steps: {
            compact: { rowY: '5px', controlH: '36px', buttonH: '28px', gap: '7px', text: '11px' },
            cozy: {
              rowY: '8px',
              controlH: '40px',
              buttonH: '32px',
              gap: '10px',
              text: '0.8125rem',
            },
            roomy: {
              rowY: '12px',
              controlH: '44px',
              buttonH: '36px',
              gap: '14px',
              text: '0.875rem',
            },
          },
          byZone: { product: 'compact', marketing: 'roomy' },
        },
        baseline: 'extend',
        codeBlock: { theme: 'github-dark' },
        components: { button: { parts: { root: 'rounded-none' } } },
        zones: [
          { pattern: '/admin/*', zone: 'product', accentBudget: 'product' },
          { pattern: 'everything else', zone: 'marketing', accentBudget: 'public' },
        ],
        logo: { src: '/logos/wordmark.svg', alt: 'Acme' },
        imagery: { iconSet: 'Lucide' },
        principles: ['Restraint over ornament'],
        voice: {
          personality: ['warm', 'direct'],
          pronoun: 'you',
          tone: { error: 'State the constraint, then offer a way forward.' },
        },
      },
    ],
  })
)

/** @public */
export type Design = Schema.Schema.Type<typeof DesignSchema>
