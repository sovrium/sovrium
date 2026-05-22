/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { Theme } from '@/domain/models/app/theme'
import type { ReactElement, ReactNode } from 'react'

interface HeroThemeTokens {
  readonly breakpoints: {
    readonly sm: number
    readonly md: number
    readonly lg: number
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

const DEFAULT_THEME = {
  breakpoints: { sm: '640px', md: '768px', lg: '1024px' },
  spacing: { section: '4rem' },
  borderRadius: { lg: '0.5rem' },
  fonts: {
    title: { family: 'Bely Display', weight: 700, size: '2.5rem' },
    body: { family: 'Inter' },
  },
} as const

function extractBreakpoints(theme?: Theme): HeroThemeTokens['breakpoints'] {
  return {
    sm: parseInt(theme?.breakpoints?.sm ?? DEFAULT_THEME.breakpoints.sm, 10),
    md: parseInt(theme?.breakpoints?.md ?? DEFAULT_THEME.breakpoints.md, 10),
    lg: parseInt(theme?.breakpoints?.lg ?? DEFAULT_THEME.breakpoints.lg, 10),
  }
}

type FontItem = NonNullable<Theme['fonts']>[string]

function extractTitleWeight(titleFont?: FontItem): number {
  // @ts-expect-error - legacy schema support (weight as number)
  const legacyWeight = titleFont?.weight as number | undefined
  const currentWeight = titleFont?.weights?.[0]
  return legacyWeight ?? currentWeight ?? DEFAULT_THEME.fonts.title.weight
}

function extractTitleFont(titleFont?: FontItem): HeroThemeTokens['fonts']['title'] {
  return {
    family: titleFont?.family ?? DEFAULT_THEME.fonts.title.family,
    weight: extractTitleWeight(titleFont),
    size: titleFont?.size ?? DEFAULT_THEME.fonts.title.size,
  }
}

function extractFonts(theme?: Theme): HeroThemeTokens['fonts'] {
  return {
    title: extractTitleFont(theme?.fonts?.title),
    body: {
      family: theme?.fonts?.body?.family ?? DEFAULT_THEME.fonts.body.family,
    },
  }
}

function extractHeroTheme(theme?: Theme): HeroThemeTokens {
  return {
    breakpoints: extractBreakpoints(theme),
    spacing: {
      section: theme?.spacing?.section ?? '2rem',
    },
    borderRadius: {
      lg: theme?.borderRadius?.lg ?? DEFAULT_THEME.borderRadius.lg,
    },
    fonts: extractFonts(theme),
  }
}

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
        className="text-foreground"
        style={{
          fontFamily: themeTokens.fonts.title.family,
          fontWeight: themeTokens.fonts.title.weight,
          fontSize: themeTokens.fonts.title.size,
          marginBottom: '2rem',
        }}
      >
        Welcome to Sovrium
      </h1>
      <button
        className="bg-primary text-primary-fg hover:bg-primary-hover"
        style={{
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

function resolveEasingToken(tokenName: string, theme?: Theme): string | undefined {
  if (!theme?.animations) return undefined
  const animations = theme.animations as Record<string, unknown>
  const easingTokens = animations.easing as Record<string, unknown> | undefined
  if (!easingTokens || typeof easingTokens !== 'object') return undefined
  const easingValue = easingTokens[tokenName]
  return easingValue ? String(easingValue) : undefined
}

function resolveColorToken(tokenName: string, theme?: Theme): string | undefined {
  if (!theme?.colors) return undefined
  const colorValue = theme.colors[tokenName]
  return colorValue ? String(colorValue) : undefined
}

function resolveSingleToken(category: string, tokenName: string, theme?: Theme): string {
  if (category === 'easing') {
    return resolveEasingToken(tokenName, theme) ?? `$${category}.${tokenName}`
  }
  if (category === 'colors') {
    return resolveColorToken(tokenName, theme) ?? `$${category}.${tokenName}`
  }
  return `$${category}.${tokenName}`
}

function resolveAnimationTokens(animation: string, theme?: Theme): string {
  return animation.replace(/\$(\w+)\.(\w+)/g, (_match, category, tokenName) =>
    resolveSingleToken(category, tokenName, theme)
  )
}

interface HeroContent {
  readonly button?: {
    readonly text: string
    readonly animation?: string
  }
}

const heroSectionBaseStyle = {
  minHeight: '200px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const

function hasFadeInUpAnimation(theme?: Theme): boolean {
  if (!theme?.animations) return false
  const animations = theme.animations as Record<string, unknown>
  return Boolean(animations.fadeInUp)
}

function buildHeroSectionStyle(themeTokens: HeroThemeTokens): Record<string, string> {
  return {
    ...heroSectionBaseStyle,
    padding: themeTokens.spacing.section,
  }
}

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
      className="bg-background"
      style={buildHeroSectionStyle(themeTokens)}
    >
      <button
        data-testid="animated-cta"
        className="bg-primary text-primary-fg hover:bg-primary-hover"
        style={{
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
  const sectionClassName = shouldAnimateFadeInUp
    ? 'bg-background animate-fadeInUp'
    : 'bg-background'

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
