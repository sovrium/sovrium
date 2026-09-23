/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import animationsBody from '@/domain/models/app/design/animations.docs.md' with { type: 'file' }
import { CodeBlockConfigSchema } from '@/domain/models/app/design/code-block'
import { ColorRoleSchema } from '@/domain/models/app/design/color-roles'
import { ComponentStyleSchema } from '@/domain/models/app/design/components'
import { DensitySchema, DensityStepSchema } from '@/domain/models/app/design/density'
import { DesignSchema } from '@/domain/models/app/design/design'
import designComponentsBody from '@/domain/models/app/design/design-components.docs.md' with { type: 'file' }
import designDensityBody from '@/domain/models/app/design/design-density.docs.md' with { type: 'file' }
import designTypeScaleBody from '@/domain/models/app/design/design-type-scale.docs.md' with { type: 'file' }
import designBody from '@/domain/models/app/design/design.docs.md' with { type: 'file' }
import { FontConfigItemSchema } from '@/domain/models/app/design/fonts'
import { ImagerySchema } from '@/domain/models/app/design/imagery'
import { LogoSchema } from '@/domain/models/app/design/logo'
import { AnimationConfigObjectSchema, DesignMotionSchema } from '@/domain/models/app/design/motion'
import { RampSchema } from '@/domain/models/app/design/ramps'
import responsiveDesignBody from '@/domain/models/app/design/responsive-design.docs.md' with { type: 'file' }
import themeDarkModeBody from '@/domain/models/app/design/theme-dark-mode.docs.md' with { type: 'file' }
import themeSpacingBody from '@/domain/models/app/design/theme-spacing.docs.md' with { type: 'file' }
import themeTypographyBody from '@/domain/models/app/design/theme-typography.docs.md' with { type: 'file' }
import themeBody from '@/domain/models/app/design/theme.docs.md' with { type: 'file' }
import { TypeScaleStepSchema } from '@/domain/models/app/design/type-scale'
import { VoiceSchema } from '@/domain/models/app/design/voice'
import { DesignZoneSchema } from '@/domain/models/app/design/zones'
import { defineArticle, defineSection } from './define'

/**
 * Theming — the section manifest.
 *
 * Twelve articles over ONE property directory. `design` is a single key of
 * `AppSchema` with sixteen members, so the fragments are sub-fragments named
 * after the article rather than after a directory: a reader wants colours in
 * one place and motion in another, and the tree has nowhere to put that split.
 *
 * ─── WHY SO MANY ARTICLES CARRY NO DIRECTIVE ───────────────────────────────
 *
 * Seven token categories — `colors`, `darkColors`, `spacing`, `radius`,
 * `elevation`, `breakpoints`, `ramps`, `typeScale.families` — are OPEN maps
 * (`Schema.Record`, or the guarded-key variant). The walk publishes no row for
 * an open map, correctly: its keys are the author's vocabulary, not the
 * schema's. So `theme`, `theme-dark-mode` and `responsive-design` carry no
 * table at all, and the rules those maps decode against stay prose. Where a
 * map's VALUE is a struct the directive names that instead — `RampSchema` for
 * a ramp, `FontConfigItemSchema` for a face.
 *
 * `principles` and `zones` are arrays, which the walk also declines to
 * address, so `zones` is documented through `DesignZoneSchema`.
 *
 * ─── TWO ARTICLES LEFT THIS SECTION ────────────────────────────────────────
 *
 * `interactions` documents `pages[].components[].interactions` and
 * `interactivity-scripts` documents `pages[].scripts`. The published corpus
 * filed both under theming, and this manifest carried them for exactly as long
 * as it took to write the `pages` section: neither is about `design`, so by the
 * placement rule both now sit in `pages/` and are registered there. Ten
 * articles remain, and all ten are about the one property.
 */
