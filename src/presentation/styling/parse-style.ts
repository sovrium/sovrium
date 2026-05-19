/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toKebabCase } from '@/presentation/utils/string-utils'

function normalizeAnimationValue(animationValue: string): string {
  const parts = animationValue.trim().split(/\s+/)
  if (parts.length === 0) return animationValue

  const animationName = parts[0]
  if (!animationName) return animationValue
  const normalizedName = toKebabCase(animationName)

  return [normalizedName, ...parts.slice(1)].join(' ')
}

const CSS_PROPERTIES = new Set([
  'alignContent',
  'alignItems',
  'alignSelf',
  'animation',
  'animationDelay',
  'animationDirection',
  'animationDuration',
  'animationFillMode',
  'animationIterationCount',
  'animationName',
  'animationPlayState',
  'animationTimingFunction',
  'background',
  'backgroundColor',
  'backgroundImage',
  'backgroundPosition',
  'backgroundRepeat',
  'backgroundSize',
  'border',
  'borderBottom',
  'borderColor',
  'borderLeft',
  'borderRadius',
  'borderRight',
  'borderStyle',
  'borderTop',
  'borderWidth',
  'bottom',
  'boxShadow',
  'color',
  'cursor',
  'display',
  'flex',
  'flexBasis',
  'flexDirection',
  'flexGrow',
  'flexShrink',
  'flexWrap',
  'font',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'gap',
  'grid',
  'gridArea',
  'gridAutoColumns',
  'gridAutoFlow',
  'gridAutoRows',
  'gridColumn',
  'gridColumnEnd',
  'gridColumnGap',
  'gridColumnStart',
  'gridGap',
  'gridRow',
  'gridRowEnd',
  'gridRowGap',
  'gridRowStart',
  'gridTemplate',
  'gridTemplateAreas',
  'gridTemplateColumns',
  'gridTemplateRows',
  'height',
  'justifyContent',
  'justifyItems',
  'justifySelf',
  'left',
  'letterSpacing',
  'lineHeight',
  'listStyle',
  'listStyleImage',
  'listStylePosition',
  'listStyleType',
  'margin',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginTop',
  'maxHeight',
  'maxWidth',
  'minHeight',
  'minWidth',
  'objectFit',
  'objectPosition',
  'opacity',
  'order',
  'outline',
  'outlineColor',
  'outlineOffset',
  'outlineStyle',
  'outlineWidth',
  'overflow',
  'overflowX',
  'overflowY',
  'padding',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'position',
  'right',
  'textAlign',
  'textDecoration',
  'textOverflow',
  'textShadow',
  'textTransform',
  'top',
  'transform',
  'transformOrigin',
  'transition',
  'transitionDelay',
  'transitionDuration',
  'transitionProperty',
  'transitionTimingFunction',
  'verticalAlign',
  'visibility',
  'whiteSpace',
  'width',
  'wordBreak',
  'wordSpacing',
  'wordWrap',
  'zIndex',
])

export function isCssProperty(propName: string): boolean {
  return CSS_PROPERTIES.has(propName)
}

export function parseStyle(styleString: string): Record<string, string> {
  const declarations = styleString.split(';').filter((d) => d.trim())

  return declarations.reduce<Record<string, string>>((acc, declaration) => {
    const colonIndex = declaration.indexOf(':')
    if (colonIndex === -1) return acc

    const property = declaration.slice(0, colonIndex).trim()
    const value = declaration.slice(colonIndex + 1).trim()
    if (!property || !value) return acc

    if (property.startsWith('--')) {
      return { ...acc, [property]: value }
    }

    const camelCaseProperty = property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())

    const normalizedValue =
      camelCaseProperty === 'animation' ? normalizeAnimationValue(value) : value

    return { ...acc, [camelCaseProperty]: normalizedValue }
  }, {})
}

export function normalizeStyleAnimations(
  style: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!style) return style

  const animationValue = style.animation
  if (typeof animationValue === 'string') {
    return {
      ...style,
      animation: normalizeAnimationValue(animationValue),
    }
  }

  return style
}
