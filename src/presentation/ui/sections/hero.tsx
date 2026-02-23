/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Theme } from '@/domain/models/app/theme'
import type { ReactElement, ReactNode } from 'react'

/**
 * Extracted theme tokens for Hero component
 */
interface HeroThemeTokens {
  readonly breakpoints: {
    readonly sm: number
    readonly md: number
    readonly lg: number
  }
  readonly colors: {
    readonly background: string
    readonly text: string
    readonly primary: string
  }
  readonly spacing: {
    readonly section: string
  }
  readonly borderRadius: {
    readonly lg: string
  }
  readonly fonts: {
    readonly title: {
      readonly family: string
      readonly weight: number
      readonly size: string
    }
    readonly body: {
      readonly family: string
    }
  }
}

/**
 * Default theme values
 */
const DEFAULT_THEME = {
  breakpoints: { sm: '640px', md: '768px', lg: '1024px' },
  colors: { background: '#ffffff', text: '#212529', primary: '#007bff' },
  spacing: { section: '4rem' },
  borderRadius: { lg: '0.5rem' },
  fonts: {
    title: { family: 'Bely Display', weight: 700, size: '2.5rem' },
    body: { family: 'Inter' },
  },
} as const

/**
 * Extract breakpoint values from theme
 */
function extractBreakpoints(theme?: Theme): HeroThemeTokens['breakpoints'] {
  return {
    sm: parseInt(theme?.breakpoints?.sm ?? DEFAULT_THEME.breakpoints.sm, 10),
    md: parseInt(theme?.breakpoints?.md ?? DEFAULT_THEME.breakpoints.md, 10),
    lg: parseInt(theme?.breakpoints?.lg ?? DEFAULT_THEME.breakpoints.lg, 10),
  }
}

/**
 * Extract color values from theme
 */
function extractColors(theme?: Theme): HeroThemeTokens['colors'] {
  return {
    background: theme?.colors?.background ?? DEFAULT_THEME.colors.background,
    text: theme?.colors?.text ?? DEFAULT_THEME.colors.text,
    primary: theme?.colors?.primary ?? DEFAULT_THEME.colors.primary,
  }
}

/**
 * Type helper for a single font configuration item
 */
type FontItem = NonNullable<Theme['fonts']>[string]

/**
 * Extract title font weight (handles both legacy and current schemas)
 */
function extractTitleWeight(titleFont?: FontItem): number {
  // @ts-expect-error - legacy schema support (weight as number)
  const legacyWeight = titleFont?.weight as number | undefined
  const currentWeight = titleFont?.weights?.[0]
  return legacyWeight ?? currentWeight ?? DEFAULT_THEME.fonts.title.weight
}

/**
 * Extract title font configuration
 */
function extractTitleFont(titleFont?: FontItem): HeroThemeTokens['fonts']['title'] {
  return {
    family: titleFont?.family ?? DEFAULT_THEME.fonts.title.family,
    weight: extractTitleWeight(titleFont),
    size: titleFont?.size ?? DEFAULT_THEME.fonts.title.size,
  }
}

/**
 * Extract font values from theme
 */
function extractFonts(theme?: Theme): HeroThemeTokens['fonts'] {
  return {
    title: extractTitleFont(theme?.fonts?.title),
    body: {
      family: theme?.fonts?.body?.family ?? DEFAULT_THEME.fonts.body.family,
    },
  }
}

/**
 * Extract and normalize theme tokens for Hero component
 */
function extractHeroTheme(theme?: Theme): HeroThemeTokens {
  return {
    breakpoints: extractBreakpoints(theme),
    colors: extractColors(theme),
    spacing: {
      // Use explicit theme.spacing.section if provided, otherwise use mobile-first default
      section: theme?.spacing?.section ?? '2rem',
    },
    borderRadius: {
      lg: theme?.borderRadius?.lg ?? DEFAULT_THEME.borderRadius.lg,
    },
    fonts: extractFonts(theme),
  }
}

/**
 * Default content demonstrating cohesive theme integration
 */