export const section = defineSection({
  slug: 'theming',
  title: 'Theming',
  order: 3598,
  tab: 'design',
  articles: [
    defineArticle({
      slug: 'design',
      title: 'Design System',
      description:
        'The `design` key in full — the token categories, the charter that tokens cannot carry, the zone map, and the DTCG and agent-brief exports.',
      keywords: [
        'sovrium',
        'design system',
        'design tokens',
        'brand voice',
        'tone',
        'colour roles',
        'logo',
        'imagery',
        'zones',
        'DTCG',
      ],
      order: 3598,
      sidebarLabel: 'Design System',
      body: designBody,
      documents: [DesignSchema, LogoSchema, VoiceSchema, ImagerySchema, DesignZoneSchema],
      stories: ['US-ADMIN-DESIGN-SYSTEM-EXPORT', 'US-THEMING-DESIGN-TOKENS-002'],
    }),
    defineArticle({
      slug: 'design-components',
      title: 'Component Styles',
      description:
        '`design.components` restyles every instance of an engine component type — parts, variants and states — under a focus-ring floor that outranks both your classes and the shipped recipe.',
      keywords: [
        'sovrium',
        'component styles',
        'design components',
        'parts',
        'variants',
        'states',
        'replace',
        'focus ring',
        'ramps',
        'colorRoles',
        'oklch',
      ],
      order: 3599,
      sidebarLabel: 'Component Styles',
      body: designComponentsBody,
      documents: [ComponentStyleSchema, RampSchema, ColorRoleSchema],
      stories: [
        'US-DESIGN-CLASS-OVERRIDE',
        'US-DESIGN-DESIGN-COMPONENTS',
        'US-DESIGN-SYSTEM-UI-KIT',
        'US-DESIGN-SYSTEM-SCENES-DATA',
        'US-DESIGN-SYSTEM-SCENES-FORMS',
        'US-DESIGN-SYSTEM-SCENES-LAYOUTS',
        'US-DESIGN-SYSTEM-SCENES-NAVIGATION',
        'US-THEMING-THEME-AWARE-COMPONENTS-001',
        'US-THEMING-THEME-AWARE-COMPONENTS-002',
        'US-THEMING-THEME-AWARE-COMPONENTS-003',
      ],
    }),
    defineArticle({
      slug: 'theme',
      title: 'Theme Overview & Colors',
      description:
        'Named colour tokens, the CSS custom property and utilities each one mints, and the two rules a palette is decoded against.',
      keywords: [
        'sovrium',
        'design tokens',
        'colors',
        'CSS custom properties',
        'tailwind utilities',
        'hex',
        'rgb',
        'hsl',
      ],
      order: 3600,
      sidebarLabel: 'Theme & Colors',
      body: themeBody,
      documents: [],
      stories: ['US-THEMING-THEME-AWARE-COMPONENTS-004', 'US-THEMING-THEME-TOKEN-CONTRAST'],
    }),
    defineArticle({
      slug: 'design-type-scale',
      title: 'Type Scale',
      description:
        '`design.typeScale.steps` is the app’s type ladder — twelve named rungs, each a bound size, leading, weight and tracking — and the one design key that emits a usable utility per step.',
      keywords: [
        'sovrium',
        'type scale',
        'typography',
        'font size',
        'line height',
        'letter spacing',
        'font weight',
        'text utility',
        'DTCG typography',
      ],
      order: 3601,
      sidebarLabel: 'Type Scale',
      body: designTypeScaleBody,
      documents: [TypeScaleStepSchema],
      stories: [
        'US-ADMIN-DESIGN-SYSTEM-SCHEMA-OPTIONS',
        'US-THEMING-DESIGN-TOKENS-003',
        'US-THEMING-DESIGN-TOKENS-004',
      ],
    }),
    defineArticle({
      slug: 'design-density',
      title: 'Density',
      description:
        'One ladder of three steps — compact, cozy, roomy — each fixing the row padding, field height, small-button height, gutter and dense-text size that rows, cells and chips are drawn from.',
      keywords: [
        'sovrium',
        'design density',
        'compact',
        'cozy',
        'roomy',
        'row height',
        'control height',
        'sv-density',
        'byZone',
        'floors',
      ],
      order: 3602,
      sidebarLabel: 'Density',
      body: designDensityBody,
      documents: [DensitySchema, DensityStepSchema],
      stories: ['US-THEMING-ISLANDS-DATA-TABLE-PANELS', 'US-THEMING-ISLANDS-DATA-TABLE-SURFACE'],
    }),
    defineArticle({
      slug: 'theme-typography',
      title: 'Typography',
      description:
        '`design.typeScale.families` maps a role to a typeface — family, fallback stack, tracking and web-font loading — and names the three fields that reach nothing.',
      keywords: [
        'sovrium',
        'typography',
        'fonts',
        'font family',
        'fallback',
        'google fonts',
        'web fonts',
        'superseded',
      ],
      order: 3604,
      sidebarLabel: 'Typography',
      body: themeTypographyBody,
      documents: [FontConfigItemSchema],
      stories: ['US-THEMING-ISLANDS-DISPLAY-WIDGETS'],
    }),
    defineArticle({
      slug: 'theme-spacing',
      title: 'Spacing, Radius & Elevation',
      description:
        'Three ladders that decide how much room things take and how far they sit off the page, plus the syntax theme for fenced code.',
      keywords: [
        'sovrium',
        'spacing',
        'radius',
        'border radius',
        'elevation',
        'box-shadow',
        'design tokens',
        'codeBlock',
        'syntax highlighting',
      ],
      order: 3608,
      sidebarLabel: 'Spacing & Surfaces',
      body: themeSpacingBody,
      documents: [CodeBlockConfigSchema],
      stories: [
        'US-THEMING-DEFAULT-THEME-ALIAS-UTILITIES',
        'US-THEMING-DESIGN-TOKENS-001',
        'US-THEMING-DESIGN-TOKENS-005',
        'US-THEMING-DESIGN-TOKENS-006',
      ],
    }),
    defineArticle({
      slug: 'theme-dark-mode',
      title: 'Baseline & Dark Mode',
      description:
        'What the app looks like before you style anything, and what it looks like at night — `baseline`, `darkColors` and `colorScheme`.',
      keywords: [
        'sovrium',
        'dark mode',
        'darkColors',
        'colorScheme',
        'baseline',
        'extend',
        'replace',
        'theme-toggle',
        'prefers-color-scheme',
      ],
      order: 3612,
      sidebarLabel: 'Baseline & Dark Mode',
      body: themeDarkModeBody,
      documents: [],
      stories: [
        'US-DESIGN-SYSTEM-FOUNDATIONS',
        'US-THEMING-DARK-COLOR-OVERRIDES',
        'US-THEMING-THEME-TOGGLE',
      ],
    }),
    defineArticle({
      slug: 'responsive-design',
      title: 'Responsive Design',
      description:
        '`design.breakpoints` names the widths at which the layout changes its mind, and every name becomes a mobile-first utility prefix.',
      keywords: [
        'sovrium',
        'responsive design',
        'breakpoints',
        'mobile-first',
        'media queries',
        'per-breakpoint overrides',
      ],
      order: 3616,
      sidebarLabel: 'Responsive Design',
      body: responsiveDesignBody,
      documents: [],
      stories: ['US-THEMING-RESPONSIVE-DESIGN'],
    }),
    defineArticle({
      slug: 'animations',
      title: 'Animations',
      description:
        '`design.motion` holds the duration ladder, the easing set, the named keyframe blocks, and the animations composed out of them.',
      keywords: [
        'sovrium',
        'animations',
        'motion',
        'keyframes',
        'durations',
        'easings',
        'transitions',
        'design tokens',
      ],
      order: 3620,
      sidebarLabel: 'Animations',
      body: animationsBody,
      documents: [DesignMotionSchema, AnimationConfigObjectSchema],
      stories: [
        'US-DESIGN-DESIGN-KEY',
        'US-THEMING-ANIMATIONS',
        'US-THEMING-ISLANDS-DATA-VIEWS',
        'US-THEMING-ISLANDS-FORM-CONTROLS',
        'US-THEMING-ISLANDS-FORMS-CHAT',
        'US-THEMING-ISLANDS-NAVIGATION',
        'US-THEMING-ISLANDS-OVERLAYS',
        'US-THEMING-ISLANDS-SPECIALTY-COMMENT-COUNT',
        'US-THEMING-ISLANDS-SPECIALTY-COMMENTS',
        'US-THEMING-ISLANDS-SPECIALTY-PRESENCE-INDICATOR',
      ],
    }),
  ],
})
