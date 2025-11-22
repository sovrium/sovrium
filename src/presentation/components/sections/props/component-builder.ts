/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildHoverTransitionStyles } from '../styling/hover-interaction-handler'
import { applySpacingStyles } from '../styling/spacing-resolver'
import { buildFinalClassName, processComponentStyle } from '../styling/style-processor'
import { substitutePropsThemeTokens } from '../styling/theme-tokens'
import {
  findFirstTranslationKey,
  getTranslationData,
  substitutePropsTranslationTokens,
} from '../translations/translation-handler'
import { buildElementProps } from './props-builder'
import type { Languages } from '@/domain/models/app/languages'
import type { Interactions } from '@/domain/models/app/page/common/interactions/interactions'
import type { Component } from '@/domain/models/app/page/sections'
import type { Theme } from '@/domain/models/app/theme'
import type { ReactElement } from 'react'

/**
 * Configuration for building component props
 */
export type ComponentPropsConfig = {
  readonly type: string
  readonly props: Record<string, unknown> | undefined
  readonly children: ReadonlyArray<Component | string> | undefined
  readonly content: string | undefined
  readonly blockName: string | undefined
  readonly blockInstanceIndex: number | undefined
  readonly theme: Theme | undefined
  readonly languages: Languages | undefined
  readonly currentLang: string | undefined
  readonly childIndex: number | undefined
  readonly interactions: Interactions | undefined
}

/**
 * Result of component props building
 */
export type ComponentPropsResult = {
  readonly elementProps: Record<string, unknown>
  readonly elementPropsWithSpacing: Record<string, unknown>
  readonly renderedChildren: ReadonlyArray<ReactElement | string | null>
}

/**
 * Props configuration for component rendering
 */
export type RenderPropsConfig = {
  readonly blocks?: unknown
  readonly theme?: Theme
  readonly languages?: Languages
  readonly currentLang?: string
  readonly blockInstanceIndex?: number
}

/**
 * Applies token substitutions to component props
 *
 * @param props - Original props
 * @param currentLang - Current language
 * @param languages - Languages configuration
 * @param theme - Theme configuration
 * @returns Props with all tokens substituted
 */
function applyTokenSubstitutions(
  props: Record<string, unknown> | undefined,
  currentLang: string | undefined,
  languages: Languages | undefined,
  theme: Theme | undefined
): Record<string, unknown> | undefined {
  // Translation token substitution (must happen before theme tokens)
  const translationSubstitutedProps = substitutePropsTranslationTokens(
    props,
    currentLang,
    languages
  )
  // Theme token substitution
  return substitutePropsThemeTokens(translationSubstitutedProps, theme)
}

/**
 * Prepares processed component values (tokens, translations, styles, className)
 *
 * @param config - Component props configuration
 * @returns Processed intermediate values
 */
function prepareProcessedValues(config: ComponentPropsConfig) {
  const { type, props, children, currentLang, languages, theme, interactions } = config

  const substitutedProps = applyTokenSubstitutions(props, currentLang, languages, theme)
  const firstTranslationKey = findFirstTranslationKey(children)
  const translationData = getTranslationData(firstTranslationKey, languages)
  const styleWithShadow = processComponentStyle(type, substitutedProps?.style, theme, substitutedProps)
  const hoverTransitionStyles = buildHoverTransitionStyles(interactions?.hover)
  const finalClassName = buildFinalClassName({
    type,
    className: substitutedProps?.className,
    theme,
    substitutedProps,
    interactions,
  })

  // Merge hover transition styles with existing styles
  const styleWithHover = hoverTransitionStyles
    ? { ...styleWithShadow, ...hoverTransitionStyles }
    : styleWithShadow

  return {
    substitutedProps,
    firstTranslationKey,
    translationData,
    styleWithShadow: styleWithHover,
    finalClassName,
  }
}

/**
 * Builds complete component props with all transformations applied
 *
 * Orchestrates: token substitution, translation handling, style processing,
 * className finalization, element props building, and spacing styles application.
 *
 * @param config - Component props configuration
 * @returns Complete element props with spacing
 */
export function buildComponentProps(config: ComponentPropsConfig): {
  readonly substitutedProps: Record<string, unknown> | undefined
  readonly firstTranslationKey: string | undefined
  readonly translationData: Record<string, string> | undefined
  readonly styleWithShadow: Record<string, unknown> | undefined
  readonly finalClassName: string | undefined
  readonly elementProps: Record<string, unknown>
  readonly elementPropsWithSpacing: Record<string, unknown>
} {
  const { type, content, children, blockName, blockInstanceIndex, theme, childIndex } = config

  const {
    substitutedProps,
    firstTranslationKey,
    translationData,
    styleWithShadow,
    finalClassName,
  } = prepareProcessedValues(config)

  const elementProps = buildElementProps({
    type,
    substitutedProps,
    finalClassName,
    styleWithShadow,
    blockName,
    blockInstanceIndex,
    firstTranslationKey,
    translationData,
    hasContent: Boolean(content || children?.length),
    hasChildren: Boolean(children?.length),
    theme,
    childIndex,
    interactions: config.interactions,
  })

  return {
    substitutedProps,
    firstTranslationKey,
    translationData,
    styleWithShadow,
    finalClassName,
    elementProps,
    elementPropsWithSpacing: applySpacingStyles(type, elementProps, theme),
  }
}