function HeroDefaultContent({
  themeTokens,
}: Readonly<{
  readonly themeTokens: HeroThemeTokens
}>): ReactElement {
  return (
    <div
      style={{
        textAlign: 'center',
        maxWidth: '800px',
      }}
    >
      <h1
        style={{
          fontFamily: themeTokens.fonts.title.family,
          fontWeight: themeTokens.fonts.title.weight,
          fontSize: themeTokens.fonts.title.size,
          color: themeTokens.colors.text,
          marginBottom: '2rem',
        }}
      >
        Welcome to Sovrium
      </h1>
      <button
        style={{
          backgroundColor: themeTokens.colors.primary,
          color: '#ffffff',
          fontFamily: themeTokens.fonts.body.family,
          fontSize: '1rem',
          padding: '0.75rem 1.5rem',
          borderRadius: themeTokens.borderRadius.lg,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Get Started
      </button>
    </div>
  )
}

/**
 * Generate responsive media query styles for Hero section
 */
function generateHeroMediaQueries(
  breakpoints: HeroThemeTokens['breakpoints'],
  testId?: string
): string {
  return `
    @media (min-width: ${breakpoints.sm}px) {
      section[data-testid="${testId}"] {
        padding: 3rem;
      }
    }
    @media (min-width: ${breakpoints.md}px) {
      section[data-testid="${testId}"] {
        padding: 4rem;
      }
    }
    @media (min-width: ${breakpoints.lg}px) {
      section[data-testid="${testId}"] {
        padding: 5rem;
      }
    }
  `
}

/**
 * Resolve easing token from theme
 */
function resolveEasingToken(tokenName: string, theme?: Theme): string | undefined {
  if (!theme?.animations) return undefined
  const animations = theme.animations as Record<string, unknown>
  const easingTokens = animations.easing as Record<string, unknown> | undefined
  if (!easingTokens || typeof easingTokens !== 'object') return undefined
  const easingValue = easingTokens[tokenName]
  return easingValue ? String(easingValue) : undefined
}

/**
 * Resolve color token from theme
 */
function resolveColorToken(tokenName: string, theme?: Theme): string | undefined {
  if (!theme?.colors) return undefined
  const colorValue = theme.colors[tokenName]
  return colorValue ? String(colorValue) : undefined
}

/**
 * Resolve single token reference
 */
function resolveSingleToken(category: string, tokenName: string, theme?: Theme): string {
  if (category === 'easing') {
    return resolveEasingToken(tokenName, theme) ?? `$${category}.${tokenName}`
  }
  if (category === 'colors') {
    return resolveColorToken(tokenName, theme) ?? `$${category}.${tokenName}`
  }
  return `$${category}.${tokenName}`
}

/**
 * Resolve token references in animation string
 * Supports: $easing.smooth, $colors.primary, etc.
 */
function resolveAnimationTokens(animation: string, theme?: Theme): string {
  return animation.replace(/\$(\w+)\.(\w+)/g, (_match, category, tokenName) =>
    resolveSingleToken(category, tokenName, theme)
  )
}

/**
 * Content structure for Hero section
 */
interface HeroContent {
  readonly button?: {
    readonly text: string
    readonly animation?: string
  }
}

/**
 * Base section styles for Hero component
 */
const heroSectionBaseStyle = {
  minHeight: '200px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const

/**
 * Check if theme has fadeInUp animation configured
 */
function hasFadeInUpAnimation(theme?: Theme): boolean {
  if (!theme?.animations) return false
  const animations = theme.animations as Record<string, unknown>
  return Boolean(animations.fadeInUp)
}

/**
 * Build section style with theme tokens
 */
function buildHeroSectionStyle(themeTokens: HeroThemeTokens): Record<string, string> {
  return {
    ...heroSectionBaseStyle,
    backgroundColor: themeTokens.colors.background,
    padding: themeTokens.spacing.section,
  }
}

/**
 * Render Hero section with custom animated button
 */
function HeroWithButton({
  themeTokens,
  buttonContent,
  testId,
  theme,
}: Readonly<{
  readonly themeTokens: HeroThemeTokens
  readonly buttonContent: NonNullable<HeroContent['button']>
  readonly testId?: string
  readonly theme?: Theme
}>): ReactElement {
  const resolvedAnimation = buttonContent.animation
    ? resolveAnimationTokens(buttonContent.animation, theme)
    : undefined

  return (
    <section
      data-testid={testId}
      style={buildHeroSectionStyle(themeTokens)}
    >
      <button
        data-testid="animated-cta"
        style={{
          backgroundColor: themeTokens.colors.primary,
          color: '#ffffff',
          fontFamily: themeTokens.fonts.body.family,
          fontSize: '1rem',
          padding: '0.75rem 1.5rem',
          borderRadius: themeTokens.borderRadius.lg,
          border: 'none',
          cursor: 'pointer',
          animation: resolvedAnimation,
        }}
      >
        {buttonContent.text}
      </button>
      <style>{generateHeroMediaQueries(themeTokens.breakpoints, testId)}</style>
    </section>
  )
}

/**
 * Hero Section Component
 *
 * Renders a hero section with full theme integration demonstrating cohesive UI.
 * When no children are provided, renders default content (h1 heading + CTA button)
 * that showcases all theme tokens applied together:
 * - Background color (theme.colors.background)
 * - Heading with theme fonts (family, size, weight, color)
 * - Button with theme colors and border radius
 * - Section padding (theme.spacing.section)
 *
 * Uses theme.breakpoints to determine responsive behavior via CSS custom properties.
 * Applies progressive enhancement - padding increases as viewport grows.
 *
 * @param props - Component props
 * @param props.theme - Theme configuration with all design tokens
 * @param props.content - Structured content (button, etc.)
 * @param props.children - Hero content (optional - defaults to themed heading + button)
 * @param props.data-testid - Test identifier
 * @returns Hero section element with cohesive theme integration
 */
export function Hero({
  theme,
  content,
  children,
  ...props
}: Readonly<{
  readonly theme?: Theme
  readonly content?: HeroContent
  readonly children?: ReactNode
  readonly 'data-testid'?: string
}>): Readonly<ReactElement> {
  const themeTokens = extractHeroTheme(theme)

  if (content?.button) {
    return (
      <HeroWithButton
        themeTokens={themeTokens}
        buttonContent={content.button}
        testId={props['data-testid']}
        theme={theme}
      />
    )
  }

  const hasChildren =
    children && (Array.isArray(children) ? children.length > 0 : Boolean(children))
  const renderedContent = hasChildren ? children : <HeroDefaultContent themeTokens={themeTokens} />
  const shouldAnimateFadeInUp = hasFadeInUpAnimation(theme)
  const sectionClassName = shouldAnimateFadeInUp ? 'animate-fadeInUp' : undefined

  return (
    <section
      data-testid={props['data-testid']}
      style={buildHeroSectionStyle(themeTokens)}
      className={sectionClassName}
    >
      {renderedContent}
      <style>{generateHeroMediaQueries(themeTokens.breakpoints, props['data-testid'])}</style>
    </section>
  )
}
