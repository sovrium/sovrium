/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { calculateTotalDelay } from '../utils/time-parser'
import type { ElementPropsConfig, TestIdConfig } from './props-builder-config'

/**
 * Component types that should receive role="group" when used as blocks with children
 */
const CONTAINER_TYPES = ['div', 'container', 'flex', 'grid', 'card', 'badge'] as const

/**
 * HTML/React props that should not be converted to data attributes
 */
const RESERVED_PROPS = new Set([
  'className',
  'style',
  'children',
  'ref',
  'key',
  'id',
  'role',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'title',
  'alt',
  'src',
  'href',
  'type',
  'value',
  'placeholder',
  'disabled',
  'checked',
  'selected',
  'multiple',
  'autoFocus',
  'autoComplete',
  'readOnly',
  'required',
  'maxLength',
  'minLength',
  'pattern',
  'name',
  'tabIndex',
  'onClick',
  'onChange',
  'onSubmit',
  'onFocus',
  'onBlur',
  'onKeyDown',
  'onKeyUp',
  'onKeyPress',
  'onMouseEnter',
  'onMouseLeave',
  'animation',
  'data-testid',
  'data-block',
  'data-type',
  'data-translation-key',
  'data-translations',
  'data-scroll-animation',
  'data-scroll-threshold',
  'data-scroll-delay',
  'data-scroll-duration',
  'data-scroll-once',
  'data-i18n-content',
])

/**
 * Converts custom props to data attributes
 * Handles numeric, boolean, array, and object values
 *
 * @param props - Props object to convert
 * @returns Object with data attributes for custom props
 */
function convertCustomPropsToDataAttributes(
  props: Record<string, unknown> | undefined
): Record<string, string> {
  if (!props) return {}

  const dataAttributes: Record<string, string> = {}

  for (const [key, value] of Object.entries(props)) {
    // Skip reserved props
    if (RESERVED_PROPS.has(key)) continue

    // Skip props that are already data attributes
    if (key.startsWith('data-')) continue

    // Convert custom props to data attributes based on type
    if (typeof value === 'number') {
      dataAttributes[`data-${key}`] = value.toString()
    } else if (typeof value === 'boolean') {
      dataAttributes[`data-${key}`] = value.toString()
    } else if (Array.isArray(value)) {
      dataAttributes[`data-${key}`] = JSON.stringify(value)
    } else if (typeof value === 'object' && value !== null) {
      // Skip style objects as they're handled separately
      if (key !== 'style') {
        dataAttributes[`data-${key}`] = JSON.stringify(value)
      }
    }
    // String values are not converted to data attributes - they remain as-is
    // (e.g., className, text properties)
  }

  return dataAttributes
}

/**
 * Build test ID for component using config object
 */
function buildTestId(config: TestIdConfig): string | undefined {
  const { type, blockName, blockInstanceIndex, substitutedProps, childIndex } = config

  if (blockName) {
    return blockInstanceIndex !== undefined
      ? `block-${blockName}-${blockInstanceIndex}`
      : `block-${blockName}`
  }

  if (substitutedProps?.['data-testid']) {
    return substitutedProps['data-testid'] as string
  }

  if (childIndex !== undefined) {
    return `child-${childIndex}`
  }

  if (type === 'container') {
    return 'container'
  }

  if (type === 'flex') {
    return 'flex'
  }

  if (type === 'hero-section') {
    return 'hero-section'
  }

  if (type === 'hero') {
    return 'hero'
  }

  return undefined
}

/**
 * Build element props with all attributes using config object
 * Complexity reduced by extracting helper functions
 */
export function buildElementProps(config: ElementPropsConfig): Record<string, unknown> {
  return buildElementPropsFromConfig(config)
}

/**
 * Build element props from config object
 */
function buildElementPropsFromConfig(config: ElementPropsConfig): Record<string, unknown> {
  const hasScrollAnimation = config.type === 'card' && Boolean(config.theme?.animations?.scaleUp)
  const testId = buildTestId({
    type: config.type,
    blockName: config.blockName,
    blockInstanceIndex: config.blockInstanceIndex,
    substitutedProps: config.substitutedProps,
    childIndex: config.childIndex,
  })

  // Build all props
  const coreProps = buildCoreProps(config, testId)
  const blockProps = buildBlockProps(config)
  const translationProps = buildTranslationProps(config)
  const animationProps = buildAnimationProps(hasScrollAnimation)
  const entranceProps = buildEntranceInteractionProps(config)
  const scrollProps = buildScrollInteractionProps(config)
  const emptyStyleProps = buildEmptyElementStyles(config)

  // Merge all style objects to prevent overwrites
  const mergedStyle = {
    ...(coreProps.style as Record<string, unknown> | undefined),
    ...(entranceProps.style as Record<string, unknown> | undefined),
    ...(scrollProps.style as Record<string, unknown> | undefined),
    ...(emptyStyleProps.style as Record<string, unknown> | undefined),
  }

  // Remove style from individual prop objects
  const { style: _coreStyle, ...corePropsWithoutStyle } = coreProps
  const { style: _entranceStyle, ...entrancePropsWithoutStyle } = entranceProps
  const { style: _scrollStyle, ...scrollPropsWithoutStyle } = scrollProps
  const { style: _emptyStyle, ...emptyStylePropsWithoutStyle } = emptyStyleProps

  // Remove animation prop from substitutedProps (already applied to style)
  const { animation: _animation, ...substitutedPropsWithoutAnimation } =
    config.substitutedProps || {}

  // Convert custom props to data attributes
  const customDataAttributes = convertCustomPropsToDataAttributes(substitutedPropsWithoutAnimation)

  return {
    ...substitutedPropsWithoutAnimation,
    ...corePropsWithoutStyle,
    ...blockProps,
    ...translationProps,
    ...animationProps,
    ...entrancePropsWithoutStyle,
    ...scrollPropsWithoutStyle,
    ...emptyStylePropsWithoutStyle,
    ...customDataAttributes,
    ...(Object.keys(mergedStyle).length > 0 && { style: mergedStyle }),
  }
}

