/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildHoverTransitionStyles } from '../styling/hover-interaction-handler'
import { applySpacingStyles } from '../styling/spacing-resolver'
import { buildFinalClassName, processComponentStyle } from '../styling/style-processor'
import { substitutePropsThemeTokens } from '../styling/theme-tokens'
import {
  extractTranslationKeyFromContent,
  findFirstTranslationKey,
  getTranslationData,
  substitutePropsTranslationTokens,
} from '../translations/translation-handler'
import { buildElementProps } from './props-builder'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'
import type { Interactions } from '@/domain/models/app/pages/components/interactions/interactions'
import type { Theme } from '@/domain/models/app/theme'
import type { ReactElement } from 'react'

export type ComponentPropsConfig = {
  readonly type: string
  readonly props: Record<string, unknown> | undefined
  readonly children: ReadonlyArray<Component | string> | undefined
  readonly content: string | undefined
  readonly componentName: string | undefined
  readonly componentInstanceIndex: number | undefined
  readonly theme: Theme | undefined
  readonly languages: Languages | undefined
  readonly currentLang: string | undefined
  readonly childIndex: number | undefined
  readonly interactions: Interactions | undefined
  readonly variant?: string
  readonly size?: string
  readonly badgeVariant?: string
}

export type ComponentPropsResult = {
  readonly elementProps: Record<string, unknown>
  readonly elementPropsWithSpacing: Record<string, unknown>
  readonly renderedChildren: ReadonlyArray<ReactElement | string | null>
}

export type RenderPropsConfig = {
  readonly components?: unknown
  readonly theme?: Theme
  readonly languages?: Languages
  readonly currentLang?: string
  readonly componentInstanceIndex?: number
}

function applyTokenSubstitutions(
  props: Record<string, unknown> | undefined,
  currentLang: string | undefined,
  languages: Languages | undefined,
  theme: Theme | undefined
): Record<string, unknown> | undefined {
  const translationSubstitutedProps = substitutePropsTranslationTokens(
    props,
    currentLang,
    languages
  )
  return substitutePropsThemeTokens(translationSubstitutedProps, theme)
}

function prepareProcessedValues(config: ComponentPropsConfig) {
  const {
    type,
    props,
    children,
    content,
    currentLang,
    languages,
    theme,
    interactions,
    variant,
    size,
    badgeVariant,
  } = config

  const substitutedProps = applyTokenSubstitutions(props, currentLang, languages, theme)
  const firstTranslationKey =
    findFirstTranslationKey(children) || extractTranslationKeyFromContent(content)
  const translationData = getTranslationData(firstTranslationKey, languages)
  const styleWithShadow = processComponentStyle(
    type,
    substitutedProps?.style,
    theme,
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
  })

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

export function buildComponentProps(config: ComponentPropsConfig): {
  readonly substitutedProps: Record<string, unknown> | undefined
  readonly firstTranslationKey: string | undefined
  readonly translationData: Record<string, string> | undefined
  readonly styleWithShadow: Record<string, unknown> | undefined
  readonly finalClassName: string | undefined
  readonly elementProps: Record<string, unknown>
  readonly elementPropsWithSpacing: Record<string, unknown>
} {
  const { type, content, children, componentName, componentInstanceIndex, theme, childIndex } =
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
