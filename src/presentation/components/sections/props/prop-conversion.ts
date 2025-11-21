/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * HTML/React props that should not be converted to data attributes
 * This includes standard HTML attributes, React-specific props, ARIA attributes,
 * event handlers, and existing data-* attributes
 */
export const RESERVED_PROPS = new Set([
  // Standard HTML/React props
  'className',
  'style',
  'children',
  'ref',
  'key',
  'id',
  'role',
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
  // ARIA attributes
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  // Event handlers
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
  // Application-specific props
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
 * Checks if a prop should be skipped during conversion
 */
function shouldSkipProp(key: string, value: unknown): boolean {
  return (
    RESERVED_PROPS.has(key) ||
    key.startsWith('data-') ||
    key.startsWith('aria-') ||
    typeof value === 'string'
  )
}

/**
 * Converts a value to a data attribute string
 */
function valueToDataAttributeString(value: unknown): string | undefined {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value.toString()
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value)
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value)
  }
  return undefined
}

/**
 * Converts a single prop value to a data attribute value
 *
 * @param key - Prop key
 * @param value - Prop value
 * @returns Data attribute entry or undefined if should be skipped
 */
function convertPropToDataAttribute(
  key: string,
  value: unknown
): readonly [string, string] | undefined {
  // Skip reserved props, data-*, aria-*, strings, and style objects
  if (shouldSkipProp(key, value) || key === 'style') return undefined

  const stringValue = valueToDataAttributeString(value)
  return stringValue ? ([`data-${key}`, stringValue] as const) : undefined
}

/**
 * Converts custom props to data attributes
 * Handles numeric, boolean, array, and object values
 *
 * This is the comprehensive version that handles all prop types.
 * Use this for components that need full prop conversion (e.g., dynamic components).
 *
 * @param props - Props object to convert
 * @returns Object with data attributes for custom props
 */
export function convertCustomPropsToDataAttributes(
  props: Record<string, unknown> | undefined
): Record<string, string> {
  if (!props) return {}

  return Object.entries(props).reduce<Record<string, string>>((acc, [key, value]) => {
    const dataAttr = convertPropToDataAttribute(key, value)
    return dataAttr ? { ...acc, [dataAttr[0]]: dataAttr[1] } : acc
  }, {})
}

/**
 * Convert custom props to data-* attributes (simplified version for badges)
 * Standard HTML attributes (className, style, id, etc.) pass through unchanged
 * String values are converted to data attributes (unlike the comprehensive version)
 *
 * This is used for badge components where all custom props should become data attributes.
 *
 * @param elementProps - Element props to convert
 * @returns Props with custom values converted to data attributes
 */
export function convertBadgeProps(elementProps: Record<string, unknown>): Record<string, unknown> {
  const standardHtmlAttrs = new Set([
    'className',
    'style',
    'id',
    'role',
    'data-testid',
    'data-block',
    'data-type',
    'data-translation-key',
    'data-translations',
  ])

  return Object.entries(elementProps).reduce<Record<string, unknown>>((acc, [key, value]) => {
    // Keep standard HTML attrs, data-*, and aria-* unchanged
    if (standardHtmlAttrs.has(key) || key.startsWith('data-') || key.startsWith('aria-')) {
      return { ...acc, [key]: value }
    }
    // Convert custom props to data-* attributes (including strings)
    return { ...acc, [`data-${key}`]: value }
  }, {})
}