/**
 * Build core props (className, style, data-testid)
 * Handles animation prop by extracting it from substitutedProps and merging into style
 */
function buildCoreProps(
  config: ElementPropsConfig,
  testId: string | undefined
): Record<string, unknown> {
  // Extract animation prop if present (after theme token substitution)
  const animationProp = config.substitutedProps?.animation
  const hasAnimationProp = typeof animationProp === 'string'

  // Merge animation into style object if present
  const styleWithAnimation = hasAnimationProp
    ? { ...config.styleWithShadow, animation: animationProp }
    : config.styleWithShadow

  return {
    className: config.finalClassName,
    ...(styleWithAnimation && { style: styleWithAnimation }),
    ...(testId && { 'data-testid': testId }),
  }
}

/**
 * Build block-related props (data-block, data-type, role)
 */
function buildBlockProps(config: ElementPropsConfig): Record<string, unknown> {
  if (!config.blockName) return {}

  return {
    'data-block': config.blockName,
    'data-type': config.type,
    ...(config.hasChildren &&
      CONTAINER_TYPES.includes(config.type) && {
        role: 'group',
      }),
  }
}

/**
 * Build translation props (data-translation-key, data-translations)
 */
function buildTranslationProps(config: ElementPropsConfig): Record<string, unknown> {
  if (!config.firstTranslationKey || !config.translationData) return {}

  return {
    'data-translation-key': config.firstTranslationKey,
    'data-translations': JSON.stringify(config.translationData),
  }
}

/**
 * Build animation props (data-scroll-animation)
 */
function buildAnimationProps(hasScrollAnimation: boolean): Record<string, unknown> {
  if (!hasScrollAnimation) return {}

  return {
    'data-scroll-animation': 'scale-up',
  }
}

/**
 * Build entrance interaction props (style for animations)
 */
function buildEntranceInteractionProps(config: ElementPropsConfig): Record<string, unknown> {
  if (!config.interactions?.entrance) return {}

  const { delay, duration, stagger } = config.interactions.entrance

  // Calculate total delay including stagger
  const totalDelay = calculateTotalDelay(delay, stagger, config.childIndex)

  // Build animation styles immutably
  const delayStyle = totalDelay ? { animationDelay: totalDelay } : {}
  const durationStyle = duration ? { animationDuration: duration } : {}
  const animationStyles = { ...delayStyle, ...durationStyle }

  // Combine all props immutably
  const hasAnimationStyles = Object.keys(animationStyles).length > 0
  const styleProps = hasAnimationStyles
    ? { style: { ...config.styleWithShadow, ...animationStyles } }
    : {}

  return styleProps
}

/**
 * Build scroll interaction props (data-scroll-*, style for animations)
 */
function buildScrollInteractionProps(config: ElementPropsConfig): Record<string, unknown> {
  if (!config.interactions?.scroll) return {}

  const { animation, threshold, delay, duration, once } = config.interactions.scroll

  // Build base data attributes immutably
  const baseProps: Record<string, unknown> = {
    'data-scroll-animation': animation,
  }

  const thresholdProps =
    threshold !== undefined ? { 'data-scroll-threshold': threshold.toString() } : {}
  const delayProps = delay ? { 'data-scroll-delay': delay } : {}
  const durationProps = duration ? { 'data-scroll-duration': duration } : {}
  const onceProps = once === true ? { 'data-scroll-once': once.toString() } : {}

  // Build animation styles immutably
  const delayStyle = delay ? { animationDelay: delay } : {}
  const durationStyle = duration ? { animationDuration: duration } : {}
  const animationStyles = { ...delayStyle, ...durationStyle }

  // Combine all props immutably
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

/**
 * Build styles for empty elements (blocks and grids without content)
 */
function buildEmptyElementStyles(config: ElementPropsConfig): Record<string, unknown> {
  if (config.hasContent) return {}

  // Block or child without content
  if (config.blockName || config.childIndex !== undefined) {
    return {
      style: {
        ...config.styleWithShadow,
        minHeight: '1px',
        minWidth: '1px',
        display: 'inline-block',
      },
    }
  }

  // Grid without content and not a block
  if (!config.blockName && config.type === 'grid') {
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
