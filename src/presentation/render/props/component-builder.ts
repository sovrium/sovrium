/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  extractTranslationKeyFromContent,
  findFirstTranslationKey,
  getTranslationData,
  substitutePropsTranslationTokens,
} from '../i18n/translation-handler'
import { buildHoverTransitionStyles } from '../styling/hover-interaction-handler'
import { applySpacingStyles } from '../styling/spacing-resolver'
import { buildFinalClassName, processComponentStyle } from '../styling/style-processor'
import { substitutePropsThemeTokens } from '../styling/theme-tokens'
import { buildElementProps } from './props-builder'
import type { Design } from '@/domain/models/app/design'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'
import type { Interactions } from '@/domain/models/app/pages/components/interactions/interactions'
import type { ComponentDesignResolution } from '@/presentation/design/resolve-component-classes'
import type { ReactElement } from 'react'

/**
 * Configuration for building component props
 */
export type ComponentPropsConfig = {
  readonly type: string
  readonly props: Record<string, unknown> | undefined
  readonly children: ReadonlyArray<Component | string> | undefined
  readonly content: string | undefined
  readonly componentName: string | undefined
  readonly componentInstanceIndex: number | undefined
  readonly design: Design | undefined
  readonly languages: Languages | undefined
  readonly currentLang: string | undefined
  readonly childIndex: number | undefined
  readonly interactions: Interactions | undefined
  readonly variant?: string
  readonly size?: string
  readonly badgeVariant?: string
  /** `design.components[<type>]`, pre-resolved by `ComponentRenderer`. */
  readonly designStyles?: ComponentDesignResolution
}

/**
 * Result of component props building
 * @public
 */
export type ComponentPropsResult = {
  readonly elementProps: Record<string, unknown>
  readonly elementPropsWithSpacing: Record<string, unknown>
  readonly renderedChildren: ReadonlyArray<ReactElement | string | null>
}

/**
 * Props configuration for component rendering
 * @public
 */
export type RenderPropsConfig = {
  readonly components?: unknown
  readonly design?: Design
  readonly languages?: Languages
  readonly currentLang?: string
  readonly componentInstanceIndex?: number
}

/**
 * Applies token substitutions to component props
 *
 * @param props - Original props
 * @param currentLang - Current language
 * @param languages - Languages configuration
 * @param design - Design configuration
 * @returns Props with all tokens substituted
 */
function applyTokenSubstitutions(
  props: Record<string, unknown> | undefined,
  currentLang: string | undefined,
  languages: Languages | undefined,
  design: Design | undefined
): Record<string, unknown> | undefined {
  // Translation token substitution (must happen before design tokens)
  const translationSubstitutedProps = substitutePropsTranslationTokens(
    props,
    currentLang,
    languages
  )
  // Design token substitution
  return substitutePropsThemeTokens(translationSubstitutedProps, design)
}

/**
 * Prepares processed component values (tokens, translations, styles, className)
 *
 * @param config - Component props configuration
 * @returns Processed intermediate values
 */
function prepareProcessedValues(config: ComponentPropsConfig) {
  const {
    type,
    props,
    children,
    content,
    currentLang,
    languages,
    design,
    interactions,
    variant,
    size,
    badgeVariant,
  } = config

  const substitutedProps = applyTokenSubstitutions(props, currentLang, languages, design)
  // Check both children and content for translation keys
  const firstTranslationKey =
    findFirstTranslationKey(children) || extractTranslationKeyFromContent(content)
  const translationData = getTranslationData(firstTranslationKey, languages)
  const styleWithShadow = processComponentStyle(
    type,
    substitutedProps?.style,
    design,
    substitutedProps
  )
  const hoverTransitionStyles = buildHoverTransitionStyles(interactions?.hover)
  const finalClassName = buildFinalClassName({
    type,
    className: substitutedProps?.className,
    substitutedProps,
    interactions,
    variant,
    size,
    badgeVariant,
    designStyles: config.designStyles,
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
  const { type, content, children, componentName, componentInstanceIndex, design, childIndex } =
    config

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
    componentName,
    componentInstanceIndex,
    firstTranslationKey,
    translationData,
    hasContent: Boolean(content || children?.length),
    hasChildren: Boolean(children?.length),
    design,
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
    elementPropsWithSpacing: applySpacingStyles(type, elementProps, design),
  }
}
