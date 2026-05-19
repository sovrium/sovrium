/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { calculateTotalDelay } from '../utils/time-parser'
import { convertCustomPropsToDataAttributes } from './prop-conversion'
import type { ElementPropsConfig, TestIdConfig } from './props-builder-config'

const CONTAINER_TYPES = ['div', 'container', 'flex', 'grid', 'card', 'badge'] as const

function buildComponentTestId(
  componentName: string,
  componentInstanceIndex: number | undefined
): string {
  return componentInstanceIndex !== undefined
    ? `component-${componentName}-${componentInstanceIndex}`
    : `component-${componentName}`
}

function buildDefaultTestId(type: string): string | undefined {
  const typeMap: Record<string, string> = {
    container: 'container',
    flex: 'flex',
    hero: 'hero-section',
    text: 'text',
    icon: 'icon',
  }
  return typeMap[type]
}


function buildTestId(config: TestIdConfig): string | undefined {
  const { type, componentName, componentInstanceIndex, substitutedProps, childIndex } = config

  if (componentName) {
    return buildComponentTestId(componentName, componentInstanceIndex)
  }

  if (substitutedProps?.['data-testid']) {
    return substitutedProps['data-testid'] as string
  }

  if (childIndex !== undefined) {
    return `child-${childIndex}`
  }

  return buildDefaultTestId(type)
}

export function buildElementProps(config: ElementPropsConfig): Record<string, unknown> {
  return buildElementPropsFromConfig(config)
}

function buildElementPropsFromConfig(config: ElementPropsConfig): Record<string, unknown> {
  const hasScrollAnimation = config.type === 'card' && Boolean(config.theme?.animations?.scaleUp)
  const testId = buildTestId({
    type: config.type,
    componentName: config.componentName,
    componentInstanceIndex: config.componentInstanceIndex,
    substitutedProps: config.substitutedProps,
    childIndex: config.childIndex,
  })

  const coreProps = buildCoreProps(config, testId)
  const componentDataProps = buildComponentDataProps(config)
  const translationProps = buildTranslationProps(config)
  const animationProps = buildAnimationProps(hasScrollAnimation)
  const entranceProps = buildEntranceInteractionProps(config)
  const scrollProps = buildScrollInteractionProps(config)
  const emptyStyleProps = buildEmptyElementStyles(config)

  const mergedStyle = {
    ...(coreProps.style as Record<string, unknown> | undefined),
    ...(entranceProps.style as Record<string, unknown> | undefined),
    ...(scrollProps.style as Record<string, unknown> | undefined),
    ...(emptyStyleProps.style as Record<string, unknown> | undefined),
  }

  const { style: _coreStyle, ...corePropsWithoutStyle } = coreProps
  const { style: _entranceStyle, ...entrancePropsWithoutStyle } = entranceProps
  const { style: _scrollStyle, ...scrollPropsWithoutStyle } = scrollProps
  const { style: _emptyStyle, ...emptyStylePropsWithoutStyle } = emptyStyleProps

  const {
    animation: _animation,
    style: _style,
    ...substitutedPropsWithoutAnimation
  } = config.substitutedProps || {}

  const customDataAttributes = convertCustomPropsToDataAttributes(substitutedPropsWithoutAnimation)

  return {
    ...substitutedPropsWithoutAnimation,
    ...corePropsWithoutStyle,
    ...componentDataProps,
    ...translationProps,
    ...animationProps,
    ...entrancePropsWithoutStyle,
    ...scrollPropsWithoutStyle,
    ...emptyStylePropsWithoutStyle,
    ...customDataAttributes,
    ...(Object.keys(mergedStyle).length > 0 && { style: mergedStyle }),
  }
}

function buildCoreProps(
  config: ElementPropsConfig,
  testId: string | undefined
): Record<string, unknown> {
  const animationProp = config.substitutedProps?.animation
  const hasAnimationProp = typeof animationProp === 'string'

  const styleWithAnimation = hasAnimationProp
    ? { ...config.styleWithShadow, animation: animationProp }
    : config.styleWithShadow

  return {
    className: config.finalClassName,
    ...(styleWithAnimation && { style: styleWithAnimation }),
    ...(testId && { 'data-testid': testId }),
  }
}

function buildComponentDataProps(config: ElementPropsConfig): Record<string, unknown> {
  if (!config.componentName) return {}

  return {
    'data-component': config.componentName,
    'data-type': config.type,
    ...(config.hasChildren &&
      CONTAINER_TYPES.includes(config.type) && {
        role: 'group',
      }),
  }
}

function buildTranslationProps(config: ElementPropsConfig): Record<string, unknown> {
  if (!config.firstTranslationKey || !config.translationData) return {}

  return {
    'data-translation-key': config.firstTranslationKey,
    'data-translations': JSON.stringify(config.translationData),
  }
}

function buildAnimationProps(hasScrollAnimation: boolean): Record<string, unknown> {
  if (!hasScrollAnimation) return {}

  return {
    'data-scroll-animation': 'scale-up',
  }
}

function buildEntranceInteractionProps(config: ElementPropsConfig): Record<string, unknown> {
  if (!config.interactions?.entrance) return {}

  const { delay, duration, stagger } = config.interactions.entrance

  const totalDelay = calculateTotalDelay(delay, stagger, config.childIndex)

  const delayStyle = totalDelay ? { animationDelay: totalDelay } : {}
  const durationStyle = duration ? { animationDuration: duration } : {}
  const animationStyles = { ...delayStyle, ...durationStyle }

  const hasAnimationStyles = Object.keys(animationStyles).length > 0
  const styleProps = hasAnimationStyles
    ? { style: { ...config.styleWithShadow, ...animationStyles } }
    : {}

  return styleProps
}

function buildScrollInteractionProps(config: ElementPropsConfig): Record<string, unknown> {
  if (!config.interactions?.scroll) return {}

  const { animation, threshold, delay, duration, once } = config.interactions.scroll

  const baseProps: Record<string, unknown> = {
    'data-scroll-animation': animation,
  }

  const thresholdProps =
    threshold !== undefined ? { 'data-scroll-threshold': threshold.toString() } : {}
  const delayProps = delay ? { 'data-scroll-delay': delay } : {}
  const durationProps = duration ? { 'data-scroll-duration': duration } : {}
  const onceProps = once === true ? { 'data-scroll-once': once.toString() } : {}

  const delayStyle = delay ? { animationDelay: delay } : {}
  const durationStyle = duration ? { animationDuration: duration } : {}
  const animationStyles = { ...delayStyle, ...durationStyle }

  const hasAnimationStyles = Object.keys(animationStyles).length > 0
  const styleProps = hasAnimationStyles
    ? { style: { ...config.styleWithShadow, ...animationStyles } }
    : {}

  return {
    ...baseProps,
    ...thresholdProps,
    ...delayProps,
    ...durationProps,
    ...onceProps,
    ...styleProps,
  }
}

function buildEmptyElementStyles(config: ElementPropsConfig): Record<string, unknown> {
  if (config.hasContent) return {}

  if (config.componentName || config.childIndex !== undefined) {
    return {
      style: {
        ...config.styleWithShadow,
        minHeight: '1px',
        minWidth: '1px',
        display: 'inline-block',
      },
    }
  }

  if (!config.componentName && config.type === 'grid') {
    return {
      style: {
        ...config.styleWithShadow,
        minHeight: '100px',
        minWidth: '100px',
      },
    }
  }

  return {}
}
